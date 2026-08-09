// Catálogo de fondos FCI por institución — agrupa las clases (A/B/C/D...) de un
// mismo fondo en una sola opción para el selector de /cuentas (Sesión J.1.7).
//
// Investigación previa (verificada contra el feed real, no asumida — ver
// docs/lecciones-aprendidas.md §21): de las ~32 instituciones en institutions.ts,
// solo 5 tienen fondos cuyo nombre EMPIEZA con una palabra identificable de la
// institución: Cocos Capital, Mercado Pago, Balanz, Bull Market Brokers, IOL.
// Ningún banco tradicional (Galicia, BBVA, Santander, etc.) matchea por su nombre
// de marca al consumidor — sus fondos usan nombres de sociedad gerente distintos
// (ej. "Fima" para Galicia, "1822 Raíces" para BBVA) que NO se pueden confirmar
// mecánicamente desde este feed (no expone un campo "gestora"), así que no se
// incluyen sin verificación externa.
//
// Nota sobre "mercado": un substring simple matchea también "Multimercado" de
// Consultatio/Delta/Galileo/Parakeet/Toronto Trust (falso positivo). Se usa
// matching por PREFIJO (el nombre EMPIEZA con la palabra), no por substring.

import type { Currency } from "@/types";

const FCI_CATEGORIES = [
  "mercadoDinero",
  "rentaFija",
  "rentaVariable",
  "rentaMixta",
] as const;
export type FciCategory = (typeof FCI_CATEGORIES)[number];

export const RISK_BY_CATEGORY: Record<FciCategory, string> = {
  mercadoDinero: "Bajo",
  rentaFija: "Medio-bajo",
  rentaMixta: "Medio",
  rentaVariable: "Alto",
};

// institutionId (de institutions.ts) → prefijos verificados contra el feed.
const INSTITUTION_FCI_PREFIXES: Record<string, string[]> = {
  cocos: ["cocos"],
  mercadopago: ["mercado fondo"],
  balanz: ["balanz"],
  bullmarket: ["bull market"],
  iol: ["iol"],
};

// Para reconocer a qué institución pertenece una cuenta a partir de su nombre
// (las cuentas no guardan institutionId — se crean con el nombre de la institución
// como accounts.name). Mismo set de 5 instituciones verificadas arriba.
const INSTITUTION_ACCOUNT_NAME_HINTS: { institutionId: string; hints: string[] }[] = [
  { institutionId: "cocos", hints: ["cocos"] },
  { institutionId: "mercadopago", hints: ["mercado pago"] },
  { institutionId: "balanz", hints: ["balanz"] },
  { institutionId: "bullmarket", hints: ["bull market"] },
  { institutionId: "iol", hints: ["invertironline", "iol"] },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function findFciInstitutionForAccountName(accountName: string): string | null {
  const n = normalize(accountName);
  for (const { institutionId, hints } of INSTITUTION_ACCOUNT_NAME_HINTS) {
    if (hints.some((h) => n.includes(normalize(h)))) return institutionId;
  }
  return null;
}

type RawFciFund = {
  fondo: string;
  vcp: number | null;
  fecha: string | null;
  patrimonio: number | null;
  categoria: FciCategory;
};

type RawCategoryFund = {
  fondo: string;
  vcp: number | null;
  fecha: string | null;
  patrimonio: number | null;
};

// Un intento + un reintento por categoría. Mercado Pago tiene un solo fondo en
// UNA sola categoría (mercadoDinero) — a diferencia de Cocos/Balanz/Bull Market/IOL,
// que aparecen repartidos en varias, así que un solo fetch fallido de esa categoría
// vacía TODO su catálogo (fciCatalog.length === 0), mientras que a las otras
// instituciones les alcanza con las categorías que sí respondieron. Reportado por
// el usuario como "Mercado Pago no muestra su catálogo, Cocos sí" — no se pudo
// reproducir de forma determinística (la causa más probable es un fallo transitorio
// puntual del feed, no un bug de matching — ver docs/lecciones-aprendidas.md §26).
// Un reintento reduce la fragilidad sin ocultar un fallo persistente del feed.
async function fetchFciCategoryWithRetry(cat: FciCategory): Promise<RawCategoryFund[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(
        `https://api.argentinadatos.com/v1/finanzas/fci/${cat}/ultimo`,
        { next: { revalidate: 21600 } }
      );
      if (res.ok) return await res.json();
    } catch {
      // intento fallido — se reintenta una vez más antes de rendirse
    }
  }
  return [];
}

// Un solo fetch de las 4 categorías — se reutiliza para agrupar N instituciones
// sin repetir requests (Next.js cachea 6h por URL, pero evitamos incluso eso).
export async function fetchAllFciFundsRaw(): Promise<RawFciFund[]> {
  const all: RawFciFund[] = [];
  await Promise.allSettled(
    FCI_CATEGORIES.map(async (cat) => {
      const data = await fetchFciCategoryWithRetry(cat);
      for (const f of data) {
        all.push({ ...f, categoria: cat });
      }
    })
  );
  return all;
}

export type FciFundGroup = {
  fundFamily: string; // nombre limpio, sin " - Clase X" — lo que ve el usuario
  representativeName: string; // nombre EXACTO del feed de la clase representativa (para crear el holding)
  category: FciCategory;
  risk: string;
  vcp: number;
  fecha: string;
  patrimonio: number;
  currency: Currency;
  return30d?: number | null; // adjuntado aparte por el caller (requiere holding_price_history propio)
};

// Agrupa las clases de un mismo fondo (A/B/C/D) en una sola opción, eligiendo
// como representativa la de MAYOR patrimonio (descartando patrimonio=0 salvo que
// sea la única clase disponible). Heurística, no certeza — clases con más
// patrimonio suelen ser las más usadas por clientes minoristas, pero no hay
// garantía de que sea la clase exacta del usuario.
export function groupFundsForInstitution(
  raw: RawFciFund[],
  institutionId: string
): FciFundGroup[] {
  const prefixes = INSTITUTION_FCI_PREFIXES[institutionId];
  if (!prefixes || prefixes.length === 0) return [];

  const matches = raw.filter((f) => {
    const n = normalize(f.fondo);
    return prefixes.some((p) => n.startsWith(normalize(p)));
  });

  const groups = new Map<string, RawFciFund[]>();
  for (const f of matches) {
    const family = f.fondo.replace(/\s*-\s*Clase.*$/i, "").trim();
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family)!.push(f);
  }

  const result: FciFundGroup[] = [];
  for (const [family, entries] of groups) {
    const valid = entries.filter((e) => e.vcp != null && e.fecha != null);
    if (valid.length === 0) continue;
    const withPatrimonio = valid.filter((e) => (e.patrimonio ?? 0) > 0);
    const pool = withPatrimonio.length > 0 ? withPatrimonio : valid;
    const rep = pool.reduce((best, e) =>
      (e.patrimonio ?? 0) > (best.patrimonio ?? 0) ? e : best
    );
    result.push({
      fundFamily: family,
      representativeName: rep.fondo,
      category: rep.categoria,
      risk: RISK_BY_CATEGORY[rep.categoria],
      vcp: rep.vcp!,
      fecha: rep.fecha!,
      patrimonio: rep.patrimonio ?? 0,
      // Heurística: si el nombre menciona dólares, el fondo está en USD.
      currency: /d[oó]lar|usd/i.test(family) ? "USD" : "ARS",
    });
  }

  return result.sort((a, b) => b.patrimonio - a.patrimonio);
}
