import { execFileSync } from "node:child_process";
import path from "node:path";

export default () => {
  if (process.env.PUNCHPRESS_SKIP_DESKTOP_BUILD === "1") {
    return;
  }

  execFileSync("bun", ["x", "electron-vite", "build"], {
    cwd: path.join(process.cwd(), "apps", "desktop"),
    env: {
      ...process.env,
      ELECTRON_IS_DEV: "1",
    },
    stdio: "inherit",
  });
};
