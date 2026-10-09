import { BugIcon, PaletteIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogPopup } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SettingsDialogAppearancePanel } from "./settings-dialog-appearance-panel";
import { SettingsDialogDebugPanel } from "./settings-dialog-debug-panel";

const NAV_SECTIONS = [
  {
    label: "General",
    items: [{ id: "appearance", label: "Appearance", icon: PaletteIcon }],
  },
  {
    label: "Developer",
    items: [{ id: "debug", label: "Debug", icon: BugIcon }],
  },
] as const;

const DEFAULT_SECTION_ID = "appearance";

export const SettingsDialog = ({ onOpenChange, open }) => {
  const [activeSectionId, setActiveSectionId] = useState(DEFAULT_SECTION_ID);
  let sectionContent = <SettingsDialogAppearancePanel />;

  if (activeSectionId === "debug") {
    sectionContent = <SettingsDialogDebugPanel isActive />;
  }

  useEffect(() => {
    if (open) {
      return;
    }

    setActiveSectionId(DEFAULT_SECTION_ID);
  }, [open]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup
        bottomStickOnMobile={false}
        className="max-w-3xl md:h-[480px]"
        showCloseButton
      >
        <DialogPanel className="p-0 md:h-full" scrollFade={false}>
          <div className="grid min-h-[480px] md:h-full md:min-h-0 md:grid-cols-[180px_1fr]">
            {/* Left nav */}
            <aside className="border-b bg-muted/40 p-(--dialog-pad) md:border-r md:border-b-0">
              <nav
                aria-label="Settings sections"
                className="flex flex-col gap-4"
              >
                {NAV_SECTIONS.map((section) => (
                  <div className="flex flex-col gap-0.5" key={section.label}>
                    <span className="text-(length:--section-title-text) px-(--menu-item-px) pb-(--section-title-gap) font-semibold text-(--section-title-color) tracking-(--section-title-tracking) [text-transform:var(--section-title-case)]">
                      {section.label}
                    </span>
                    {section.items.map((item) => (
                      <button
                        aria-pressed={activeSectionId === item.id}
                        className={cn(
                          "text-(length:--chrome-text) flex h-(--menu-item-height) items-center gap-2 rounded-(--chrome-radius) px-(--menu-item-px) text-left font-medium",
                          activeSectionId === item.id
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                        key={item.id}
                        onClick={() => setActiveSectionId(item.id)}
                        type="button"
                      >
                        <item.icon className="size-(--chrome-icon) opacity-60" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <section className="flex min-h-0 flex-col gap-5 overflow-y-auto p-(--dialog-pad) pe-[calc(var(--dialog-pad)*2)]">
              {sectionContent}
            </section>
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
};
