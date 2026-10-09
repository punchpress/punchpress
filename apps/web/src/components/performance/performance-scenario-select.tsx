import { ChevronsUpDownIcon } from "lucide-react";
import { selectTriggerVariants } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PerformanceScenarioOption {
  label: string;
  value: string;
}

export const PerformanceScenarioSelect = ({
  onValueChange,
  options,
  value,
}: {
  onValueChange: (value: string) => void;
  options: PerformanceScenarioOption[];
  value: string;
}) => {
  return (
    <div className="relative min-w-0">
      <select
        className={cn(
          selectTriggerVariants({ size: "field" }),
          "appearance-none pe-6"
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
      <ChevronsUpDownIcon className="pointer-events-none absolute end-(--field-px) top-1/2 size-3.5 -translate-y-1/2 opacity-80" />
    </div>
  );
};
