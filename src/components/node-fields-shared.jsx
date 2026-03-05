import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toSafeHex } from "../editor/math-utils";

export const Section = ({ children, title }) => {
  return (
    <section className="panel-section">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="panel-fields">{children}</div>
        </CardContent>
      </Card>
    </section>
  );
};

export const FieldRow = ({ children, label }) => {
  return (
    <div className="field">
      <Label>{label}</Label>
      <div>{children}</div>
    </div>
  );
};

export const ColorField = ({ onChange, value }) => {
  return (
    <div className="color-field">
      <Input
        className="color-picker-input"
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
