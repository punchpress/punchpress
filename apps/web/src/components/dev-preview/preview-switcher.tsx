import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PreviewStore } from "./create-preview-store";

// A small labeled button strip for one dev preview. Alt+Shift+<key> cycles
// forward; adding Ctrl cycles backward.
export const PreviewSwitcher = ({
  className,
  hotkey,
  label,
  store,
}: {
  className?: string;
  hotkey: string;
  label: string;
  store: PreviewStore;
}) => {
  const value = store.useValue();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.altKey && event.shiftKey) ||
        event.metaKey ||
        event.code !== `Key${hotkey}`
      ) {
        return;
      }

      event.preventDefault();
      store.cycle(event.ctrlKey ? -1 : 1);
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [hotkey, store]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-0.5 rounded-md border border-[var(--designer-border-strong)] bg-popover p-0.5",
        className
      )}
      data-testid={`${store.attribute}-switcher`}
      title={`${label} (Alt+Shift+${hotkey})`}
    >
      <span className="px-1.5 font-medium text-[11px] text-muted-foreground">
        {label}
      </span>
      {store.options.map((option) => (
        <Button
          aria-pressed={option.id === value}
          key={option.id}
          onClick={() => store.set(option.id)}
          size="field"
          title={option.description}
          variant={option.id === value ? "secondary" : "ghost"}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
};
