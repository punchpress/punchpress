import { MonitorIcon, MoonIcon, PaletteIcon, SunIcon } from "lucide-react";
import { Dialog, DialogPanel, DialogPopup } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type ThemePreference, useTheme } from "@/theme/theme-provider";

const NAV_SECTIONS = [
  {
    label: "General",
    items: [{ id: "appearance", label: "Appearance", icon: PaletteIcon }],
  },
] as const;

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof SunIcon;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Clean and bright",
    icon: SunIcon,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Easy on the eyes",
    icon: MoonIcon,
  },
  {
    value: "system",
    label: "System",
    description: "Match your OS",
    icon: MonitorIcon,
  },
];

export const SettingsDialog = ({ onOpenChange, open }) => {
  const { theme, setTheme } = useTheme();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup
        bottomStickOnMobile={false}
        className="max-w-5xl"
        showCloseButton
      >
        <DialogPanel className="p-0" scrollFade={false}>
          <div className="grid min-h-[560px] md:grid-cols-[220px_1fr]">
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
                        className="flex items-center gap-2.5 rounded-lg bg-secondary px-2.5 py-2 text-left font-medium text-secondary-foreground text-sm"
                        key={item.id}
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
            <section className="flex flex-col gap-8 px-8 py-7">
              {/* Section header */}
              <div className="space-y-1">
                <h2 className="font-semibold text-foreground text-lg">
                  Appearance
                </h2>
                <p className="text-muted-foreground text-sm">
                  Choose how PunchPress follows your preferred color theme.
                </p>
              </div>

              {/* Theme */}
              <div className="space-y-3">
                <h3 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Theme
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {THEME_OPTIONS.map((option) => {
                    const isActive = theme === option.value;
                    return (
                      <button
                        className={cn(
                          "group relative flex flex-col items-center gap-3 rounded-xl border-2 px-5 py-6 text-center transition-all",
                          isActive
                            ? "border-primary bg-primary/5 shadow-sm dark:border-primary/50 dark:bg-primary/10"
                            : "border-transparent bg-muted/50 hover:bg-muted dark:bg-muted/30 dark:hover:bg-muted/50"
                        )}
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        type="button"
                      >
                        <div
                          className={cn(
                            "flex size-11 items-center justify-center rounded-xl transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted-foreground/10 text-muted-foreground group-hover:bg-muted-foreground/15"
                          )}
                        >
                          <option.icon className="size-5" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={cn(
                              "font-medium text-sm",
                              isActive ? "text-primary" : "text-foreground"
                            )}
                          >
                            {option.label}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {option.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
};
