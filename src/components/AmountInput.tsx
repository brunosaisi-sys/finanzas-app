"use client";

import { useState } from "react";

interface Props {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

// Input para montos en ARS. Muestra separadores de miles (es-AR) al perder el
// foco; mientras el usuario escribe muestra el número crudo para evitar
// conflictos de cursor con los puntos de separación.
// Sesión J.1.14, TAREA 5: antes solo aceptaba enteros (stripeaba todo no-dígito,
// incluido "." y ","), inconsistente con IncomeForm (type=number step="0.01") y
// con montos reales que sí tienen centavos (ej. cuotas divididas). Acepta hasta
// 2 decimales, con "," o "." como separador decimal (ambos se normalizan a "."
// en el valor interno, que es el que consume parseFloat en los server actions).
// Sesión J.1.19: ese fix arreglaba el parseo, pero `inputMode="numeric"` sigue
// mostrando el teclado tipo-teléfono en iOS (sin tecla "," ni "."), así que en
// un iPhone real seguía siendo imposible tipear decimales — invisible en QA
// porque Playwright escribe el valor directo, sin pasar por el teclado nativo.
// `inputMode="decimal"` es el que sí incluye separador decimal en iOS/Android.
export default function AmountInput({
  value,
  onChange,
  placeholder = "0",
  required,
  className,
}: Props) {
  const [focused, setFocused] = useState(false);

  const num = parseFloat(value);
  const displayValue =
    focused || !value
      ? value
      : !isNaN(num)
      ? new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num)
      : value;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Conservar dígitos y un único separador decimal (. o ,) — el resto se descarta.
    let raw = e.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
    const firstDot = raw.indexOf(".");
    if (firstDot !== -1) {
      raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
      const [intPart, decPart] = raw.split(".");
      raw = `${intPart}.${decPart.slice(0, 2)}`;
    }
    onChange(raw);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
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
