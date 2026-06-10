export const getNow = () => {
  return typeof performance === "undefined" ? Date.now() : performance.now();
};

export const hasRasterRuntime = () => {
  return typeof document !== "undefined";
};

export const canScheduleRasterFrame = () => {
  return typeof window !== "undefined";
};

export const createCanvas = (width, height) => {
  if (!hasRasterRuntime()) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

export const loadImageToCanvas = (node, sourceRect = null) => {
  const canvas = createCanvas(
    sourceRect?.width || node.width,
    sourceRect?.height || node.height
  );

  if (!canvas) {
    return Promise.resolve(null);
  }

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!(context && node.src)) {
    return Promise.resolve({ canvas, context });
  }

  return new Promise((resolve) => {
    const image = new Image();

    image.addEventListener("error", () => {
      resolve({ canvas, context });
    });
    image.addEventListener("load", () => {
      context.clearRect(0, 0, canvas.width, canvas.height);

      if (sourceRect) {
        context.drawImage(
          image,
          sourceRect.x,
          sourceRect.y,
          sourceRect.width,
          sourceRect.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
      } else {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      }

      resolve({ canvas, context });
    });

    image.src = node.src;
  });
};

export const createTransparentImageDataUrl = (width, height) => {
  const canvas = createCanvas(width, height);

  if (!canvas) {
    return "";
  }

  return canvas.toDataURL("image/png");
};

export const requestRasterFrame = (callback) => {
  if (!canScheduleRasterFrame()) {
    callback();
    return 0;
  }

  return window.requestAnimationFrame(callback);
};

export const cancelRasterFrame = (frameId) => {
  if (!(frameId && canScheduleRasterFrame())) {
    return;
  }

  window.cancelAnimationFrame(frameId);
};

export const dispatchRasterEvent = (eventName) => {
  if (!canScheduleRasterFrame()) {
    return;
  }

  window.dispatchEvent(new Event(eventName));
};
