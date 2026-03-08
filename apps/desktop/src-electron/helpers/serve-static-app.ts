import fs from "node:fs/promises";
import path from "node:path";
import { app, net, protocol, session } from "electron";

const appScheme = "app";
const appHost = "static";
const trailingColonRe = /:$/;
const urlQueryRe = /\?.*/;

export const configurePrivilegedStaticAppScheme = () => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: appScheme,
      privileges: {
        standard: true,
        secure: true,
        allowServiceWorkers: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
};

export const serveStaticAt = async (appDir: string) => {
  await app.whenReady();

  const sharedSession = session.fromPartition("persist:shared-session");

  sharedSession.protocol.handle(appScheme, async (request) => {
    const filePath = path.join(
      request.url.replace(`${appScheme}://${appHost}`, appDir),
    );

    let resolvedPath = await resolvePath(filePath);

    if (!(resolvedPath || path.extname(filePath))) {
      resolvedPath = await resolvePath(`${filePath}.html`);
    }

    if (!resolvedPath) {
      resolvedPath = path.join(appDir, "index.html");
    }

    return net.fetch(`file://${resolvedPath}`);
  });
};

const resolvePath = async (targetPath: string): Promise<string | null> => {
  try {
    const cleanedPath = targetPath.replace(urlQueryRe, "");
    const result = await fs.stat(cleanedPath);

    if (result.isFile()) {
      return cleanedPath;
    }

    if (result.isDirectory()) {
      return resolvePath(path.join(cleanedPath, "index.html"));
    }
  } catch {
    return null;
  }

  return null;
};
