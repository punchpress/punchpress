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
        <h2 className="font-semibold text-foreground text-lg">Appearance</h2>
        <p className="text-muted-foreground text-sm">
          Choose how PunchPress follows your preferred color theme.
        </p>
      </div>

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
                  "group relative flex flex-col items-center gap-3 rounded-xl border-2 px-5 py-6 text-center",
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
                    "flex size-11 items-center justify-center rounded-xl",
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
    </>
  );
};
