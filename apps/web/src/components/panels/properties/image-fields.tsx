import { Link2Icon, Loader2Icon, UnlinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { ScrubSlider } from "@/components/ui/scrub-slider";
import { Toggle } from "@/components/ui/toggle";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorPreviewValue } from "../../../editor-react/use-editor-preview-value";
import { Section } from "./field-primitives";

const IMAGE_SIZE_RANGE = { min: 1, max: 16_384 };
const RESIZE_STATUS_DELAY_MS = 150;

export const ImageFields = ({ height, node, width }) => {
  const editor = useEditor();
  const resizeSessionRef = useRef<ReturnType<
    typeof editor.beginRasterResize
  > | null>(null);
  const resize = useEditorPreviewValue((activeEditor) => {
    const state = activeEditor.getRasterResizeState(node?.id);
    const preview = activeEditor.selectionDragPreview;
    const previewUpdate = preview?.nodeIds?.includes(node?.id)
      ? preview.resize?.nodeUpdate
      : null;

    return {
      height: state?.targetHeight ?? previewUpdate?.height ?? node?.height,
      locked: node?.id ? activeEditor.isRasterAspectRatioLocked(node.id) : true,
      pending: Boolean(state),
      width: state?.targetWidth ?? previewUpdate?.width ?? node?.width,
    };
  });
  const showsStatus = useDelayedResizeStatus(resize.pending);

  if (!(node && width && height)) {
    return null;
  }

  const beginResize = () => {
    resizeSessionRef.current ??= editor.beginRasterResize(node.id);
  };
  const updateResize = (size) => {
    const session = resizeSessionRef.current;

    if (session) {
      editor.updateRasterResize(session, size);
      return;
    }

    return editor.resizeRaster(node.id, size);
  };
  const commitResize = () => {
    const session = resizeSessionRef.current;
    resizeSessionRef.current = null;

    if (session) {
      return editor.commitRasterResize(session);
    }
  };

  return (
    <Section title="Image">
      <fieldset
        aria-label="Image dimensions"
        className="m-0 grid min-w-0 grid-cols-[60px_24px_minmax(0,1fr)] grid-rows-2 items-center gap-y-2 border-0 p-0"
      >
        <Label className="col-start-1 row-start-1 select-none text-[13px] text-sidebar-foreground/72 leading-normal">
          Width
        </Label>
        <div
          className="col-start-2 row-span-2 row-start-1 flex shrink-0 items-center justify-center self-center"
          data-image-dimensions-link=""
        >
          <Toggle
            aria-label={
              resize.locked
                ? "Unlock image aspect ratio"
                : "Lock image aspect ratio"
            }
            className="size-6 min-w-6 p-0"
            disabled={resize.pending}
            onPressedChange={(locked) => {
              editor.setRasterAspectRatioLocked(node.id, locked);
            }}
            pressed={resize.locked}
            size="sm"
            title={
              resize.locked
                ? "Unlock image aspect ratio"
                : "Lock image aspect ratio"
            }
            type="button"
          >
            {resize.locked ? <Link2Icon /> : <UnlinkIcon />}
          </Toggle>
        </div>
        <div className="col-start-3 row-start-1 min-w-0">
          <ScrubSlider
            ariaLabel="Image width"
            disabled={resize.pending}
            max={IMAGE_SIZE_RANGE.max}
            min={IMAGE_SIZE_RANGE.min}
            onScrubEnd={commitResize}
            onScrubStart={beginResize}
            onValueChange={(nextWidth) => updateResize({ width: nextWidth })}
            value={resize.width ?? width.value ?? node.width}
          />
        </div>

        <Label className="col-start-1 row-start-2 select-none text-[13px] text-sidebar-foreground/72 leading-normal">
          Height
        </Label>
        <div className="col-start-3 row-start-2 min-w-0">
          <ScrubSlider
            ariaLabel="Image height"
            disabled={resize.pending}
            max={IMAGE_SIZE_RANGE.max}
            min={IMAGE_SIZE_RANGE.min}
            onScrubEnd={commitResize}
            onScrubStart={beginResize}
            onValueChange={(nextHeight) => updateResize({ height: nextHeight })}
            value={resize.height ?? height.value ?? node.height}
          />
        </div>
      </fieldset>

      {showsStatus ? (
        <div className="grid grid-cols-[60px_24px_minmax(0,1fr)] items-center">
          <div
            className="col-start-3 flex min-w-0 items-center gap-1.5 px-1 text-[11px] text-foreground/56"
            data-image-resize-status=""
          >
            <Loader2Icon className="size-3 animate-spin" />
            <span>Resizing…</span>
          </div>
        </div>
      ) : null}
    </Section>
  );
};

const useDelayedResizeStatus = (pending) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, RESIZE_STATUS_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pending]);

  return visible;
};
