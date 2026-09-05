import { useState } from "react";
import { TextInput } from "./ui";
/** Keeps partial keyboard input (e.g. 70.) without putting strings in the domain model. */
export function NumberInput({
  value,
  onChange,
  label,
  error,
  hint,
  decimal = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  error?: string;
  hint?: string;
  decimal?: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  return (
    <TextInput
      label={label}
      hint={hint}
      error={error}
      value={text}
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      maxLength={10}
      onChangeText={(raw) => {
        setText(raw);
        const normalized = raw.trim().replace(",", ".");
        onChange(
          normalized && /^\d+(\.\d*)?$/.test(normalized)
            ? Number(normalized)
            : null,
        );
      }}
    />
  );
}
