import { notarize } from "@electron/notarize";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const STAPLE_RETRY_DELAYS_MS = [15000, 30000, 45000, 60000];

export default async function notarizeApp(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== "darwin") {
    return;
  }

  const appleId = process.env.APPLE_ID;
  const applePassword =
    process.env.APPLE_APP_SPECIFIC_PASSWORD ?? process.env.APPLE_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!(appleId && applePassword && teamId)) {
    console.log(
      "Skipping notarization. Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD (or APPLE_PASSWORD), and APPLE_TEAM_ID.",
    );
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  try {
    await notarize({
      tool: "notarytool",
      appPath,
      appleId,
      appleIdPassword: applePassword,
      teamId,
    });
  } catch (error) {
    if (!isStapleFailure(error)) {
      throw error;
    }

    await retryStaple(appPath);
  }
}

const isStapleFailure = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Failed to staple your application");
};

const retryStaple = async (appPath) => {
  let lastError = null;

  for (let attempt = 0; attempt < STAPLE_RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = STAPLE_RETRY_DELAYS_MS[attempt];
    console.log(
      `Stapling ticket not available yet. Retrying in ${Math.round(delayMs / 1000)}s...`,
    );
    await sleep(delayMs);

    try {
      await execFileAsync(
        "xcrun",
        ["stapler", "staple", "-v", path.basename(appPath)],
        { cwd: path.dirname(appPath) },
      );
      await execFileAsync(
        "xcrun",
        ["stapler", "validate", path.basename(appPath)],
        { cwd: path.dirname(appPath) },
      );
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Failed to staple the notarized app");
};

const sleep = (delayMs) => new Promise((resolve) => {
  setTimeout(resolve, delayMs);
});
