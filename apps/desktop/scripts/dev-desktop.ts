import { fileURLToPath } from "node:url";

const devUrl = "http://127.0.0.1:5273";
const cwd = fileURLToPath(new URL("..", import.meta.url));
const waitIntervalMs = 500;
const waitTimeoutMs = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForDevServer = async (url: string, webProcess: Bun.Subprocess) => {
  let webExitCode: number | null = null;
  webProcess.exited.then((code) => {
    webExitCode = code;
  });

  const startedAt = Date.now();

  while (Date.now() - startedAt < waitTimeoutMs) {
    if (webExitCode !== null) {
      throw new Error(`web dev server exited early with code ${webExitCode}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Vite is ready.
    }

    await sleep(waitIntervalMs);
  }

  throw new Error(`timed out waiting for ${url}`);
};

const spawnScript = (scriptName: string) =>
  Bun.spawn(["bun", "run", scriptName], {
    cwd,
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });

const webProcess = spawnScript("dev:web");

try {
  await waitForDevServer(devUrl, webProcess);
} catch (error) {
  webProcess.kill();
  throw error;
}

const desktopProcess = spawnScript("dev:app");

const stopProcesses = () => {
  desktopProcess.kill();
  webProcess.kill();
};

process.on("SIGINT", stopProcesses);
process.on("SIGTERM", stopProcesses);

const result = await Promise.race([
  webProcess.exited.then((code) => ({ name: "web", code })),
  desktopProcess.exited.then((code) => ({ name: "desktop", code })),
]);

stopProcesses();

if (result.code !== 0) {
  throw new Error(`${result.name} process exited with code ${result.code}`);
}
