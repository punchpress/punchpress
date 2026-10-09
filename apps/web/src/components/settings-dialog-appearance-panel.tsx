import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ThemePreference, useTheme } from "@/theme/theme-provider";

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

export const SettingsDialogAppearancePanel = () => {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <div className="space-y-1">
        <h2 className="text-(length:--dialog-title-text) font-semibold text-foreground">
          Appearance
        </h2>
        <p className="text-(length:--chrome-text) text-muted-foreground">
          Choose how PunchPress follows your preferred color theme.
        </p>
      </div>

      <div className="space-y-(--section-title-gap)">
        <h3 className="text-(length:--section-title-text) font-semibold text-(--section-title-color) tracking-(--section-title-tracking) [text-transform:var(--section-title-case)]">
          Theme
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((option) => {
            const isActive = theme === option.value;

            return (
              <button
                className={cn(
                  "group relative flex flex-col items-center gap-2 rounded-(--surface-radius) border px-3 py-3 text-center",
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
                    "flex size-7 items-center justify-center rounded-(--chrome-radius)",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted-foreground/10 text-muted-foreground group-hover:bg-muted-foreground/15"
                  )}
                >
                  <option.icon className="size-(--chrome-icon)" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      "text-(length:--chrome-text) font-medium",
                      isActive ? "text-primary" : "text-foreground"
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="text-(length:--chrome-text-sm) text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
