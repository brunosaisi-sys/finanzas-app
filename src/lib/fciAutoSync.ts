// Auto-sync de VCP para holdings FCI vinculados a cuentas.
// Diseño: la caché de 6h de fetchAllFCIRates ya actúa como throttle natural.
// El RPC solo se llama si vcp != current_price → cero escrituras innecesarias.
// Para una app single-user, esto es suficiente (no se necesita columna last_synced_at).
// Documentado en CLAUDE.md §Sesión J.1.5.
//
// Sesión J.1.7: además del sync de balance, registra el precio en
// holding_price_history con la fecha REAL de cotización del feed (rate.fecha),
// no la fecha de hoy — así el histórico refleja cuándo cotizó el fondo, no cuándo
// corrió el sync. Aditivo: no reemplaza holdings.current_price. Si la tabla todavía
// no existe (migración 022 pendiente de ejecución manual en Supabase — no hay
// service_role key disponible, ver lecciones-aprendidas §9), el insert falla en
// silencio y el sync de balance sigue funcionando igual.

import { fetchAllFCIRates, matchFCIRate } from "./fciRates";

type FciHoldingForSync = {
  id: string;
  name: string;
  ticker: string | null;
  asset_type: string;
  current_price: number | null;
};

type SupabaseLike = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ error: unknown; data?: unknown }>;
  from: (table: string) => {
    upsert: (
      values: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => PromiseLike<{ error: unknown }>;
  };
};

/**
 * Compara VCP del feed de ArgentinaDatos con current_price almacenado.
 * Para cada holding FCI donde difieren, llama sync_holding_balance (RPC atómica).
 * Silencia errores — la página siempre renderiza, incluso si el feed falla.
 *
 * @returns Map holdingId → nuevo vcp para los holdings que fueron actualizados.
 */
export async function autoSyncFciHoldings(
  supabase: SupabaseLike,
  holdings: FciHoldingForSync[]
): Promise<Map<string, number>> {
  const updatedPrices = new Map<string, number>();
  const fciHoldings = holdings.filter((h) => h.asset_type === "fci");
  if (fciHoldings.length === 0) return updatedPrices;

  let rates: Awaited<ReturnType<typeof fetchAllFCIRates>>;
  try {
    rates = await fetchAllFCIRates();
  } catch {
    return updatedPrices; // Feed inalcanzable — no bloquear la página
  }

  await Promise.allSettled(
    fciHoldings.map(async (holding) => {
      const rate = matchFCIRate(holding, rates);
      if (!rate) return;
      if (holding.current_price === rate.vcp) return; // Sin cambio — no llamar al RPC

      const { error } = await supabase.rpc("sync_holding_balance", {
        p_holding_id: holding.id,
        p_new_price: rate.vcp,
      });
      if (!error) {
        updatedPrices.set(holding.id, rate.vcp);

        // Histórico aditivo — no bloquea ni revierte el sync de balance si falla.
        try {
          await supabase.from("holding_price_history").upsert(
            {
              holding_id: holding.id,
              price: rate.vcp,
              recorded_at: rate.fecha,
            },
            { onConflict: "holding_id,recorded_at" }
          );
        } catch {
          // Tabla aún no creada (migración 022 pendiente) u otro error — no interrumpe el flujo.
        }
      }
    })
  );

  return updatedPrices;
}
