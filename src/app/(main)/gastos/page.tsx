import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/types";

export default async function GastosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: expenses, error: expensesError } = await supabase
    .from("expenses")
    .select(
      "id, amount, currency, merchant, description, date, categories(name, icon), account:accounts!account_id(name)"
    )
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (expensesError) console.error("gastos query error:", expensesError.message);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold text-gray-900">Gastos</h1>
        <Link
          href="/gastos/nuevo"
          className="text-sm font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-2 transition-colors"
        >
          + Nuevo
        </Link>
      </div>

      {!expenses || expenses.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-3">
          <p className="text-sm text-gray-400">Sin gastos registrados todavía</p>
          <Link
            href="/gastos/nuevo"
            className="inline-block text-sm font-medium text-gray-900 underline"
          >
            Registrar primer gasto
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {expenses.map((expense, i) => {
            const cat = expense.categories as unknown as { name: string; icon: string | null } | null;
            const acc = (expense as unknown as { account?: { name: string } | null }).account ?? null;
            const label = expense.merchant || expense.description || cat?.name || "Gasto";
            const dateStr = new Date(expense.date + "T00:00:00").toLocaleDateString(
              "es-AR",
              { day: "numeric", month: "short" }
            );
            return (
              <Link
                key={expense.id}
                href={`/gastos/${expense.id}/editar`}
                className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl shrink-0">{cat?.icon ?? "💸"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
                    <p className="text-xs text-gray-400">
                      {dateStr}
                      {acc && <> · {acc.name}</>}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900 tabular-nums ml-3 shrink-0">
                  {formatCurrency(Number(expense.amount), expense.currency as Currency)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
