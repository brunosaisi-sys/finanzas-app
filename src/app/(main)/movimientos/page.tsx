import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/types";

function mesLabel(yearMonth: string) {
  const [y, m] = yearMonth.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

function prevMes(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMes(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { mes } = await searchParams;
  const yearMonth = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : currentYearMonth();

  const desde = `${yearMonth}-01`;
  const hasta = `${yearMonth}-31`;

  const [{ data: expensesData }, { data: incomesData }] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, amount, currency, merchant, description, date, categories(name, icon), account:accounts!account_id(name)"
      )
      .gte("date", desde)
      .lte("date", hasta)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("incomes")
      .select("id, amount, currency, type, note, date, account:accounts!account_id(name)")
      .gte("date", desde)
      .lte("date", hasta)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  type ExpenseRow = {
    id: string;
    amount: number;
    currency: string;
    merchant: string | null;
    description: string | null;
    date: string;
    categories: { name: string; icon: string | null } | null;
    account?: { name: string } | null;
  };
  type IncomeRow = {
    id: string;
    amount: number;
    currency: string;
    type: string;
    note: string | null;
    date: string;
    account?: { name: string } | null;
  };

  const expenses = ((expensesData ?? []) as unknown as ExpenseRow[]).map((e) => ({
    kind: "gasto" as const,
    id: e.id,
    amount: Number(e.amount),
    currency: e.currency as Currency,
    label: e.merchant || e.description || (e.categories as ExpenseRow["categories"])?.name || "Gasto",
    sub: (e.categories as ExpenseRow["categories"])?.name ?? null,
    account: (e as unknown as { account?: { name: string } | null }).account?.name ?? null,
    icon: (e.categories as ExpenseRow["categories"])?.icon ?? "💸",
    date: e.date,
    href: `/gastos/${e.id}/editar`,
  }));

  const incomes = ((incomesData ?? []) as unknown as IncomeRow[]).map((i) => {
    const typeLabel =
      i.type === "sueldo" ? "Sueldo" : i.type === "freelance" ? "Freelance" : "Ingreso";
    return {
      kind: "ingreso" as const,
      id: i.id,
      amount: Number(i.amount),
      currency: i.currency as Currency,
      label: i.note ? `${typeLabel} · ${i.note}` : typeLabel,
      sub: null as string | null,
      account: (i as unknown as { account?: { name: string } | null }).account?.name ?? null,
      icon: "💰",
      date: i.date,
      href: `/ingresos/${i.id}/editar`,
    };
  });

  // Merge y ordenar por fecha desc (ambas listas ya vienen ordenadas, merge manual)
  const all = [...expenses, ...incomes].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const totalGastos = expenses.reduce((s, e) => s + e.amount, 0);
  const totalIngresos = incomes.reduce((s, i) => s + i.amount, 0);
  const isCurrent = yearMonth === currentYearMonth();

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold text-gray-900">Movimientos</h1>
        <div className="flex gap-2">
          <Link
            href="/gastos/nuevo"
            className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 transition-colors"
          >
            + Gasto
          </Link>
          <Link
            href="/ingresos/nuevo"
            className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-full px-3 py-1.5 transition-colors"
          >
            + Ingreso
          </Link>
        </div>
      </div>

      {/* Navegador de mes */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm">
        <Link
          href={`/movimientos?mes=${prevMes(yearMonth)}`}
          className="text-gray-400 hover:text-gray-900 transition-colors text-lg px-2 py-1"
          aria-label="Mes anterior"
        >
          ‹
        </Link>
        <span className="text-sm font-medium text-gray-900 capitalize">
          {mesLabel(yearMonth)}
        </span>
        <Link
          href={isCurrent ? "/movimientos" : `/movimientos?mes=${nextMes(yearMonth)}`}
          className={`text-lg px-2 py-1 transition-colors ${
            isCurrent ? "text-gray-200 pointer-events-none" : "text-gray-400 hover:text-gray-900"
          }`}
          aria-label="Mes siguiente"
          aria-disabled={isCurrent}
        >
          ›
        </Link>
      </div>

      {/* Resumen rápido */}
      {all.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-red-50 rounded-xl px-4 py-3">
            <p className="text-[11px] text-red-500 font-medium uppercase tracking-wide">Gastos</p>
            <p className="text-base font-semibold text-red-700 tabular-nums">
              {formatCurrency(totalGastos, "ARS")}
            </p>
          </div>
          <div className="bg-green-50 rounded-xl px-4 py-3">
            <p className="text-[11px] text-green-600 font-medium uppercase tracking-wide">Ingresos</p>
            <p className="text-base font-semibold text-green-700 tabular-nums">
              {formatCurrency(totalIngresos, "ARS")}
            </p>
          </div>
        </div>
      )}

      {/* Lista unificada */}
      {all.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-3">
          <p className="text-sm text-gray-400">Sin movimientos en {mesLabel(yearMonth)}</p>
          <div className="flex gap-3 justify-center">
            <Link href="/gastos/nuevo" className="text-sm font-medium text-gray-900 underline">
              Registrar gasto
            </Link>
            <span className="text-gray-300">·</span>
            <Link href="/ingresos/nuevo" className="text-sm font-medium text-gray-900 underline">
              Registrar ingreso
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {all.map((item, i) => {
            const dateStr = new Date(item.date + "T00:00:00").toLocaleDateString("es-AR", {
              day: "numeric",
              month: "short",
            });
            const isIngreso = item.kind === "ingreso";
            return (
              <Link
                key={`${item.kind}-${item.id}`}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Indicador de tipo */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 ${
                      isIngreso ? "bg-green-100" : "bg-gray-100"
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {dateStr}
                      {item.account && <> · {item.account}</>}
                      {item.sub && !isIngreso && <> · {item.sub}</>}
                    </p>
                  </div>
                </div>
                <p
                  className={`text-sm font-semibold tabular-nums ml-3 shrink-0 ${
                    isIngreso ? "text-green-600" : "text-gray-900"
                  }`}
                >
                  {isIngreso ? "+" : "−"}{formatCurrency(item.amount, item.currency)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
