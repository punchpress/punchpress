import electron from "electron";

const { env } = process;
const isEnvSet = "ELECTRON_IS_DEV" in env;
const getFromEnv = Number.parseInt(env.ELECTRON_IS_DEV || "0", 10) === 1;

let resolvedIsDev = false;
if (typeof electron === "string") {
  resolvedIsDev = getFromEnv;
} else {
  resolvedIsDev = isEnvSet ? getFromEnv : !electron.app.isPackaged;
}

export const isDev = resolvedIsDev;
