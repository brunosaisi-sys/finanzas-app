// Retorno simple de un holding a partir de su histórico propio de precios
// (holding_price_history, migración 022). Documentado en
// docs/01-fundamentos-teoricos.md §8.5 — es el insumo de datos que TWR (§8.2) va
// a necesitar en Sesión J.2, pero NO es TWR: es un retorno punto-a-punto entre el
// precio más reciente y el precio más antiguo disponible dentro de la ventana de
// N días, sin encadenamiento geométrico de sub-períodos (porque todavía no se
// registran flujos de aportes/retiros).
//
// Si no hay al menos dos puntos de precio con el más antiguo dentro de la ventana,
// devuelve null explícitamente — nunca estima ni inventa un valor (regla del proyecto).

export type PricePoint = { price: number; recorded_at: string };

const DEFAULT_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calcHoldingReturn(
  history: PricePoint[],
  windowDays: number = DEFAULT_WINDOW_DAYS,
  now: Date = new Date()
): number | null {
  if (history.length < 2) return null;

  const sorted = [...history].sort(
    (a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at)
  );
  const latest = sorted[sorted.length - 1];
  const cutoffMs = now.getTime() - windowDays * MS_PER_DAY;

  const inWindow = sorted.filter(
    (p) => p.recorded_at !== latest.recorded_at && Date.parse(p.recorded_at) >= cutoffMs
  );
  if (inWindow.length === 0) return null;

  const oldest = inWindow[0];
  if (oldest.price === 0) return null;

  return (latest.price - oldest.price) / oldest.price;
}

// Proyección lineal del retorno de 30 días a un año (docs/01-fundamentos-teoricos.md
// §8.7) — "a este ritmo, así vendría rindiendo en un año", igual al criterio que
// muestran apps de referencia (Mercado Pago, Cocos). NO es una tasa garantizada:
// es el desempeño reciente escalado, no un promedio ni una proyección compuesta.
// Si no hay retorno de 30 días (historial insuficiente), no hay nada que anualizar.
export function calcAnnualizedReturn(return30d: number | null): number | null {
  if (return30d === null) return null;
  return return30d * (365 / 30);
}
