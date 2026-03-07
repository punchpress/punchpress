import type { ElectrobunConfig } from "electrobun";

const config: ElectrobunConfig = {
  app: {
    name: "PunchPress",
    identifier: "build.punchpress.desktop",
    version: "0.1.0",
    description: "Electrobun desktop wrapper for PunchPress",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    copy: {
      "../web/dist": "views/web",
    },
    mac: {
      bundleCEF: true,
      defaultRenderer: "cef",
      icons: "icon.iconset",
    },
    win: {
      bundleCEF: true,
      defaultRenderer: "cef",
      icon: "icons/app.ico",
    },
    linux: {
      bundleCEF: true,
      defaultRenderer: "cef",
      icon: "icons/app.png",
    },
  },
  runtime: {
    exitOnLastWindowClosed: true,
    devUrl: "http://127.0.0.1:5273",
    productionUrl: "views://web/index.html",
  },
};

export default config;
