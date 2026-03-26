import { ColorPickerField } from "@/components/ui/color-picker/color-picker-field";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Section = ({ children, className, title }) => {
  return (
    <section className={cn("py-3 first:pt-0 last:pb-0", className)}>
      <h3 className="mb-2.5 font-semibold text-[12px] text-foreground/70 tracking-[-0.01em]">
        {title}
      </h3>
      <div className="grid gap-2">{children}</div>
    </section>
  );
};

const ROW_GRID = "grid grid-cols-[60px_24px_minmax(0,1fr)] items-center";
const ROW_LABEL = "select-none text-[12px] text-foreground/40";

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

export const ColorField = ({ onChange, placeholder, value }) => {
  return (
    <ColorPickerField
      onChange={onChange}
      placeholder={placeholder}
      value={value}
    />
  );
};
