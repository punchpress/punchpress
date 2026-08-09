export interface Canvas2dRasterCapabilities {
  createCanvas: (width: number, height: number) => HTMLCanvasElement;
  decodeImage: (src: string) => Promise<CanvasImageSource>;
  encodeCanvas: (canvas: HTMLCanvasElement) => Promise<string>;
}

export const browserCanvas2dCapabilities: Canvas2dRasterCapabilities = {
  createCanvas: (width, height) => {
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
  decodeImage: async (src) => {
    const image = new Image();

    image.src = src;
    await image.decode();
    return image;
  },
  encodeCanvas: (canvas) =>
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not encode Raster Canvas."));
          return;
        }

        const reader = new FileReader();

        reader.addEventListener("error", () => reject(reader.error));
        reader.addEventListener("load", () => resolve(String(reader.result)));
        reader.readAsDataURL(blob);
      }, "image/png");
    }),
};

export const requireCanvas2dContext = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    throw new Error("Canvas2D is unavailable for the Raster surface");
  }

  return context;
};
