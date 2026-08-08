// Catálogo de precios de CEDEARs — Sesión J.1.8.
//
// Fuente: https://data912.com/live/arg_cedears — API de terceros sin autenticación,
// documentada como datos educativos/no tiempo real (caché ~2hs). Verificado en vivo
// (curl real) antes de integrar: 944 símbolos, cada uno único (sin duplicados),
// campos confirmados { symbol, q_bid, px_bid, px_ask, q_ask, v, q_op, c, pct_change }.
// `c` = último precio operado, en ARS (valor del CEDEAR tal como cotiza en BYMA).
//
// A diferencia del catálogo de fondos FCI (fciCatalog.ts), acá el matching es por
// TICKER EXACTO, no por nombre libre — no hay ambigüedad de fuzzy match: cada símbolo
// del feed es un instrumento distinto y ya es el mismo ticker que el usuario tipearía
// en el campo "Ticker" del formulario (ej. "AAPL"). Nota: BYMA lista variantes del
// mismo subyacente con sufijos (AAPL, AAPLC, AAPLD — settlement distinto), todas
// símbolos ÚNICOS y válidos por separado; no se colapsan entre sí.
import type { Currency } from "@/types";

export interface CedearQuote {
  symbol: string;
  price: number;
  currency: Currency;
  pctChange: number;
}

interface RawData912Quote {
  symbol: string;
  c: number;
  pct_change: number;
}

export async function fetchCedearQuotes(): Promise<CedearQuote[]> {
  const res = await fetch("https://data912.com/live/arg_cedears", {
    next: { revalidate: 7200 },
  });
  if (!res.ok) return [];
  const raw = (await res.json()) as RawData912Quote[];
  return raw
    .filter((r) => typeof r.symbol === "string" && r.c > 0)
    .map((r) => ({
      symbol: r.symbol,
      price: r.c,
      currency: "ARS" as Currency,
      pctChange: r.pct_change,
    }));
}

export function findCedearQuote(
  quotes: CedearQuote[],
  ticker: string
): CedearQuote | null {
  const needle = ticker.trim().toUpperCase();
  if (!needle) return null;
  return quotes.find((q) => q.symbol === needle) ?? null;
}
