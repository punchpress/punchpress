import { existsSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const workspaceElectrobunRoot = join(repoRoot, "node_modules", "electrobun");
const desktopNodeModulesRoot = join(desktopRoot, "node_modules");
const electrobunRoot = join(desktopNodeModulesRoot, "electrobun");

if (!existsSync(electrobunRoot)) {
  mkdirSync(desktopNodeModulesRoot, { recursive: true });
  symlinkSync(workspaceElectrobunRoot, electrobunRoot, "dir");
}

const resolvePlatform = () => {
  const os =
    process.platform === "darwin"
      ? "macos"
      : process.platform === "win32"
        ? "win"
        : process.platform === "linux"
          ? "linux"
          : null;
  const downloadOs =
    process.platform === "darwin"
      ? "darwin"
      : process.platform === "win32"
        ? "win"
        : process.platform === "linux"
          ? "linux"
          : null;
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : null;

  if (!os || !downloadOs || !arch) {
    throw new Error(
      `unsupported Electrobun runtime platform: ${process.platform}/${process.arch}`,
    );
  }

  return { os, downloadOs, arch };
};

const platform = resolvePlatform();
const distDir = join(electrobunRoot, `dist-${platform.os}-${platform.arch}`);
const launcherName = platform.os === "win" ? "launcher.exe" : "launcher";
const coreMarker = join(distDir, launcherName);
const cefMarker = join(distDir, "cef");

const readElectrobunVersion = async () => {
  const packageInfo = (await Bun.file(join(electrobunRoot, "package.json")).json()) as {
    version?: string;
  };

  if (!packageInfo.version) {
    throw new Error("failed to read electrobun version from package.json");
  }

  return packageInfo.version;
};

const downloadAndExtract = async (
  assetName: string,
  url: string,
  targetDir: string,
) => {
  mkdirSync(targetDir, { recursive: true });

  const archivePath = join(
    electrobunRoot,
    `.bootstrap-${assetName}-${platform.downloadOs}-${platform.arch}.tar.gz`,
  );

  try {
    const download = Bun.spawnSync(["curl", "-L", "--fail", "--output", archivePath, url], {
      cwd: electrobunRoot,
      stdio: ["ignore", "inherit", "inherit"],
    });

    if (download.exitCode !== 0) {
      throw new Error(`failed to download ${assetName} from ${url}`);
    }

    const extract = Bun.spawnSync(["tar", "-xzf", archivePath, "-C", targetDir], {
      cwd: electrobunRoot,
      stdio: ["ignore", "inherit", "inherit"],
    });

    if (extract.exitCode !== 0) {
      throw new Error(`failed to extract ${assetName} into ${targetDir}`);
    }
  } finally {
    if (existsSync(archivePath)) {
      unlinkSync(archivePath);
    }
  }
};

const version = await readElectrobunVersion();
const releaseBaseUrl = `https://github.com/blackboardsh/electrobun/releases/download/v${version}`;

if (!existsSync(coreMarker)) {
  console.log(`Bootstrapping Electrobun core ${version} for ${platform.downloadOs}-${platform.arch}`);
  await downloadAndExtract(
    "core",
    `${releaseBaseUrl}/electrobun-core-${platform.downloadOs}-${platform.arch}.tar.gz`,
    distDir,
  );
}

if (!existsSync(cefMarker)) {
  console.log(`Bootstrapping Electrobun CEF ${version} for ${platform.downloadOs}-${platform.arch}`);
  await downloadAndExtract(
    "cef",
    `${releaseBaseUrl}/electrobun-cef-${platform.downloadOs}-${platform.arch}.tar.gz`,
    distDir,
  );
}
