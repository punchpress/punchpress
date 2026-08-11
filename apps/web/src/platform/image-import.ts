import {
  createDefaultImageNode,
  MAX_RASTER_CROP_AREA,
  MAX_RASTER_CROP_DIMENSION,
  round,
} from "@punchpress/engine";

const DEFAULT_IMAGE_SIZE = 360;
const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg"];
const DATA_URL_MIME_TYPE_PATTERN = /^data:[^;,]*(?=[;,])/;

export const getSupportedImageMimeType = (file: File) => {
  const fileName = file.name.toLowerCase();

  if (SUPPORTED_IMAGE_MIME_TYPES.includes(file.type)) {
    return file.type as "image/jpeg" | "image/png";
  }

  if (fileName.endsWith(".png")) {
    return "image/png";
  }

  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return null;
};

export const isSupportedImageFile = (file: File) => {
  return Boolean(getSupportedImageMimeType(file));
};

export const readFileAsDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("error", () => {
      reject(reader.error || new Error("Could not read image file."));
    });
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Could not read image file."));
    });

    reader.readAsDataURL(file);
  });
};

export const normalizeImageDataUrlMimeType = ({
  mimeType,
  src,
}: {
  mimeType: string;
  src: string;
}) => {
  return src.replace(DATA_URL_MIME_TYPE_PATTERN, `data:${mimeType}`);
};

const loadImageDimensions = (src: string) => {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new Image();

    image.addEventListener("error", () => {
      reject(new Error("Could not load image dimensions."));
    });
    image.addEventListener("load", () => {
      resolve({
        height: image.naturalHeight || DEFAULT_IMAGE_SIZE,
        width: image.naturalWidth || DEFAULT_IMAGE_SIZE,
      });
    });

    image.src = src;
  });
};

const getNaturalRasterSize = ({ height, width }) => {
  if (!(width > 0 && height > 0)) {
    return {
      height: DEFAULT_IMAGE_SIZE,
      width: DEFAULT_IMAGE_SIZE,
    };
  }

  const naturalWidth = Math.round(width);
  const naturalHeight = Math.round(height);

  if (
    naturalWidth > MAX_RASTER_CROP_DIMENSION ||
    naturalHeight > MAX_RASTER_CROP_DIMENSION ||
    naturalWidth * naturalHeight > MAX_RASTER_CROP_AREA
  ) {
    throw new Error(
      "Image dimensions exceed the 16,384px side or 100,000,000px area limit."
    );
  }

  return { height: naturalHeight, width: naturalWidth };
};

export const createImageNodeFromDataUrl = async ({
  mimeType,
  name,
  src,
  targetCenter,
}: {
  mimeType: string;
  name: string;
  src: string;
  targetCenter: { x: number; y: number };
}) => {
  const dimensions = await loadImageDimensions(src);
  const size = getNaturalRasterSize(dimensions);
  const imageNode = createDefaultImageNode({
    height: size.height,
    mimeType,
    name,
    src,
    width: size.width,
  });

  return {
    ...imageNode,
    pixelHeight: size.height,
    pixelWidth: size.width,
    transform: {
      ...imageNode.transform,
      x: round(targetCenter.x - imageNode.width / 2, 2),
      y: round(targetCenter.y - imageNode.height / 2, 2),
    },
  };
};
