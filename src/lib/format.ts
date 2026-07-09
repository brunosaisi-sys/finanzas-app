// Muestra un monto numérico crudo como string ARS formateado (sin símbolo)
// Útil como preview debajo de inputs numéricos en formularios
export function formatInputAmount(raw: string, currency: "ARS" | "USD" = "ARS"): string {
  const num = parseFloat(raw.replace(",", "."));
  if (isNaN(num) || num === 0 || raw === "") return "";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrency(amount: number, currency: "ARS" | "USD"): string {
  return currency === "ARS" ? formatARS(amount) : formatUSD(amount);
}
