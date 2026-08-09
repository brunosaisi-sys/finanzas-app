import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AccountsOnboarding from "./_components/AccountsOnboarding";
import CuentasTree from "./_components/CuentasTree";
import { autoSyncFciHoldings } from "@/lib/fciAutoSync";
import {
  findFciInstitutionForAccountName,
  fetchAllFciFundsRaw,
  groupFundsForInstitution,
  type FciFundGroup,
} from "@/lib/fciCatalog";
import { calcHoldingReturn, type PricePoint } from "@/lib/finance/holdingReturn";
import { accountDisplayName } from "@/lib/accounts";
import type { Account } from "@/types";
import type { AccountNode } from "./_components/CuentasTree";

export default async function CuentasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: accountsData },
    { data: earmarksData },
    { data: expenseDepsData },
    { data: fciHoldingsData },
  ] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase
      .from("account_earmarks")
      .select("account_id, amount, currency, expense_id")
      .eq("released", false),
    supabase
      .from("expenses")
      .select("account_id, covering_account_id, funding_account_id"),
    // Fetch FCI holdings — quantity+current_price usados para auto-sync de balance
    supabase
      .from("holdings")
      .select("id, name, ticker, asset_type, quantity, current_price")
      .eq("asset_type", "fci")
      .order("created_at"),
  ]);

  const accounts = (accountsData ?? []) as Account[];

  if (accounts.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 pt-2 mb-6">Cuentas</h1>
        <AccountsOnboarding />
      </div>
    );
  }

  // Build earmark maps
  const earmarksTotalMap = new Map<string, number>();
  const earmarksCuotasMap = new Map<string, number>();
  const earmarksMetasMap = new Map<string, number>();

  for (const e of earmarksData ?? []) {
    const amt = Number(e.amount);
    earmarksTotalMap.set(e.account_id, (earmarksTotalMap.get(e.account_id) ?? 0) + amt);
    if (e.expense_id) {
      earmarksCuotasMap.set(e.account_id, (earmarksCuotasMap.get(e.account_id) ?? 0) + amt);
    } else {
      earmarksMetasMap.set(e.account_id, (earmarksMetasMap.get(e.account_id) ?? 0) + amt);
    }
  }

  const accountsWithDeps = new Set<string>();
  for (const e of expenseDepsData ?? []) {
    if (e.account_id) accountsWithDeps.add(e.account_id);
    if (e.covering_account_id) accountsWithDeps.add(e.covering_account_id);
    if (e.funding_account_id) accountsWithDeps.add(e.funding_account_id);
  }
  for (const e of earmarksData ?? []) {
    accountsWithDeps.add(e.account_id);
  }

  // Build holding name map for display
  const fciHoldingsList = (fciHoldingsData ?? []) as {
    id: string;
    name: string;
    ticker: string | null;
    asset_type: string;
    quantity: number;
    current_price: number | null;
  }[];
  const holdingNameMap = new Map(
    fciHoldingsList.map((h) => [h.id, h.ticker ?? h.name])
  );

  // Auto-sync: si el VCP del feed difiere del current_price almacenado,
  // llama sync_holding_balance RPC que actualiza holdings + accounts.balance de forma atómica.
  // Throttle natural: el feed está cacheado 6h. El RPC no se llama si el precio no cambió.
  const updatedPrices = await autoSyncFciHoldings(supabase, fciHoldingsList);
  // Mapa quantity para calcular el nuevo saldo en memoria (evita re-fetch)
  const holdingQuantityMap = new Map(fciHoldingsList.map((h) => [h.id, h.quantity]));

  // ─── Catálogo de fondos por institución (Sesión J.1.7, TAREA 2) ─────────────
  // Solo para cuentas sin holding vinculado aún, cuya institución matchea una de
  // las 5 verificadas (ver docs/lecciones-aprendidas.md §21). Un solo fetch del
  // feed completo, reutilizado para todas las cuentas que lo necesiten.
  // El matching se hace contra la cadena completa de ancestros (accountDisplayName,
  // ej. "Cocos Capital — Fondos"), no solo el nombre propio — un bolsillo con nombre
  // genérico ("Fondos") no lleva el nombre de la institución, solo su padre lo tiene
  // (Sesión J.1.10, fix bug reportado por el usuario).
  const institutionsNeeded = new Map<string, string>(); // institutionId -> accountId (una cuenta representativa alcanza)
  for (const a of accounts) {
    if (a.type === "credito" || a.holding_id) continue;
    const instId = findFciInstitutionForAccountName(accountDisplayName(a, accounts));
    if (instId) institutionsNeeded.set(instId, a.id);
  }

  // Rendimiento 30d de cada holding FCI a partir de su histórico propio
  // (holding_price_history, migración 022). Se calcula para TODOS los holdings FCI
  // del usuario — no solo los que matchean el catálogo de una institución — porque
  // también hace falta para la cuenta que YA tiene un holding vinculado (Sesión
  // J.1.11, TAREA 2: antes esto solo se calculaba dentro de `institutionsNeeded.size
  // > 0`, así que una cuenta ya vinculada, que no necesita catálogo, nunca recibía
  // su rendimiento). Best-effort: si la tabla no existe todavía (migración 022
  // pendiente) o no hay suficiente histórico, no se muestra rendimiento — nunca se
  // inventa un valor (docs/01-fundamentos-teoricos.md §8.5).
  const holdingReturnByHoldingId = new Map<string, number | null>();
  if (fciHoldingsList.length > 0) {
    try {
      const { data: historyRows } = await supabase
        .from("holding_price_history")
        .select("holding_id, price, recorded_at")
        .in(
          "holding_id",
          fciHoldingsList.map((h) => h.id)
        );
      const historyByHolding = new Map<string, PricePoint[]>();
      for (const row of historyRows ?? []) {
        const arr = historyByHolding.get(row.holding_id) ?? [];
        arr.push({ price: Number(row.price), recorded_at: row.recorded_at });
        historyByHolding.set(row.holding_id, arr);
      }
      for (const h of fciHoldingsList) {
        const history = historyByHolding.get(h.id);
        if (history) holdingReturnByHoldingId.set(h.id, calcHoldingReturn(history));
      }
    } catch {
      // holding_price_history todavía no existe (migración 022 pendiente) — sin rendimiento, no bloquea
    }
  }

  const fciCatalogByInstitution = new Map<string, FciFundGroup[]>();
  if (institutionsNeeded.size > 0) {
    const raw = await fetchAllFciFundsRaw();
    for (const instId of institutionsNeeded.keys()) {
      fciCatalogByInstitution.set(instId, groupFundsForInstitution(raw, instId));
    }

    // Rendimiento 30d en el catálogo: solo si el usuario ya tiene, en cualquier
    // cuenta, un holding con el nombre EXACTO de la clase representativa.
    const holdingIdByName = new Map(fciHoldingsList.map((h) => [h.name, h.id]));
    for (const groups of fciCatalogByInstitution.values()) {
      for (const g of groups) {
        const hId = holdingIdByName.get(g.representativeName);
        if (hId) g.return30d = holdingReturnByHoldingId.get(hId) ?? null;
      }
    }
  }

  // Build serializable AccountNode array for the client component
  const accountNodes: AccountNode[] = accounts.map((a) => {
    let balance = Number(a.balance);
    // Corrección en memoria: si este holding fue sincronizado, aplicar el nuevo saldo
    // sin esperar un segundo page load.
    if (a.holding_id && updatedPrices.has(a.holding_id)) {
      const newVcp = updatedPrices.get(a.holding_id)!;
      const qty = holdingQuantityMap.get(a.holding_id) ?? 0;
      balance = qty * newVcp;
    }
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance,
      parent_id: a.parent_id ?? null,
      earmarksTotal: earmarksTotalMap.get(a.id) ?? 0,
      earmarksCuotas: earmarksCuotasMap.get(a.id) ?? 0,
      earmarksMetas: earmarksMetasMap.get(a.id) ?? 0,
      earns_yield: a.earns_yield ?? false,
      hasExpenseDeps: accountsWithDeps.has(a.id),
      holding_id: a.holding_id ?? null,
      linkedHoldingName: a.holding_id ? (holdingNameMap.get(a.holding_id) ?? null) : null,
      linkedHoldingReturn30d: a.holding_id
        ? (holdingReturnByHoldingId.get(a.holding_id) ?? null)
        : null,
      fciCatalog:
        a.type !== "credito" && !a.holding_id
          ? (fciCatalogByInstitution.get(
              findFciInstitutionForAccountName(accountDisplayName(a, accounts)) ?? ""
            ) ?? [])
          : [],
      closing_day: a.closing_day ?? null,
      due_day: a.due_day ?? null,
    };
  });

  const fciHoldings = fciHoldingsList.map((h) => ({
    id: h.id,
    name: h.ticker ?? h.name,
  }));

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold text-gray-900">Cuentas</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/cuentas/transferencia"
            className="text-xs font-medium text-gray-500 border border-gray-200 rounded-full px-3 py-1.5 hover:border-gray-400 transition-colors"
          >
            Transferencia
          </Link>
          <Link
            href="/cuentas/nueva"
            className="text-sm font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-2 transition-colors"
          >
            + Agregar
          </Link>
        </div>
      </div>

      <CuentasTree accounts={accountNodes} fciHoldings={fciHoldings} />

      <div className="pb-24" />
    </div>
  );
}
