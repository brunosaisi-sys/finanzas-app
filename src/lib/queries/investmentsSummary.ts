import type { SupabaseClient } from "@supabase/supabase-js";
import { autoSyncFciHoldings } from "@/lib/fciAutoSync";
import { buildPortfolioSeries, type HoldingSnapshot } from "@/lib/finance/portfolioSeries";
import type { PricePoint } from "@/lib/finance/holdingReturn";
import type { Holding } from "@/types";

export type HoldingRow = Holding & { accounts: { name: string } | null };

export interface PortfolioPoint {
  date: string;
  label: string;
  value: number;
}

export interface InvestmentsSummary {
  holdings: HoldingRow[];
  portfolioLinePoints: PortfolioPoint[];
  /** Historial de precios por holding — expuesto para que /inversiones lo
   * reuse en el cálculo de retorno por posición sin re-consultar la tabla. */
  historyByHolding: Map<string, PricePoint[]>;
}

// Sesión J.1.17, TAREA 4: extraído de /inversiones/page.tsx (Sesión J.1.16,
// TAREA 3a) para reusar en Inicio sin duplicar la lógica de auto-sync +
// forward-fill (§8.8 fundamentos) — ambas pantallas necesitan los mismos
// holdings ya sincronizados y la misma serie de evolución del portafolio.
// El cálculo de retorno por posición (returnByHolding/TNA estimada) NO se
// extrae acá porque es exclusivo de la lista detallada de /inversiones.
export async function fetchInvestmentsSummary(
  supabase: SupabaseClient,
  windowStart: Date,
  now: Date
): Promise<InvestmentsSummary> {
  const { data } = await supabase
    .from("holdings")
    .select("*, accounts!holdings_account_id_fkey(name)")
    .order("created_at", { ascending: false });
  const holdings = (data ?? []) as HoldingRow[];

  const updatedPrices = await autoSyncFciHoldings(supabase, holdings);
  for (const h of holdings) {
    if (updatedPrices.has(h.id)) h.current_price = updatedPrices.get(h.id)!;
  }

  let portfolioLinePoints: PortfolioPoint[] = [];
  const historyByHolding = new Map<string, PricePoint[]>();
  if (holdings.length > 0) {
    try {
      const { data: historyRows } = await supabase
        .from("holding_price_history")
        .select("holding_id, price, recorded_at")
        .in("holding_id", holdings.map((h) => h.id));
      for (const row of historyRows ?? []) {
        const arr = historyByHolding.get(row.holding_id) ?? [];
        arr.push({ price: Number(row.price), recorded_at: row.recorded_at });
        historyByHolding.set(row.holding_id, arr);
      }
      const snapshots: HoldingSnapshot[] = holdings.map((h) => ({
        id: h.id,
        quantity: h.quantity,
        fallbackPrice: h.current_price ?? h.avg_buy_price ?? null,
        history: historyByHolding.get(h.id) ?? [],
      }));
      const series = buildPortfolioSeries(snapshots, windowStart, now);
      portfolioLinePoints = series.map((p) => ({
        ...p,
        label: new Date(p.date + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
      }));
    } catch {
      // holding_price_history todavía no existe — sin evolución, no bloquea
    }
  }

  return { holdings, portfolioLinePoints, historyByHolding };
}
