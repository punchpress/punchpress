import {
  insertComponentNodes,
  recipeToComponentNodes,
  round,
} from "@punchpress/engine";
import {
  PUNCH_SVG_EXTENSION,
  PUNCH_SVG_MIME_TYPE,
} from "@punchpress/punch-schema";
import { useCallback } from "react";
import { showToast } from "@/components/ui/toast";
import {
  type SvgEmbeddedImportResult,
  tryParseEmbeddedDocument,
} from "@/platform/svg-embedded-import";
import { importSvgToNodes } from "@/platform/svg-import-document";
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

// Drop path for a recipe SVG: insert its content as a frameless group at the
// drop point rather than opening it as a new tab (see svg-embedded-import.ts).
const insertRecipeAsGroup = (
  editor,
  embedded: Extract<SvgEmbeddedImportResult, { kind: "document" }>,
  fileName: string,
  targetCenter: { x: number; y: number }
) => {
  const { nodes, skippedImageCount } = recipeToComponentNodes(
    embedded.document,
    { targetCenter }
  );

  if (nodes.length === 0) {
    throw new Error(`No importable content found in ${fileName}.`);
  }

  insertComponentNodes(editor, nodes, { targetCenter });
  showToast({
    message:
      skippedImageCount > 0
        ? `Added ${fileName} to canvas (skipped ${skippedImageCount} image${
            skippedImageCount === 1 ? "" : "s"
          } without image data)`
        : `Added ${fileName} to canvas`,
    type: "success",
  });
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

      const handleDrop = async () => {
        if (isSvgFile(file)) {
          const svgText = await file.text();
          const embedded = tryParseEmbeddedDocument(svgText);

          if (embedded.kind === "document") {
            insertRecipeAsGroup(editor, embedded, file.name, targetCenter);
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
    [editor, getCanvasPoint]
  );

  return {
    handleCanvasDragOver,
    handleCanvasDrop,
  };
};
