import { afterEach, describe, expect, test } from "bun:test";
import { readLocalFontBytes } from "../../../src/platform/local-fonts";

const restoreWindow = () => {
  if ("window" in globalThis) {
    Reflect.deleteProperty(globalThis, "window");
  }
};

afterEach(() => {
  restoreWindow();
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
