import type { SupabaseClient } from "@supabase/supabase-js";
import type { Currency } from "@/types";

export interface CategorySlice {
  name: string;
  icon: string;
  amount: number;
}

export interface MonthBar {
  label: string;
  gastos: number;
  ingresos: number;
}

export const SIN_CATEGORIA = "Sin categoría";

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

interface ExpenseForAggregation {
  currency: Currency;
  sub: string | null;
  icon: string;
  amount: number;
}

// Agrupa gastos por moneda y categoría — nunca suma monedas distintas entre
// sí (regla dura del proyecto). Pura: no toca la DB, así que sirve tanto para
// gastos ya filtrados en memoria (/movimientos, TAREA 6) como para una query
// fresca sin filtrar (Inicio, TAREA 4).
export function aggregateCategoryTotals(
  expenses: ExpenseForAggregation[]
): Partial<Record<Currency, CategorySlice[]>> {
  const byCurrency = new Map<Currency, Map<string, { icon: string; amount: number }>>();
  for (const e of expenses) {
    const catName = e.sub ?? SIN_CATEGORIA;
    if (!byCurrency.has(e.currency)) byCurrency.set(e.currency, new Map());
    const m = byCurrency.get(e.currency)!;
    const existing = m.get(catName) ?? { icon: e.icon, amount: 0 };
    existing.amount += e.amount;
    m.set(catName, existing);
  }
  const result: Partial<Record<Currency, CategorySlice[]>> = {};
  for (const [currency, m] of byCurrency.entries()) {
    result[currency] = Array.from(m.entries()).map(([name, v]) => ({ name, icon: v.icon, amount: v.amount }));
  }
  return result;
}

// Sesión J.1.17, TAREA 4: extraído de /movimientos/page.tsx (Sesión J.1.16,
// TAREA 2) para reusar en Inicio — query simple sin filtros de usuario (a
// diferencia de /movimientos, que agrega sobre `filteredExpenses` ya en
// memoria para reflejar categoría/monto elegidos, TAREA 6 Sesión J.1.15).
export async function fetchCategoryTotalsByCurrency(
  supabase: SupabaseClient,
  desde: string,
  hasta: string
): Promise<Partial<Record<Currency, CategorySlice[]>>> {
  const { data } = await supabase
    .from("expenses")
    .select("amount, currency, categories(name, icon)")
    .gte("date", desde)
    .lte("date", hasta);

  type Row = {
    amount: number;
    currency: string;
    categories: { name: string; icon: string | null } | null;
  };

  return aggregateCategoryTotals(
    ((data ?? []) as unknown as Row[]).map((row) => ({
      currency: row.currency as Currency,
      sub: row.categories?.name ?? null,
      icon: row.categories?.icon ?? "💸",
      amount: Number(row.amount),
    }))
  );
}

// 6 meses calendario terminando en el mes actual real, solo ARS (regla dura:
// nunca sumar monedas distintas en un mismo total).
export async function fetchMonthlyComparativa(supabase: SupabaseClient): Promise<MonthBar[]> {
  const nowReal = new Date();
  const sixStart = fmtDate(new Date(nowReal.getFullYear(), nowReal.getMonth() - 5, 1));
  const sixEnd = fmtDate(new Date(nowReal.getFullYear(), nowReal.getMonth() + 1, 0));
  const [{ data: trendExpensesData }, { data: trendIncomesData }] = await Promise.all([
    supabase.from("expenses").select("amount, date").eq("currency", "ARS").gte("date", sixStart).lte("date", sixEnd),
    supabase.from("incomes").select("amount, date").eq("currency", "ARS").gte("date", sixStart).lte("date", sixEnd),
  ]);
  const monthBuckets: { key: string; label: string; gastos: number; ingresos: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nowReal.getFullYear(), nowReal.getMonth() - i, 1);
    monthBuckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-AR", { month: "short" }),
      gastos: 0,
      ingresos: 0,
    });
  }
  const bucketByKey = new Map(monthBuckets.map((b) => [b.key, b]));
  for (const e of trendExpensesData ?? []) {
    const b = bucketByKey.get(e.date.slice(0, 7));
    if (b) b.gastos += Number(e.amount);
  }
  for (const inc of trendIncomesData ?? []) {
    const b = bucketByKey.get(inc.date.slice(0, 7));
    if (b) b.ingresos += Number(inc.amount);
  }
  return monthBuckets.map(({ label, gastos, ingresos }) => ({ label, gastos, ingresos }));
}
