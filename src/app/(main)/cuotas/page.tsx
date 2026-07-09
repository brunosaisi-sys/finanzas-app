import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import MarkPaidButton from "./_components/MarkPaidButton";
import type { Currency } from "@/types";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${MESES[parseInt(month) - 1]} ${year}`;
}

type InstallmentRow = {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  expenses: {
    description: string | null;
    merchant: string | null;
    installments_total: number | null;
    currency: string;
  } | null;
};

export default async function CuotasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("installments")
    .select(
      "id, installment_number, amount, due_date, expenses ( description, merchant, installments_total, currency )"
    )
    .eq("paid", false)
    .order("due_date");

  const installments = (data ?? []) as unknown as InstallmentRow[];

  const grouped = new Map<string, InstallmentRow[]>();
  for (const inst of installments) {
    const key = inst.due_date.slice(0, 7);
    const arr = grouped.get(key) ?? [];
    arr.push(inst);
    grouped.set(key, arr);
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-semibold text-gray-900">Cuotas pendientes</h1>
        {installments.length > 0 && (
          <p className="text-sm text-gray-400 mt-0.5">
            {installments.length} cuota{installments.length !== 1 ? "s" : ""} sin pagar
          </p>
        )}
      </div>

      {installments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-sm font-medium">Sin cuotas pendientes</p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([yearMonth, items]) => (
          <section key={yearMonth}>
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              {formatMonth(yearMonth)}
            </h2>
            <div className="space-y-2">
              {items.map((inst) => {
                const exp = inst.expenses;
                const label = exp?.merchant || exp?.description || "Gasto";
                const total = exp?.installments_total ?? 1;
                const currency = (exp?.currency ?? "ARS") as Currency;
                const [, month, day] = inst.due_date.split("-");
                return (
                  <div
                    key={inst.id}
                    className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
                      <p className="text-xs text-gray-400">
                        Cuota {inst.installment_number}/{total} · vence {day}/{month}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm font-semibold tabular-nums text-gray-700">
                        {formatCurrency(Number(inst.amount), currency)}
                      </p>
                      <MarkPaidButton installmentId={inst.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
