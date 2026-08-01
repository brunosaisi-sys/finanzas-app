import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AccountsOnboarding from "./_components/AccountsOnboarding";
import CuentasTree from "./_components/CuentasTree";
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
    // Fetch FCI holdings for the linking dropdown in CuentaActions
    supabase
      .from("holdings")
      .select("id, name, ticker, asset_type")
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
  }[];
  const holdingNameMap = new Map(
    fciHoldingsList.map((h) => [h.id, h.ticker ?? h.name])
  );

  // Build serializable AccountNode array for the client component
  const accountNodes: AccountNode[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    balance: Number(a.balance),
    parent_id: a.parent_id ?? null,
    earmarksTotal: earmarksTotalMap.get(a.id) ?? 0,
    earmarksCuotas: earmarksCuotasMap.get(a.id) ?? 0,
    earmarksMetas: earmarksMetasMap.get(a.id) ?? 0,
    earns_yield: a.earns_yield ?? false,
    hasExpenseDeps: accountsWithDeps.has(a.id),
    holding_id: a.holding_id ?? null,
    linkedHoldingName: a.holding_id ? (holdingNameMap.get(a.holding_id) ?? null) : null,
  }));

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
