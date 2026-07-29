import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { Income } from "@/types";

export default async function IngresosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: incomesData } = await supabase
    .from("incomes")
    .select("*")
    .order("date", { ascending: false })
    .limit(100);

  const incomes = (incomesData ?? []) as Income[];

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5 pb-24">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-semibold text-gray-900">Ingresos</h1>
        <Link
          href="/ingresos/nuevo"
          className="text-xs font-medium bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg"
        >
          + Ingreso
        </Link>
      </div>

      {incomes.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-2">
          <p className="text-sm text-gray-400">Sin ingresos registrados</p>
          <Link href="/ingresos/nuevo" className="text-sm font-medium text-gray-900 underline">
            Registrar primer ingreso
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {incomes.map((income, i) => {
            const dateStr = new Date(income.date + "T00:00:00").toLocaleDateString("es-AR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const typeLabel =
              income.type === "sueldo"
                ? "Sueldo"
                : income.type === "freelance"
                ? "Freelance"
                : "Otro";

            return (
              <Link
                key={income.id}
                href={`/ingresos/${income.id}/editar`}
                className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {typeLabel}
                    {income.note ? ` · ${income.note}` : ""}
                  </p>
                  <p className="text-xs text-gray-400">
                    {dateStr}
                    {income.distributed ? (
                      <span className="ml-2 text-green-600">✓ distribuido</span>
                    ) : (
                      <span className="ml-2 text-amber-600">sin distribuir</span>
                    )}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900 tabular-nums ml-3 shrink-0">
                  {formatCurrency(Number(income.amount), income.currency)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
