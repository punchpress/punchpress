import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DENSITY_DIRECTIONS } from "./density-directions";
import { cycleDensity, setDensity, useDensity } from "./density-store";

// Dev-only picker for comparing panel density directions. Alt+Shift+D cycles
// forward, Alt+Shift+A backward.
export const DensitySwitcher = () => {
  const density = useDensity();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.altKey && event.shiftKey) || event.metaKey || event.ctrlKey) {
        return;
      }

      if (event.code === "KeyD" || event.code === "KeyA") {
        event.preventDefault();
        cycleDensity(event.code === "KeyD" ? 1 : -1);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  return (
    <div
      className="absolute bottom-4 left-4 z-30 flex items-center gap-0.5 rounded-xl border border-[var(--designer-border)] bg-[var(--designer-surface)] p-0.5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]"
      data-testid="density-switcher"
      title="Panel density (Alt+Shift+D)"
    >
      <span className="px-1.5 font-medium text-[11px] text-muted-foreground">
        Density
      </span>
      {DENSITY_DIRECTIONS.map((direction) => (
        <Button
          aria-pressed={direction.id === density}
          key={direction.id}
          onClick={() => setDensity(direction.id)}
          size="xs"
          title={direction.description}
          variant={direction.id === density ? "secondary" : "ghost"}
        >
          {direction.label}
        </Button>
      ))}
    </div>
  );
};
