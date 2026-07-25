import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import AccountsOnboarding from "./_components/AccountsOnboarding";
import CuentaActions from "./_components/CuentaActions";
import type { Account, Currency } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  banco: "Bancos y billeteras",
  efectivo: "Efectivo",
  inversion: "Inversiones",
  usd_reserva: "Dólares / Reservas USD",
};

const TYPE_ORDER = ["banco", "efectivo", "inversion", "usd_reserva"];

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
  ] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase
      .from("account_earmarks")
      .select("account_id, amount, currency, expense_id")
      .eq("released", false),
    // Minimal query to detect which accounts have expense dependencies
    supabase
      .from("expenses")
      .select("account_id, covering_account_id, funding_account_id"),
  ]);

  const accounts = (accountsData ?? []) as Account[];

  // Build earmark maps (total + by type for discriminated view)
  const earmarksTotalMap = new Map<string, number>();
  const earmarksCuotasMap = new Map<string, number>(); // earmarks from credit expenses
  const earmarksMetasMap = new Map<string, number>();  // earmarks from savings goals

  for (const e of earmarksData ?? []) {
    const amt = Number(e.amount);
    earmarksTotalMap.set(e.account_id, (earmarksTotalMap.get(e.account_id) ?? 0) + amt);
    if (e.expense_id) {
      earmarksCuotasMap.set(e.account_id, (earmarksCuotasMap.get(e.account_id) ?? 0) + amt);
    } else {
      earmarksMetasMap.set(e.account_id, (earmarksMetasMap.get(e.account_id) ?? 0) + amt);
    }
  }

  // Accounts that have expense or earmark dependencies (type change locked)
  const accountsWithDeps = new Set<string>();
  for (const e of expenseDepsData ?? []) {
    if (e.account_id) accountsWithDeps.add(e.account_id);
    if (e.covering_account_id) accountsWithDeps.add(e.covering_account_id);
    if (e.funding_account_id) accountsWithDeps.add(e.funding_account_id);
  }
  for (const e of earmarksData ?? []) {
    accountsWithDeps.add(e.account_id);
  }

  if (accounts.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 pt-2 mb-6">Cuentas</h1>
        <AccountsOnboarding />
      </div>
    );
  }

  const roots = accounts.filter((a) => !a.parent_id);
  const childrenByParent = new Map<string, Account[]>();
  for (const a of accounts) {
    if (a.parent_id) {
      const arr = childrenByParent.get(a.parent_id) ?? [];
      arr.push(a);
      childrenByParent.set(a.parent_id, arr);
    }
  }

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: roots.filter((a) => a.type === type),
  })).filter((g) => g.items.length > 0);

  // Credit cards without a parent (orphans) — shown in their own section
  const orphanCreditCards = roots.filter((a) => a.type === "credito");

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

      {grouped.map(({ type, label, items }) => (
        <section key={type}>
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            {label}
          </h2>
          <div className="space-y-3">
            {items.map((account) => {
              const allChildren = childrenByParent.get(account.id) ?? [];
              // Bolsillos = non-credit children; credit children shown separately below
              const bolsillos = allChildren.filter((c) => c.type !== "credito");
              const creditChildren = allChildren.filter((c) => c.type === "credito");

              if (allChildren.length === 0) {
                return (
                  <SimpleAccountCard
                    key={account.id}
                    account={account}
                    earmarksTotal={earmarksTotalMap.get(account.id) ?? 0}
                    earmarksCuotas={earmarksCuotasMap.get(account.id) ?? 0}
                    earmarksMetas={earmarksMetasMap.get(account.id) ?? 0}
                    canChangeType={!accountsWithDeps.has(account.id)}
                    hasChildren={false}
                  />
                );
              }

              // Account with bolsillos (and possibly credit card children)
              const totalsByCurrency = bolsillos.reduce<Record<string, number>>(
                (acc, c) => {
                  acc[c.currency] = (acc[c.currency] ?? 0) + Number(c.balance);
                  return acc;
                },
                {}
              );

              return (
                <div
                  key={account.id}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3 px-4 py-3 bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {account.name}
                      </p>
                      <CuentaActions
                        accountId={account.id}
                        accountName={account.name}
                        accountType={account.type}
                        currentBalance={Number(account.balance)}
                        currency={account.currency}
                        canChangeType={false}
                        hasChildren={true}
                      />
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        {Object.entries(totalsByCurrency).map(([cur, total]) => (
                          <p
                            key={cur}
                            className="text-xs font-medium text-gray-600 tabular-nums"
                          >
                            {formatCurrency(total, cur as Currency)}
                          </p>
                        ))}
                      </div>
                      <Link
                        href={`/cuentas/nueva?parent=${account.id}`}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900 border border-gray-200 rounded-full px-2.5 py-1 transition-colors"
                      >
                        + bolsillo
                      </Link>
                    </div>
                  </div>

                  {bolsillos.map((child) => (
                    <BolsilloRow
                      key={child.id}
                      account={child}
                      earmarksTotal={earmarksTotalMap.get(child.id) ?? 0}
                      earmarksCuotas={earmarksCuotasMap.get(child.id) ?? 0}
                      earmarksMetas={earmarksMetasMap.get(child.id) ?? 0}
                      canChangeType={!accountsWithDeps.has(child.id)}
                    />
                  ))}

                  {creditChildren.length > 0 && (
                    <>
                      <div className="px-4 pt-2 pb-1 border-t border-gray-100">
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                          Tarjetas de crédito
                        </p>
                      </div>
                      {creditChildren.map((card) => (
                        <CreditCardRow
                          key={card.id}
                          account={card}
                          canChangeType={!accountsWithDeps.has(card.id)}
                        />
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Credit cards without a parent bank */}
      {orphanCreditCards.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Tarjetas de crédito
          </h2>
          <div className="space-y-3">
            {orphanCreditCards.map((card) => (
              <div key={card.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-start justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{card.name}</p>
                    <CuentaActions
                      accountId={card.id}
                      accountName={card.name}
                      accountType={card.type}
                      currentBalance={Number(card.balance)}
                      currency={card.currency}
                      canChangeType={!accountsWithDeps.has(card.id)}
                      hasChildren={false}
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">Deuda</p>
                    <p className="text-sm font-semibold text-gray-700 tabular-nums">
                      {formatCurrency(Number(card.balance), card.currency)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="pb-24" />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function DiscriminatedBalance({
  balance,
  currency,
  earmarksTotal,
  earmarksCuotas,
  earmarksMetas,
}: {
  balance: number;
  currency: Currency;
  earmarksTotal: number;
  earmarksCuotas: number;
  earmarksMetas: number;
}) {
  if (earmarksTotal === 0) {
    return (
      <p className="text-sm text-gray-600 tabular-nums">
        {formatCurrency(balance, currency)}
      </p>
    );
  }

  const libre = balance - earmarksTotal;

  return (
    <div className="text-right space-y-0.5">
      <p className="text-xs text-gray-400 tabular-nums">
        Total: {formatCurrency(balance, currency)}
      </p>
      {earmarksCuotas > 0 && (
        <p className="text-[10px] text-amber-600 tabular-nums">
          Cuotas: −{formatCurrency(earmarksCuotas, currency)}
        </p>
      )}
      {earmarksMetas > 0 && (
        <p className="text-[10px] text-blue-600 tabular-nums">
          Metas: −{formatCurrency(earmarksMetas, currency)}
        </p>
      )}
      <p className="text-sm font-semibold text-gray-900 tabular-nums">
        Libre: {formatCurrency(libre, currency)}
      </p>
    </div>
  );
}

function SimpleAccountCard({
  account,
  earmarksTotal,
  earmarksCuotas,
  earmarksMetas,
  canChangeType,
  hasChildren,
}: {
  account: Account;
  earmarksTotal: number;
  earmarksCuotas: number;
  earmarksMetas: number;
  canChangeType: boolean;
  hasChildren: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-start justify-between px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{account.name}</p>
          <CuentaActions
            accountId={account.id}
            accountName={account.name}
            accountType={account.type}
            currentBalance={Number(account.balance)}
            currency={account.currency}
            canChangeType={canChangeType}
            hasChildren={hasChildren}
          />
        </div>
        <DiscriminatedBalance
          balance={Number(account.balance)}
          currency={account.currency}
          earmarksTotal={earmarksTotal}
          earmarksCuotas={earmarksCuotas}
          earmarksMetas={earmarksMetas}
        />
      </div>
    </div>
  );
}

function BolsilloRow({
  account,
  earmarksTotal,
  earmarksCuotas,
  earmarksMetas,
  canChangeType,
}: {
  account: Account;
  earmarksTotal: number;
  earmarksCuotas: number;
  earmarksMetas: number;
  canChangeType: boolean;
}) {
  return (
    <div className="flex items-start justify-between px-4 py-2.5 pl-6 border-t border-gray-100">
      <div>
        <p className="text-sm text-gray-700">{account.name}</p>
        <CuentaActions
          accountId={account.id}
          accountName={account.name}
          accountType={account.type}
          currentBalance={Number(account.balance)}
          currency={account.currency}
          canChangeType={canChangeType}
          hasChildren={false}
        />
      </div>
      <DiscriminatedBalance
        balance={Number(account.balance)}
        currency={account.currency}
        earmarksTotal={earmarksTotal}
        earmarksCuotas={earmarksCuotas}
        earmarksMetas={earmarksMetas}
      />
    </div>
  );
}

function CreditCardRow({
  account,
  canChangeType,
}: {
  account: Account;
  canChangeType: boolean;
}) {
  return (
    <div className="flex items-start justify-between px-4 py-2.5 pl-6 border-t border-gray-100">
      <div>
        <p className="text-sm text-gray-700">{account.name}</p>
        <CuentaActions
          accountId={account.id}
          accountName={account.name}
          accountType={account.type}
          currentBalance={Number(account.balance)}
          currency={account.currency}
          canChangeType={canChangeType}
          hasChildren={false}
        />
      </div>
      <div className="text-right">
        <p className="text-[10px] text-gray-400">Deuda</p>
        <p className="text-sm text-gray-700 tabular-nums">
          {formatCurrency(Number(account.balance), account.currency)}
        </p>
      </div>
    </div>
  );
}
