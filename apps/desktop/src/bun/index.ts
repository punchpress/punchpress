import {
  ApplicationMenu,
  BrowserWindow,
  BuildConfig,
} from "electrobun";

const defaultWindowSize = {
  width: 1440,
  height: 960,
};

const blockDevToolsShortcutScript = `
(() => {
  if ((window).__punchpressBlockDevToolsShortcutInstalled) {
    return;
  }

  (window).__punchpressBlockDevToolsShortcutInstalled = true;

  const shouldBlock = (event) => {
    const isModifierPressed = event.metaKey || event.ctrlKey;
    return isModifierPressed && event.shiftKey && event.key.toLowerCase() === "i";
  };

  const blockShortcut = (event) => {
    if (!shouldBlock(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  window.addEventListener("keydown", blockShortcut, true);
  window.addEventListener("keyup", blockShortcut, true);
})();
`;

const installApplicationMenu = () => {
  const appLabel = "PunchPress";
  const appMenu =
    process.platform === "darwin"
      ? {
          label: appLabel,
          submenu: [
            { role: "about" },
            { type: "divider" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "showAll" },
            { type: "divider" },
            { role: "quit" },
          ],
        }
      : {
          label: "File",
          submenu: [{ role: "quit" }],
        };

  ApplicationMenu.setApplicationMenu([
    appMenu,
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "divider" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "divider" },
        { role: "bringAllToFront" },
      ],
    },
  ]);
};

const readBuildChannel = async () => {
  try {
    const versionInfo = (await Bun.file("../Resources/version.json").json()) as {
      channel?: string;
    };
    return typeof versionInfo.channel === "string" ? versionInfo.channel : "stable";
  } catch {
    return "stable";
  }
};

const resolveAppUrl = async () => {
  const buildConfig = await BuildConfig.get();
  const channel = await readBuildChannel();
  const runtime = buildConfig.runtime as
    | { devUrl?: string; productionUrl?: string }
    | undefined;

  if (channel === "dev") {
    return runtime?.devUrl ?? "http://127.0.0.1:5273";
  }

  return runtime?.productionUrl ?? "views://web/index.html";
};

const main = async () => {
  const url = await resolveAppUrl();
  installApplicationMenu();

  const window = new BrowserWindow({
    title: "PunchPress",
    url,
    renderer: "cef",
    frame: {
      x: 0,
      y: 0,
      width: defaultWindowSize.width,
      height: defaultWindowSize.height,
    },
  });

  window.webview.on("dom-ready", () => {
    window.webview.executeJavascript(blockDevToolsShortcutScript);
  });
};

await main();
