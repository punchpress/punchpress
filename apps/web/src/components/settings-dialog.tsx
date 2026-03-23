import { BugIcon, PaletteIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogPopup } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SettingsDialogAppearancePanel } from "./settings-dialog-appearance-panel";
import { SettingsDialogDebugPanel } from "./settings-dialog-debug-panel";
import { SettingsDialogPerformancePanel } from "./settings-dialog-performance-panel";

const NAV_SECTIONS = [
  {
    label: "General",
    items: [{ id: "appearance", label: "Appearance", icon: PaletteIcon }],
  },
  {
    label: "Developer",
    items: [
      { id: "performance", label: "Performance", icon: BugIcon },
      { id: "debug", label: "Debug", icon: BugIcon },
    ],
  },
] as const;

const DEFAULT_SECTION_ID = "appearance";

export const SettingsDialog = ({ onOpenChange, open }) => {
  const [activeSectionId, setActiveSectionId] = useState(DEFAULT_SECTION_ID);
  let sectionContent = <SettingsDialogAppearancePanel />;

  if (activeSectionId === "performance") {
    sectionContent = <SettingsDialogPerformancePanel />;
  } else if (activeSectionId === "debug") {
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
        className="max-w-5xl md:h-[560px]"
        showCloseButton
      >
        <DialogPanel className="p-0 md:h-full" scrollFade={false}>
          <div className="grid min-h-[560px] md:h-full md:min-h-0 md:grid-cols-[220px_1fr]">
            {/* Left nav */}
            <aside className="border-b bg-muted/40 px-3 py-5 md:border-r md:border-b-0">
              <nav
                aria-label="Settings sections"
                className="flex flex-col gap-5"
              >
                {NAV_SECTIONS.map((section) => (
                  <div className="flex flex-col gap-0.5" key={section.label}>
                    <span className="px-2.5 pb-1.5 font-semibold text-[11px] text-muted-foreground/70 uppercase tracking-wider">
                      {section.label}
                    </span>
                    {section.items.map((item) => (
                      <button
                        aria-pressed={activeSectionId === item.id}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left font-medium text-sm",
                          activeSectionId === item.id
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                        key={item.id}
                        onClick={() => setActiveSectionId(item.id)}
                        type="button"
                      >
                        <item.icon className="size-4 opacity-60" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <section className="flex min-h-0 flex-col gap-8 overflow-y-auto px-8 py-7">
              {sectionContent}
            </section>
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
};
