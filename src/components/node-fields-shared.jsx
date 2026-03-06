import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toSafeHex } from "../editor/math-utils";

export const Section = ({ children, className, title }) => {
  return (
    <section className={cn("py-3 first:pt-0 last:pb-0", className)}>
      <h3 className="mb-2.5 font-semibold text-[12px] text-black/70 tracking-[-0.01em]">
        {title}
      </h3>
      <div className="grid gap-2">{children}</div>
    </section>
  );
};

const ROW_GRID = "grid grid-cols-[60px_24px_minmax(0,1fr)] items-center";
const ROW_LABEL = "select-none text-[12px] text-black/40";

export const FieldRow = ({ action, children, label }) => {
  return (
    <div className={ROW_GRID}>
      <Label className={ROW_LABEL}>{label}</Label>
      <div className="flex items-center justify-center">{action}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
};

export const PairedRow = ({ action, children, label }) => {
  return (
    <div className={ROW_GRID}>
      <Label className={ROW_LABEL}>{label}</Label>
      <div className="flex items-center justify-center">{action}</div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
};

export const ColorField = ({ onChange, value }) => {
  return (
    <div className="flex items-center gap-2">
      <Input
        className="w-9 min-w-9"
        nativeInput
        onChange={(event) => onChange(event.target.value)}
        type="color"
        value={toSafeHex(value)}
      />
      <Input
        nativeInput
        onBlur={(event) => onChange(toSafeHex(event.target.value))}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
};
