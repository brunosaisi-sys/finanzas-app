import type { PricePoint } from "./holdingReturn";

// Evolución del valor total del portafolio en el tiempo (Sesión J.1.16,
// TAREA 3a) — resuelve el gap confirmado leyendo el prototipo de Claude
// Design: calculaba `invLinePts`/`invLinePath` (función `buildLineChart`)
// pero solo los renderizaba dentro de la tarjeta "Resumen" de Inicio, nunca
// en la propia pantalla de Inversiones.
//
// Documentado en docs/01-fundamentos-teoricos.md §8.8. Es una aproximación
// declarada, no TWR (§8.2, pendiente de `holding_events` — Sesión J.2): la
// app no guarda `quantity` histórica, solo la actual, y no todo holding tiene
// historial de precio (`holding_price_history`, migración 022 — hoy solo lo
// llenan los FCI con auto-sync). El método:
//
// 1. Fechas de muestra = unión de todas las `recorded_at` reales dentro de la
//    ventana, de CUALQUIER holding — nunca se inventan fechas.
// 2. En cada fecha de muestra, el precio de cada holding es el último precio
//    conocido de SU PROPIO historial en o antes de esa fecha (forward-fill).
//    Si un holding no tiene ningún precio histórico en o antes de esa fecha
//    (o directamente no tiene historial — típico de acciones/CEDEARs con
//    precio manual), se usa su precio actual como aproximación constante
//    hacia atrás — declarado explícitamente, nunca oculto.
// 3. La cantidad (`quantity`) usada es siempre la ACTUAL — la app no trackea
//    cambios de cantidad en el tiempo (mismo gap documentado en lección §26).
//
// Si ningún holding tiene al menos 2 puntos de historial real dentro de la
// ventana, no hay ninguna variación real que mostrar: devuelve `[]` en vez de
// una línea plana inventada (misma regla dura de `calcHoldingReturn`).

export interface HoldingSnapshot {
  id: string;
  quantity: number;
  /** current_price si existe, si no avg_buy_price — último recurso cuando no hay historial. */
  fallbackPrice: number | null;
  history: PricePoint[];
}

export interface PortfolioPoint {
  date: string;
  value: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateOnly(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function buildPortfolioSeries(
  holdings: HoldingSnapshot[],
  windowStart: Date,
  now: Date = new Date()
): PortfolioPoint[] {
  const startMs = windowStart.getTime();
  const nowMs = now.getTime();

  const sortedHistories = new Map<string, PricePoint[]>();
  const sampleDates = new Set<string>();
  let realPointsInWindow = 0;

  for (const h of holdings) {
    const sorted = [...h.history].sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
    sortedHistories.set(h.id, sorted);
    for (const p of sorted) {
      const t = Date.parse(p.recorded_at);
      if (t >= startMs && t <= nowMs) {
        sampleDates.add(p.recorded_at.slice(0, 10));
        realPointsInWindow++;
      }
    }
  }

  // Regla dura: sin al menos 2 puntos reales dentro de la ventana, no hay
  // variación que mostrar — nunca se inventa una línea plana.
  if (realPointsInWindow < 2) return [];

  sampleDates.add(toDateOnly(windowStart));
  sampleDates.add(toDateOnly(now));
  const dates = Array.from(sampleDates).sort();

  return dates.map((dateStr) => {
    const dMs = Date.parse(dateStr + "T23:59:59");
    let value = 0;
    for (const h of holdings) {
      const history = sortedHistories.get(h.id)!;
      let price: number | null = null;
      for (const p of history) {
        if (Date.parse(p.recorded_at) <= dMs) price = p.price;
        else break;
      }
      if (price === null) price = h.fallbackPrice;
      if (price !== null) value += h.quantity * price;
    }
    return { date: dateStr, value };
  });
}
