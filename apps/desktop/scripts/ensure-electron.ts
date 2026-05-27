import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);

const resolveElectronPackageDir = () => {
  return path.dirname(require.resolve("electron/package.json"));
};

const getElectronPlatformPath = () => {
  switch (process.platform) {
    case "darwin":
      return "Electron.app/Contents/MacOS/Electron";
    case "freebsd":
    case "linux":
    case "openbsd":
      return "electron";
    case "win32":
      return "electron.exe";
    default:
      throw new Error(`Electron is not available on ${process.platform}.`);
  }
};

const getInstalledElectronPath = (electronPackageDir: string) => {
  const pathFile = path.join(electronPackageDir, "path.txt");

  if (existsSync(pathFile)) {
    return readFileSync(pathFile, "utf8").trim();
  }

  return getElectronPlatformPath();
};

const isElectronInstalled = (electronPackageDir: string) => {
  const executablePath = getInstalledElectronPath(electronPackageDir);

  return Boolean(
    executablePath && existsSync(path.join(electronPackageDir, "dist", executablePath))
  );
};

const ensureElectronPathFile = (electronPackageDir: string) => {
  const pathFile = path.join(electronPackageDir, "path.txt");

  if (existsSync(pathFile)) {
    return;
  }

  writeFileSync(pathFile, getElectronPlatformPath());
};

export const ensureElectronInstalled = () => {
  const electronPackageDir = resolveElectronPackageDir();

  if (isElectronInstalled(electronPackageDir)) {
    ensureElectronPathFile(electronPackageDir);
    return;
  }

  console.log("Electron binary missing; repairing local Electron install...");

  const installResult = spawnSync(
    "bun",
    [path.join(electronPackageDir, "install.js")],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    }
  );

  if (installResult.status !== 0) {
    throw new Error("Failed to install Electron binary.");
  }

  if (!isElectronInstalled(electronPackageDir)) {
    throw new Error("Electron install completed but no binary was found.");
  }

  ensureElectronPathFile(electronPackageDir);
};

if (import.meta.main) {
  ensureElectronInstalled();
}
