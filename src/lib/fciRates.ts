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

// Fuzzy match: busca por ticker exacto, luego por palabras del nombre (>3 chars).
// Ambigüedad: si múltiples fondos matchean, retorna el primero de la iteración.
// Para matching preciso, nombrar el holding con la clase exacta del feed.
export function matchFCIRate(
  holding: { ticker?: string | null; name: string; asset_type: string },
  rates: Map<string, FciRateEntry>
): FciRateEntry | null {
  if (holding.asset_type !== "fci") return null;
  const needle = (holding.ticker ?? holding.name).toLowerCase();
  if (rates.has(needle)) return rates.get(needle)!;
  const words = needle.split(/\s+/).filter((w) => w.length > 3);
  for (const [key, val] of rates) {
    if (words.length > 0 && words.some((w) => key.includes(w))) return val;
  }
  return null;
}
