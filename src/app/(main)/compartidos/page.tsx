import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
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

export default async function CompartidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: participantsData }, { data: accountsData }] = await Promise.all([
    supabase
      .from("expense_participants")
      .select(
        "id, name, amount, paid, paid_date, expense_id, expenses!inner(merchant, description, currency, date)"
      )
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
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-28 bg-fz-bg min-h-screen">
      <div className="flex items-start justify-between gap-3 pt-2">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-fz-text uppercase tracking-wide">
            Compartidos
          </h1>
          <p className="text-sm text-fz-text-tertiary mt-0.5">
            Quién te debe qué de los gastos que pagaste vos.
          </p>
        </div>
        <Link
          href="/grupos"
          className="shrink-0 text-xs font-medium text-fz-accent-text bg-fz-accent rounded-full px-3 py-2 min-h-[40px] inline-flex items-center"
        >
          Grupos
        </Link>
      </div>

      <Link
        href="/grupos"
        className="block bg-fz-surface border border-fz-border rounded-2xl px-4 py-3"
      >
        <p className="text-sm font-semibold text-fz-text">Familiares, amigos y más</p>
        <p className="text-xs text-fz-text-tertiary mt-0.5">
          Armá grupos y usalos al cargar un gasto o cuotas compartidas →
        </p>
      </Link>

      {pending.length === 0 && paidList.length === 0 ? (
        <div className="bg-fz-surface border border-fz-border rounded-2xl p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-fz-accent-soft flex items-center justify-center mx-auto">
            <Users size={26} className="text-fz-accent" />
          </div>
          <p className="text-sm font-medium text-fz-text">Sin gastos compartidos</p>
          <p className="text-sm text-fz-text-tertiary">
            Marcá &quot;¿Es compartido?&quot; al cargar un gasto (también con tarjeta en
            cuotas) y elegí un grupo, o cargá los nombres a mano.
          </p>
          <Link href="/gastos/nuevo" className="text-sm font-medium text-fz-accent underline">
            Nuevo gasto
          </Link>
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide mb-2">
              Pendientes de cobro
            </h2>
            {pending.length === 0 ? (
              <div className="bg-fz-surface border border-fz-border rounded-2xl p-4 text-center">
                <p className="text-sm text-fz-text-tertiary">Nadie te debe plata ahora mismo</p>
              </div>
            ) : (
              <div className="bg-fz-surface border border-fz-border rounded-2xl overflow-hidden divide-y divide-fz-border">
                {pending.map((p) => {
                  const currency = p.expenses?.currency ?? "ARS";
                  const compatibleAccounts = leafAccounts.filter(
                    (a) => a.currency === currency
                  );
                  return (
                    <div
                      key={p.id}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fz-text truncate">{p.name}</p>
                        <p className="text-xs text-fz-text-tertiary truncate">
                          {expenseLabel(p)} ·{" "}
                          {new Date(p.expenses!.date + "T00:00:00").toLocaleDateString(
                            "es-AR",
                            { day: "numeric", month: "short" }
                          )}
                        </p>
                        <p className="text-sm font-semibold text-fz-text tabular-nums mt-0.5">
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
              <summary className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide cursor-pointer select-none mb-2">
                Ya cobrados ({paidList.length})
              </summary>
              <div className="bg-fz-surface border border-fz-border rounded-2xl overflow-hidden divide-y divide-fz-border">
                {paidList.map((p) => (
                  <div
                    key={p.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fz-text truncate">{p.name}</p>
                      <p className="text-xs text-fz-text-tertiary truncate">
                        {expenseLabel(p)}
                        {p.paid_date &&
                          ` · cobrado el ${new Date(p.paid_date + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`}
                      </p>
                    </div>
                    <p className="text-sm text-fz-accent font-medium tabular-nums shrink-0">
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
