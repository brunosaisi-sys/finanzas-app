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

// Fuzzy match: busca por ticker exacto, luego por TODAS las palabras del nombre (>3 chars).
// Requiere que TODAS las palabras matcheen (no alguna) porque gestoras como Cocos tienen
// decenas de fondos ("Cocos Ahorro", "Cocos Acciones", "Cocos Rendimiento", "Cocos Dólares
// Plus", etc.) que comparten la primera palabra — con `.some()` cualquiera de ellos podía
// matchear primero y sincronizar el holding con el VCP de un fondo equivocado.
// Ambigüedad remanente: entre clases del mismo fondo (A/B/C/D), retorna la primera de la
// iteración. Para matching preciso, nombrar el holding con la clase exacta del feed.
export function matchFCIRate(
  holding: { ticker?: string | null; name: string; asset_type: string },
  rates: Map<string, FciRateEntry>
): FciRateEntry | null {
  if (holding.asset_type !== "fci") return null;
  const needle = (holding.ticker ?? holding.name).toLowerCase();
  if (rates.has(needle)) return rates.get(needle)!;
  const words = needle.split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) return null;
  for (const [key, val] of rates) {
    if (words.every((w) => key.includes(w))) return val;
  }
  return null;
}
