import {
  PUNCH_SVG_EXTENSION,
  PUNCH_SVG_MIME_TYPE,
} from "@punchpress/punch-schema";
import {
  createImageNodeFromDataUrl,
  getSupportedImageMimeType,
  isSupportedImageFile,
  normalizeImageDataUrlMimeType,
  readFileAsDataUrl,
} from "@/platform/image-import";
import { importSvgToNodes } from "@/platform/svg-import-document";

const isSvgFile = (file: File) => {
  return (
    file.type === PUNCH_SVG_MIME_TYPE ||
    file.name.toLowerCase().endsWith(PUNCH_SVG_EXTENSION)
  );
};

export const CANVAS_DROP_SUPPORTED_FILE_LABEL = "SVG, PNG, or JPG";

export const CANVAS_FILE_DROP_IMPORTERS = [
  {
    canImport: isSvgFile,
    importFile: async ({ file, targetCenter }) => {
      return importSvgToNodes(await file.text(), {
        targetCenter,
      });
    },
    label: "SVG",
  },
  {
    canImport: isSupportedImageFile,
    importFile: async ({ file, targetCenter }) => {
      const mimeType = getSupportedImageMimeType(file);

      if (!mimeType) {
        throw new Error("Unsupported image file type.");
      }

      const src = normalizeImageDataUrlMimeType({
        mimeType,
        src: await readFileAsDataUrl(file),
      });

      const node = await createImageNodeFromDataUrl({
        mimeType,
        name: file.name || "Image",
        src,
        targetCenter,
      });

      return [node];
    },
    label: "image",
  },
];

export const getCanvasFileDropImport = (files: File[]) => {
  for (const importer of CANVAS_FILE_DROP_IMPORTERS) {
    const file = files.find(importer.canImport);

    if (file) {
      return { file, importer };
    }
  }

  return null;
};
