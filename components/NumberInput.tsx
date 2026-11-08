import { useEffect, useRef, useState } from "react";
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
  const [text, setText] = useState(value === null ? "" : String(value).replace(".", ","));
  // A value that changed elsewhere — a suggestion following the details just entered — is shown
  // here; what is being typed is left alone.
  const last = useRef(value);
  useEffect(() => {
    if (Object.is(value, last.current)) return;
    setText(value === null ? "" : String(value).replace(".", ","));
    last.current = value;
  }, [value]);
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
        const parsed = normalized && /^\d+(\.\d*)?$/.test(normalized) ? Number(normalized) : null;
        last.current = parsed;
        onChange(parsed);
      }}
    />
  );
}
