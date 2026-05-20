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
import {
  ARTBOARD_PRESETS,
  DEFAULT_CUSTOM_ARTBOARD_SIZE,
} from "./new-file-presets";

const NO_ARTBOARD_ID = "none";
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
      <DialogPopup bottomStickOnMobile={false} className="max-w-[620px]">
        <DialogHeader>
          <DialogTitle>New File</DialogTitle>
          <DialogDescription>
            Start with a production surface or an empty pasteboard.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div className="grid gap-4">
            {[...presetGroups.entries()].map(([groupName, presets]) => (
              <div className="grid gap-2" key={groupName}>
                <div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
                  {groupName}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {presets.map((preset) => (
                    <button
                      className="flex min-h-[74px] items-start justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-selected:border-primary data-selected:bg-primary/8"
                      data-selected={
                        selectedId === preset.id ? "true" : "false"
                      }
                      key={preset.id}
                      onClick={() => setSelectedId(preset.id)}
                      type="button"
                    >
                      <span className="grid gap-1">
                        <span className="font-medium text-sm">
                          {preset.name}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {preset.description}
                        </span>
                      </span>
                      {selectedId === preset.id ? (
                        <CheckIcon className="size-4 text-primary" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                className="flex min-h-[74px] items-start justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-selected:border-primary data-selected:bg-primary/8"
                data-selected={
                  selectedId === CUSTOM_ARTBOARD_ID ? "true" : "false"
                }
                onClick={() => setSelectedId(CUSTOM_ARTBOARD_ID)}
                type="button"
              >
                <span className="grid gap-2">
                  <span className="font-medium text-sm">Custom Size</span>
                  <span className="flex items-center gap-2 text-xs">
                    <input
                      aria-label="Custom width"
                      className="h-7 w-20 rounded-md border border-border bg-background px-2"
                      onChange={(event) => setCustomWidth(event.target.value)}
                      value={customWidth}
                    />
                    <span className="text-muted-foreground">x</span>
                    <input
                      aria-label="Custom height"
                      className="h-7 w-20 rounded-md border border-border bg-background px-2"
                      onChange={(event) => setCustomHeight(event.target.value)}
                      value={customHeight}
                    />
                  </span>
                </span>
                {selectedId === CUSTOM_ARTBOARD_ID ? (
                  <CheckIcon className="size-4 text-primary" />
                ) : null}
              </button>

              <button
                className="flex min-h-[74px] items-start justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-selected:border-primary data-selected:bg-primary/8"
                data-selected={selectedId === NO_ARTBOARD_ID ? "true" : "false"}
                onClick={() => setSelectedId(NO_ARTBOARD_ID)}
                type="button"
              >
                <span className="grid gap-1">
                  <span className="font-medium text-sm">No Artboard</span>
                  <span className="text-muted-foreground text-xs">
                    Empty pasteboard
                  </span>
                </span>
                {selectedId === NO_ARTBOARD_ID ? (
                  <CheckIcon className="size-4 text-primary" />
                ) : null}
              </button>
            </div>
          </div>
        </DialogPanel>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
};
