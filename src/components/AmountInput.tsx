"use client";

import { useState } from "react";

interface Props {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

// Input para montos enteros en ARS. Muestra separadores de miles (es-AR) al
// perder el foco; mientras el usuario escribe muestra el número crudo para
// evitar conflictos de cursor con los puntos de separación.
export default function AmountInput({
  value,
  onChange,
  placeholder = "0",
  required,
  className,
}: Props) {
  const [focused, setFocused] = useState(false);

  const num = parseInt(value, 10);
  const displayValue =
    focused || !value
      ? value
      : !isNaN(num)
      ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(num)
      : value;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Conservar solo dígitos — montos ARS son enteros
    const digits = e.target.value.replace(/\D/g, "");
    onChange(digits);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      required={required}
      value={displayValue}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      className={className}
    />
  );
}
