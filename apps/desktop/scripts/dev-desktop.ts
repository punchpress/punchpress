import { spawn } from "node:child_process";
import net from "node:net";

const devServerTimeoutMs = 60_000;
const host = "127.0.0.1";
const defaultPort = 5273;

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const isPortAvailable = async (port: number) =>
  new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.unref();

    server.once("error", () => {
      resolve(false);
    });

    server.listen(port, host, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });

const getEphemeralPort = async () =>
  new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    server.once("error", reject);

    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        server.close(() => {
          reject(new Error("Failed to resolve an ephemeral port."));
        });
        return;
      }

      server.close(() => {
        resolve(address.port);
      });
    });
  });

const findAvailablePort = async (preferredPort: number) => {
  if (await isPortAvailable(preferredPort)) {
    return preferredPort;
  }

  return getEphemeralPort();
};

const waitForHttp = async (url: string) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < devServerTimeoutMs) {
    try {
      await fetch(url, { method: "GET" });
      return;
    } catch {
      await sleep(250);
    }
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const killProcess = (child?: ReturnType<typeof spawn>) => {
  if (child && !child.killed) {
    child.kill("SIGTERM");
  }
};

const run = async () => {
  const vitePort = await findAvailablePort(defaultPort);
  const env = {
    ...process.env,
    ELECTRON_IS_DEV: "1",
    VITE_PORT: String(vitePort),
    VITE_DEV_SERVER_URL: `http://${host}:${vitePort}`,
  };

  const viteProcess = spawn(
    "bun",
    ["--cwd", "../web", "vite", "--host", host, "--port", String(vitePort)],
    {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
    },
  );

  let electronProcess: ReturnType<typeof spawn> | undefined;

  const shutdown = (code = 0) => {
    killProcess(viteProcess);
    killProcess(electronProcess);
    process.exit(code);
  };

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  viteProcess.on("exit", (code) => {
    shutdown(code ?? 1);
  });

  await waitForHttp(`http://${host}:${vitePort}`);

  electronProcess = spawn("bun", ["electron-vite", "dev"], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  electronProcess.on("exit", (code) => {
    shutdown(code ?? 0);
  });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
