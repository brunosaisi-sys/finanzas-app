// Utilidades para el feed de ArgentinaDatos FCI.
// La API retorna vcp (Valor de Cuotaparte), NO tna.
// Documentado en lecciones-aprendidas §17.

export type FciFondo = {
  fondo: string;
  horizonte: string | null;
  fecha: string | null;
  vcp: number | null;
};

export type FciRateEntry = { vcp: number; fecha: string };

const FCI_CATEGORIES = [
  "mercadoDinero",
  "rentaFija",
  "rentaVariable",
  "rentaMixta",
] as const;

// Fetches VCP for all FCI categories. Cache: 6 horas.
// Sólo incluye entradas con vcp != null y fecha != null.
export async function fetchAllFCIRates(): Promise<Map<string, FciRateEntry>> {
  const map = new Map<string, FciRateEntry>();
  await Promise.allSettled(
    FCI_CATEGORIES.map(async (cat) => {
      try {
        const res = await fetch(
          `https://api.argentinadatos.com/v1/finanzas/fci/${cat}/ultimo`,
          { next: { revalidate: 21600 } }
        );
        if (!res.ok) return;
        const data: FciFondo[] = await res.json();
        for (const f of data) {
          if (f.vcp != null && f.fecha != null) {
            map.set(f.fondo.toLowerCase(), { vcp: f.vcp, fecha: f.fecha });
          }
        }
      } catch {
        // silent fail per category — página no se rompe si el feed falla
      }
    })
  );
  return map;
}

// Fuzzy match: busca por nombre exacto, luego por TODAS las palabras del nombre (>3 chars).
// Requiere que TODAS las palabras matcheen (no alguna) porque gestoras como Cocos tienen
// decenas de fondos ("Cocos Ahorro", "Cocos Acciones", "Cocos Rendimiento", "Cocos Dólares
// Plus", etc.) que comparten la primera palabra — con `.some()` cualquiera de ellos podía
// matchear primero y sincronizar el holding con el VCP de un fondo equivocado.
// Ambigüedad remanente: entre clases del mismo fondo (A/B/C/D), retorna la primera de la
// iteración. Para matching preciso, nombrar el holding con la clase exacta del feed.
//
// Sesión J.1.14, TAREA 1 — NUNCA usar `ticker` acá. A diferencia de CEDEARs (donde el
// ticker ES el identificador real del feed), en FCI el campo Ticker de HoldingForm es
// texto libre opcional sin relación con el feed de ArgentinaDatos (que solo expone
// `fondo`, no ningún código corto). Antes esta función priorizaba `ticker` sobre `name`
// (`holding.ticker ?? holding.name`): si el usuario cargaba CUALQUIER valor en Ticker al
// crear el holding a mano, el match fallaba silenciosamente para siempre — root cause
// confirmado (reproducido con REST real) de que `holding_price_history` quedaba en 0
// filas en producción a pesar de que el auto-sync "funcionaba" en las sesiones previas
// (que siempre probaron con ticker vacío). Ver docs/lecciones-aprendidas.md §31.
export function matchFCIRate(
  holding: { name: string; asset_type: string },
  rates: Map<string, FciRateEntry>
): FciRateEntry | null {
  if (holding.asset_type !== "fci") return null;
  const needle = holding.name.toLowerCase();
  if (rates.has(needle)) return rates.get(needle)!;
  const words = needle.split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) return null;
  for (const [key, val] of rates) {
    if (words.every((w) => key.includes(w))) return val;
  }
  return null;
}
