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

  const [{ data: accountsData }, { data: earmarksData }] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase
      .from("account_earmarks")
      .select("account_id, amount, currency")
      .eq("released", false),
  ]);

  const accounts = (accountsData ?? []) as Account[];

  // Build earmarks map: account_id → total earmarked per currency
  const earmarksMap = new Map<string, number>();
  for (const e of earmarksData ?? []) {
    earmarksMap.set(e.account_id, (earmarksMap.get(e.account_id) ?? 0) + Number(e.amount));
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
              const children = childrenByParent.get(account.id) ?? [];

              if (children.length === 0) {
                const earmarked = earmarksMap.get(account.id) ?? 0;
                const available = Number(account.balance) - earmarked;
                return (
                  <div
                    key={account.id}
                    className="bg-white rounded-2xl shadow-sm overflow-hidden"
                  >
                    <div className="flex items-start justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {account.name}
                        </p>
                        <CuentaActions
                          accountId={account.id}
                          accountName={account.name}
                          currentBalance={Number(account.balance)}
                          currency={account.currency}
                        />
                      </div>
                      {earmarked > 0 ? (
                        <div className="text-right">
                          <p className="text-xs text-gray-400 tabular-nums">
                            Total: {formatCurrency(Number(account.balance), account.currency)}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 tabular-nums">
                            Disponible: {formatCurrency(available, account.currency)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 tabular-nums">
                          {formatCurrency(Number(account.balance), account.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }

              const totalsByCurrency = children.reduce<Record<string, number>>(
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
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50">
                    <p className="text-sm font-semibold text-gray-900">
                      {account.name}
                    </p>
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
                  {children.map((child) => {
                    const earmarked = earmarksMap.get(child.id) ?? 0;
                    const available = Number(child.balance) - earmarked;
                    return (
                      <div
                        key={child.id}
                        className="flex items-start justify-between px-4 py-2.5 pl-6 border-t border-gray-100"
                      >
                        <div>
                          <p className="text-sm text-gray-700">{child.name}</p>
                          <CuentaActions
                            accountId={child.id}
                            accountName={child.name}
                            currentBalance={Number(child.balance)}
                            currency={child.currency}
                          />
                        </div>
                        {earmarked > 0 ? (
                          <div className="text-right">
                            <p className="text-xs text-gray-400 tabular-nums">
                              Total: {formatCurrency(Number(child.balance), child.currency)}
                            </p>
                            <p className="text-sm font-semibold text-gray-900 tabular-nums">
                              Disp.: {formatCurrency(available, child.currency)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 tabular-nums">
                            {formatCurrency(Number(child.balance), child.currency)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
