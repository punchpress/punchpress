import { CheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ARTBOARD_PRESETS,
  DEFAULT_CUSTOM_ARTBOARD_SIZE,
} from "./new-file-presets";

const NO_ARTBOARD_ID = "none";
const PRESET_CARD_CLASS =
  "flex min-h-12 items-start justify-between rounded-(--surface-radius) border border-border bg-card px-2.5 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:border-primary data-[selected=true]:bg-primary/8";
const PRESET_DETAIL_CLASS =
  "text-(length:--chrome-text-sm) text-muted-foreground";
const SECTION_TITLE_CLASS =
  "text-(length:--section-title-text) font-semibold text-(--section-title-color) tracking-(--section-title-tracking) [text-transform:var(--section-title-case)]";
const CUSTOM_ARTBOARD_ID = "custom";

const clampSize = (value: string, fallback: number) => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.max(1, parsedValue);
};

export const NewFileDialog = ({ onCreate, onOpenChange, open }) => {
  const [selectedId, setSelectedId] = useState("amazon-merch");
  const [customWidth, setCustomWidth] = useState(
    String(DEFAULT_CUSTOM_ARTBOARD_SIZE.width)
  );
  const [customHeight, setCustomHeight] = useState(
    String(DEFAULT_CUSTOM_ARTBOARD_SIZE.height)
  );
  const presetGroups = useMemo(() => {
    return ARTBOARD_PRESETS.reduce((groups, preset) => {
      const group = groups.get(preset.group) || [];
      group.push(preset);
      groups.set(preset.group, group);
      return groups;
    }, new Map());
  }, []);

  const handleCreate = () => {
    if (selectedId === NO_ARTBOARD_ID) {
      onCreate({});
      return;
    }

    if (selectedId === CUSTOM_ARTBOARD_ID) {
      const width = clampSize(customWidth, DEFAULT_CUSTOM_ARTBOARD_SIZE.width);
      const height = clampSize(
        customHeight,
        DEFAULT_CUSTOM_ARTBOARD_SIZE.height
      );

      onCreate({
        artboard: {
          height,
          name: "Custom",
          width,
        },
      });
      return;
    }

    const preset = ARTBOARD_PRESETS.find((entry) => entry.id === selectedId);

    if (!preset) {
      onCreate({});
      return;
    }

    onCreate({
      artboard: {
        height: preset.height,
        name: preset.name,
        width: preset.width,
      },
    });
  };

  return (
    <Dialog modal onOpenChange={onOpenChange} open={open}>
      <DialogPopup bottomStickOnMobile={false} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New File</DialogTitle>
          <DialogDescription>
            Start with a production surface or an empty pasteboard.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="grid gap-3">
            {[...presetGroups.entries()].map(([groupName, presets]) => (
              <div className="grid gap-(--section-title-gap)" key={groupName}>
                <div className={SECTION_TITLE_CLASS}>{groupName}</div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {presets.map((preset) => (
                    <button
                      className={PRESET_CARD_CLASS}
                      data-selected={
                        selectedId === preset.id ? "true" : "false"
                      }
                      key={preset.id}
                      onClick={() => setSelectedId(preset.id)}
                      type="button"
                    >
                      <span className="grid gap-0.5">
                        <span className="font-medium">{preset.name}</span>
                        <span className={PRESET_DETAIL_CLASS}>
                          {preset.description}
                        </span>
                      </span>
                      {selectedId === preset.id ? <SelectedCheck /> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <button
                className={PRESET_CARD_CLASS}
                data-selected={
                  selectedId === CUSTOM_ARTBOARD_ID ? "true" : "false"
                }
                onClick={() => setSelectedId(CUSTOM_ARTBOARD_ID)}
                type="button"
              >
                <span className="grid gap-1">
                  <span className="font-medium">Custom Size</span>
                  <span className="flex items-center gap-1.5">
                    <Input
                      aria-label="Custom width"
                      className="w-16"
                      nativeInput
                      onChange={(event) => setCustomWidth(event.target.value)}
                      size="field"
                      value={customWidth}
                    />
                    <span className={PRESET_DETAIL_CLASS}>x</span>
                    <Input
                      aria-label="Custom height"
                      className="w-16"
                      nativeInput
                      onChange={(event) => setCustomHeight(event.target.value)}
                      size="field"
                      value={customHeight}
                    />
                  </span>
                </span>
                {selectedId === CUSTOM_ARTBOARD_ID ? <SelectedCheck /> : null}
              </button>

              <button
                className={PRESET_CARD_CLASS}
                data-selected={selectedId === NO_ARTBOARD_ID ? "true" : "false"}
                onClick={() => setSelectedId(NO_ARTBOARD_ID)}
                type="button"
              >
                <span className="grid gap-0.5">
                  <span className="font-medium">No Artboard</span>
                  <span className={PRESET_DETAIL_CLASS}>Empty pasteboard</span>
                </span>
                {selectedId === NO_ARTBOARD_ID ? <SelectedCheck /> : null}
              </button>
            </div>
          </div>
        </DialogPanel>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            size="chrome"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} size="chrome">
            Create
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
};

const SelectedCheck = () => (
  <CheckIcon className="size-(--chrome-icon) shrink-0 text-primary" />
);
