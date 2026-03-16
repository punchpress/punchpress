import { useEffect, useState } from "react";
import { useEditor } from "../../../editor-react/use-editor";
import { CanvasEditingSelection } from "./canvas-editing-selection";
import { CanvasHoverPreview } from "./canvas-hover-preview";
import { CanvasSelectionOverlay } from "./canvas-selection-overlay";
import { CanvasTransformOverlay } from "./canvas-transform-overlay";

export const CanvasOverlay = () => {
  const editor = useEditor();
  const [viewportRevision, setViewportRevision] = useState(0);

  useEffect(() => {
    const handleViewportChange = () => {
      setViewportRevision((value) => value + 1);
    };
    editor.onViewportChange = handleViewportChange;

    return () => {
      if (editor.onViewportChange === handleViewportChange) {
        editor.onViewportChange = null;
      }
    };
  }, [editor]);

  return (
    <>
      <CanvasSelectionOverlay />
      <CanvasTransformOverlay viewportRevision={viewportRevision} />
      <CanvasEditingSelection viewportRevision={viewportRevision} />
      <CanvasHoverPreview viewportRevision={viewportRevision} />
    </>
  );
};
