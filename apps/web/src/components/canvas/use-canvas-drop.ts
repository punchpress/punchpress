import { round } from "@punchpress/engine";
import {
  PUNCH_SVG_EXTENSION,
  PUNCH_SVG_MIME_TYPE,
} from "@punchpress/punch-schema";
import { useCallback } from "react";
import { showToast } from "@/components/ui/toast";
import { tryParseEmbeddedDocument } from "@/platform/svg-embedded-import";
import { importSvgToNodes } from "@/platform/svg-import-document";
import { useWorkspace } from "@/workspace/use-workspace";
import {
  CANVAS_DROP_SUPPORTED_FILE_LABEL,
  getCanvasFileDropImport,
} from "./canvas-file-drop-importers";

const isSvgFile = (file: File) =>
  file.type === PUNCH_SVG_MIME_TYPE ||
  file.name.toLowerCase().endsWith(PUNCH_SVG_EXTENSION);

const hasDraggedFiles = (dataTransfer: DataTransfer | null) => {
  return Boolean(dataTransfer?.types?.includes("Files"));
};

export const useCanvasDrop = ({ editor, getCanvasPoint }) => {
  const workspace = useWorkspace();
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

      const handleDrop = async () => {
        if (isSvgFile(file)) {
          const svgText = await file.text();
          const embedded = tryParseEmbeddedDocument(svgText);

          if (embedded.kind === "document") {
            await workspace.openDocumentTab({
              contents: embedded.documentJson,
              fileHandle: null,
              fileName: file.name,
            });
            showToast({
              message: `Restored design from ${file.name}`,
              type: "success",
            });
            return;
          }

          if (embedded.kind === "error") {
            throw embedded.error;
          }

          // kind === "none": no embedded recipe — fall back to geometry import
          const nodes = await importSvgToNodes(svgText, { targetCenter });
          editor.insertNodes(nodes);
          showToast({
            message: `Imported ${file.name}`,
            type: "success",
          });
          return;
        }

        const nodes = await importer.importFile({ file, targetCenter });
        editor.insertNodes(nodes);
        showToast({
          message: `Imported ${file.name}`,
          type: "success",
        });
      };

      handleDrop().catch((error) => {
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
    [editor, getCanvasPoint, workspace]
  );

  return {
    handleCanvasDragOver,
    handleCanvasDrop,
  };
};
