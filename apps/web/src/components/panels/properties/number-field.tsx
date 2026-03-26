import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

const toDisplayValue = (value) => {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Math.round(value).toString();
};

export const NumberField = ({ min, onValueChange, placeholder, value }) => {
  const [draft, setDraft] = useState(toDisplayValue(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isFocused) {
      return;
    }

    setDraft(toDisplayValue(value));
  }, [isFocused, value]);

  return (
    <Input
      inputMode="decimal"
      nativeInput
      onBlur={() => {
        setIsFocused(false);
        setDraft(toDisplayValue(value));
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        const nextValue = Number(nextDraft);

        setDraft(nextDraft);

        if (!Number.isFinite(nextValue)) {
          return;
        }

        onValueChange(
          typeof min === "number" ? Math.max(min, nextValue) : nextValue
        );
      }}
      onFocus={() => setIsFocused(true)}
      placeholder={placeholder}
      type="text"
      value={draft}
    />
  );
};
