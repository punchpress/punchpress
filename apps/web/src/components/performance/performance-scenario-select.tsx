import { ChevronsUpDownIcon } from "lucide-react";
import { selectTriggerVariants } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PerformanceScenarioOption {
  label: string;
  value: string;
}

export const PerformanceScenarioSelect = ({
  className,
  onValueChange,
  options,
  size = "default",
  value,
}: {
  className?: string;
  onValueChange: (value: string) => void;
  options: PerformanceScenarioOption[];
  size?: "default" | "lg" | "sm";
  value: string;
}) => {
  return (
    <div className="relative min-w-0">
      <select
        className={cn(
          selectTriggerVariants({ size }),
          "appearance-none pr-8",
          className
        )}
        onChange={(event) => onValueChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronsUpDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-80" />
    </div>
  );
};
