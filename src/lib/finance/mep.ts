// Currency conversion utilities using MEP (Mercado Electrónico de Pagos) exchange rate.
// The rate is always user-provided — MEP fluctuates daily and must never be hardcoded.

export function convertViaMep(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  mepRate: number
): number {
  if (mepRate <= 0 || amount <= 0 || fromCurrency === toCurrency) return 0;
  if (fromCurrency === "ARS" && toCurrency === "USD") return amount / mepRate;
  if (fromCurrency === "USD" && toCurrency === "ARS") return amount * mepRate;
  return 0;
}
