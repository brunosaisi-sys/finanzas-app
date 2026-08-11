import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { getLeafAccounts } from "@/lib/accounts";
import ConfirmParticipantPaymentButton from "./_components/ConfirmParticipantPaymentButton";
import type { Account, Currency } from "@/types";

type ParticipantRow = {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
  paid_date: string | null;
  expense_id: string;
  expenses: {
    merchant: string | null;
    description: string | null;
    currency: Currency;
    date: string;
  } | null;
};

// TAREA 8 (Sesión J.1.15): lista de gastos compartidos — pendientes de cobro
// arriba, ya cobrados colapsados abajo. Diseño decidido en Sesión J.1.14 (9c).
export default async function CompartidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: participantsData }, { data: accountsData }] = await Promise.all([
    supabase
      .from("expense_participants")
      .select("id, name, amount, paid, paid_date, expense_id, expenses!inner(merchant, description, currency, date)")
      .order("created_at", { ascending: false }),
    supabase.from("accounts").select("*").order("name"),
  ]);

  const participants = (participantsData ?? []) as unknown as ParticipantRow[];
  const allAccounts = (accountsData ?? []) as Account[];
  const leafAccounts = getLeafAccounts(allAccounts);

  const pending = participants.filter((p) => !p.paid);
  const paidList = participants.filter((p) => p.paid);

  function expenseLabel(p: ParticipantRow): string {
    return p.expenses?.merchant || p.expenses?.description || "Gasto";
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-24">
      <div className="pt-2">
        <h1 className="text-2xl font-semibold text-gray-900">Gastos compartidos</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Quién te debe qué de los gastos que pagaste vos.
        </p>
      </div>

      {pending.length === 0 && paidList.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto">
            <Users size={26} className="text-indigo-600" />
          </div>
          <p className="text-sm font-medium text-gray-900">Sin gastos compartidos</p>
          <p className="text-sm text-gray-400">
            Marcá &quot;¿Es compartido?&quot; al cargar un gasto para llevar la cuenta de
            quién te debe qué.
          </p>
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Pendientes de cobro
            </h2>
            {pending.length === 0 ? (
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-sm text-gray-400">Nadie te debe plata ahora mismo</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
                {pending.map((p) => {
                  const currency = p.expenses?.currency ?? "ARS";
                  const compatibleAccounts = leafAccounts.filter((a) => a.currency === currency);
                  return (
                    <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {expenseLabel(p)} ·{" "}
                          {new Date(p.expenses!.date + "T00:00:00").toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 tabular-nums mt-0.5">
                          {formatCurrency(Number(p.amount), currency)}
                        </p>
                      </div>
                      <ConfirmParticipantPaymentButton
                        participantId={p.id}
                        participantName={p.name}
                        compatibleAccounts={compatibleAccounts}
                        allAccounts={allAccounts}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {paidList.length > 0 && (
            <details>
              <summary className="text-xs font-medium text-gray-400 uppercase tracking-wide cursor-pointer select-none mb-2">
                Ya cobrados ({paidList.length})
              </summary>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
                {paidList.map((p) => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {expenseLabel(p)}
                        {p.paid_date &&
                          ` · cobrado el ${new Date(p.paid_date + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`}
                      </p>
                    </div>
                    <p className="text-sm text-green-600 font-medium tabular-nums shrink-0">
                      {formatCurrency(Number(p.amount), p.expenses?.currency ?? "ARS")}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
