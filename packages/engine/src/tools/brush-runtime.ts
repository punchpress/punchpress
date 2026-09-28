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

export const getRasterCanvasBounds = (node, sourceRect = null) => {
  if (sourceRect) {
    return sourceRect;
  }

  const baseX = node.baseX ?? 0;
  const baseY = node.baseY ?? 0;
  const minX = Math.min(0, baseX);
  const minY = Math.min(0, baseY);
  const maxX = Math.max(node.width, baseX + (node.baseWidth ?? node.width));
  const maxY = Math.max(node.height, baseY + (node.baseHeight ?? node.height));

  return {
    height: Math.max(1, Math.ceil(maxY) - Math.floor(minY)),
    width: Math.max(1, Math.ceil(maxX) - Math.floor(minX)),
    x: Math.floor(minX),
    y: Math.floor(minY),
  };
};

export const loadImageToCanvas = (node, sourceRect = null) => {
  const bounds = getRasterCanvasBounds(node, sourceRect);
  const canvas = createCanvas(bounds.width, bounds.height);

  if (!canvas) {
    return Promise.resolve(null);
  }

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!(context && node.src)) {
    return Promise.resolve({ canvas, context, offset: bounds });
  }

  return new Promise((resolve) => {
    const image = new Image();

    image.addEventListener("error", () => {
      resolve({ canvas, context, offset: bounds });
    });
    image.addEventListener("load", () => {
      context.clearRect(0, 0, canvas.width, canvas.height);

      context.drawImage(
        image,
        (node.baseX ?? 0) - bounds.x,
        (node.baseY ?? 0) - bounds.y,
        node.baseWidth ?? node.width,
        node.baseHeight ?? node.height
      );

      resolve({ canvas, context, offset: bounds });
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
