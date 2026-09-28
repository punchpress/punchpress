import { afterEach, describe, expect, test } from "bun:test";
import {
  getInitialLocalFontCatalog,
  readLocalFontBytes,
  requestLocalFontCatalog,
} from "../../../src/platform/local-fonts";

const restoreWindow = () => {
  if ("window" in globalThis) {
    Reflect.deleteProperty(globalThis, "window");
  }
};

afterEach(() => {
  restoreWindow();
});

describe("local font catalog availability", () => {
  test("browser initial state leaves installed fonts unqueried", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { queryLocalFonts: () => Promise.resolve([]) },
    });

    expect(await getInitialLocalFontCatalog()).toEqual({
      error: "",
      fonts: [],
      state: "action-required",
    });
  });

  test("browser denial keeps the catalog unresolved", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        queryLocalFonts: () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    });

    expect(await requestLocalFontCatalog()).toEqual({
      error: "Local font access was denied.",
      fonts: [],
      state: "permission-denied",
    });
  });

  test("desktop scan reports a ready catalog even when no fonts are found", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        electron: { localFonts: { listFonts: () => Promise.resolve([]) } },
      },
    });

    expect(await getInitialLocalFontCatalog()).toEqual({
      error: "",
      fonts: [],
      state: "ready",
    });
  });

  test("desktop scan failure remains an unknown catalog", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        electron: {
          localFonts: {
            listFonts: () => Promise.reject(new Error("Font scan failed")),
          },
        },
      },
    });

    expect(await requestLocalFontCatalog()).toEqual({
      error: "Font scan failed",
      fonts: [],
      state: "error",
    });
  });
});

describe("readLocalFontBytes", () => {
  test("returns null when the requested browser font is not available", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        queryLocalFonts: () =>
          Promise.resolve([
            {
              blob: () =>
                Promise.resolve(
                  new Blob([new Uint8Array([1, 2, 3])], { type: "font/ttf" })
                ),
              family: "Other Font",
              fullName: "Other Font",
              postscriptName: "OtherFont-Regular",
              style: "Regular",
            },
          ]),
      },
    });

    const bytes = await readLocalFontBytes({
      family: "Missing Font",
      fullName: "Missing Font",
      postscriptName: "MissingFont-Regular",
      style: "Regular",
    });

    expect(bytes).toBeNull();
  });
});
