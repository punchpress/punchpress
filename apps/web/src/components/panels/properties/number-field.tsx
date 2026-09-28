import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface NumberFieldProps {
  min?: number;
  onValueChange: (value: number) => void;
  placeholder?: string;
  value: number;
}

const toDisplayValue = (value: number) => {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Math.round(value).toString();
};

const parseDraftValue = (draft: string) => {
  if (draft.trim() === "") {
    return null;
  }

  const nextValue = Number(draft);

  return Number.isFinite(nextValue) ? nextValue : null;
};

const normalizeValue = (value: number, min?: number) => {
  return typeof min === "number" ? Math.max(min, value) : value;
};

export const NumberField = ({
  min,
  onValueChange,
  placeholder,
  value,
}: NumberFieldProps) => {
  const [draft, setDraft] = useState(toDisplayValue(value));
  const [isFocused, setIsFocused] = useState(false);

  const commitDraft = () => {
    const nextValue = parseDraftValue(draft);

    if (nextValue === null) {
      setDraft(toDisplayValue(value));
      return;
    }

    const normalizedValue = normalizeValue(nextValue, min);

    if (normalizedValue !== value) {
      onValueChange(normalizedValue);
    }

    setDraft(toDisplayValue(normalizedValue));
  };

  const cancelDraft = () => {
    setDraft(toDisplayValue(value));
  };

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
        commitDraft();
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        const nextValue = parseDraftValue(nextDraft);

        setDraft(nextDraft);

        if (nextValue === null) {
          return;
        }

        onValueChange(normalizeValue(nextValue, min));
      }}
      onFocus={() => setIsFocused(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          cancelDraft();
          event.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
      type="text"
      value={draft}
    />
  );
};
