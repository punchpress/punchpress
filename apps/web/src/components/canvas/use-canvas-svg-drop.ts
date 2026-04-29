import { round } from "@punchpress/engine";
import {
  PUNCH_SVG_EXTENSION,
  PUNCH_SVG_MIME_TYPE,
} from "@punchpress/punch-schema";
import { useCallback } from "react";
import { showToast } from "@/components/ui/toast";
import { importSvgToNodes } from "@/platform/svg-import-document";

const hasDraggedFiles = (dataTransfer: DataTransfer | null) => {
  return Boolean(dataTransfer?.types?.includes("Files"));
};

const isSvgFile = (file: File) => {
  return (
    file.type === PUNCH_SVG_MIME_TYPE ||
    file.name.toLowerCase().endsWith(PUNCH_SVG_EXTENSION)
  );
};

const getDroppedSvgFile = (dataTransfer: DataTransfer | null) => {
  if (!dataTransfer) {
    return null;
  }

  return Array.from(dataTransfer.files).find(isSvgFile) || null;
};

export const useCanvasSvgDrop = ({ editor, getCanvasPoint }) => {
  const handleCanvasDragOver = useCallback((event) => {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleCanvasDrop = useCallback(
    (event) => {
      if (!hasDraggedFiles(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const file = getDroppedSvgFile(event.dataTransfer);

      if (!file) {
        showToast({
          message: "Drop an SVG file to import artwork.",
          priority: "high",
          type: "error",
        });
        return;
      }

      const point = getCanvasPoint(event.clientX, event.clientY);

      file
        .text()
        .then((contents) =>
          importSvgToNodes(contents, {
            targetCenter: {
              x: round(point.x, 2),
              y: round(point.y, 2),
            },
          })
        )
        .then((nodes) => {
          editor.insertNodes(nodes);
          showToast({
            message: `Imported ${file.name}`,
            type: "success",
          });
        })
        .catch((error) => {
          console.error(error);
          showToast({
            message: `Import SVG failed: ${
              error instanceof Error ? error.message : "Unknown file error."
            }`,
            priority: "high",
            type: "error",
          });
        });
    },
    [editor, getCanvasPoint]
  );

  return {
    handleCanvasDragOver,
    handleCanvasDrop,
  };
};
