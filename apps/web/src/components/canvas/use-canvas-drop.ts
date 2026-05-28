import { round } from "@punchpress/engine";
import { useCallback } from "react";
import { showToast } from "@/components/ui/toast";
import {
  CANVAS_DROP_SUPPORTED_FILE_LABEL,
  getCanvasFileDropImport,
} from "./canvas-file-drop-importers";

const hasDraggedFiles = (dataTransfer: DataTransfer | null) => {
  return Boolean(dataTransfer?.types?.includes("Files"));
};

export const useCanvasDrop = ({ editor, getCanvasPoint }) => {
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

      const droppedImport = getCanvasFileDropImport(
        Array.from(event.dataTransfer?.files || [])
      );

      if (!droppedImport) {
        showToast({
          message: `Drop a ${CANVAS_DROP_SUPPORTED_FILE_LABEL} file to import artwork.`,
          priority: "high",
          type: "error",
        });
        return;
      }

      const point = getCanvasPoint(event.clientX, event.clientY);
      const targetCenter = {
        x: round(point.x, 2),
        y: round(point.y, 2),
      };
      const { file, importer } = droppedImport;

      importer
        .importFile({ file, targetCenter })
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
            message: `Import ${importer.label} failed: ${
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
