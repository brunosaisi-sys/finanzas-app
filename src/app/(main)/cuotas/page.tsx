import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { getLeafAccounts, accountDisplayName } from "@/lib/accounts";
import PayInstallmentButton from "./_components/PayInstallmentButton";
import BatchPayButton from "./_components/BatchPayButton";
import ConfirmFundingButton from "./_components/ConfirmFundingButton";
import type { Currency, Account } from "@/types";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${MESES[parseInt(month) - 1]} ${year}`;
}

type PendingFundingRow = {
  id: string;
  account_id: string;
  amount: number;
  currency: Currency;
  reason: string | null;
  expense_id: string;
  expenses: {
    id: string;
    merchant: string | null;
    description: string | null;
    funding_account_id: string | null;
  } | null;
};

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
    covering_account_id: string | null;
    account_id: string | null;
  } | null;
};

type GroupData = {
  cardId: string | null;
  cardName: string | null;
  closingDay: number | null;
  dueDay: number | null;
  yearMonth: string;
  items: InstallmentRow[];
};

export default async function CuotasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, { data: accountsData }, { data: earmarksRaw }] = await Promise.all([
    supabase
      .from("installments")
      .select(
        "id, installment_number, amount, due_date, expenses ( description, merchant, installments_total, currency, covering_account_id, account_id )"
      )
      .eq("paid", false)
      .order("due_date"),
    supabase.from("accounts").select("*").order("name"),
    supabase
      .from("account_earmarks")
      .select("id, account_id, amount, currency, reason, expense_id, expenses!expense_id ( id, merchant, description, funding_account_id )")
      .eq("released", false)
      .not("expense_id", "is", null),
  ]);

  const installments = (data ?? []) as unknown as InstallmentRow[];
  const allAccounts = (accountsData ?? []) as Account[];
  const leafAccounts = getLeafAccounts(allAccounts);

  // Earmarks de crédito sin funding confirmado (la plata no se movió todavía)
  const allEarmarks = (earmarksRaw ?? []) as unknown as PendingFundingRow[];
  const pendingFunding = allEarmarks.filter(
    (ae) => !(ae.expenses as PendingFundingRow["expenses"])?.funding_account_id
  );

  // Agrupar por tarjeta (account_id del gasto) + mes de vencimiento
  const groupMap = new Map<string, GroupData>();
  for (const inst of installments) {
    const cardId = inst.expenses?.account_id ?? null;
    const yearMonth = inst.due_date.slice(0, 7);
    const key = `${cardId ?? "no_card"}::${yearMonth}`;

    if (!groupMap.has(key)) {
      const cardAccount = cardId
        ? allAccounts.find((a) => a.id === cardId) ?? null
        : null;
      groupMap.set(key, {
        cardId,
        cardName: cardAccount?.name ?? null,
        closingDay: cardAccount?.closing_day ?? null,
        dueDay: cardAccount?.due_day ?? null,
        yearMonth,
        items: [],
      });
    }
    groupMap.get(key)!.items.push(inst);
  }

  // Ordenar grupos: primero por mes, luego por nombre de tarjeta
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    const byMonth = a.yearMonth.localeCompare(b.yearMonth);
    if (byMonth !== 0) return byMonth;
    return (a.cardName ?? "").localeCompare(b.cardName ?? "");
  });

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

      {/* Sección: Transferencias pendientes de confirmar */}
      {pendingFunding.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium text-amber-600 uppercase tracking-wide">
            Transferencias pendientes
          </h2>
          <p className="text-[11px] text-gray-400 -mt-1">
            Reservas que todavía no tienen cuenta de origen confirmada.
          </p>
          {pendingFunding.map((ae) => {
            const exp = ae.expenses;
            const expName = exp?.merchant || exp?.description || "Gasto";
            const coveringAccount = allAccounts.find((a) => a.id === ae.account_id);
            const coveringName = coveringAccount
              ? accountDisplayName(coveringAccount, allAccounts)
              : "Cuenta eliminada";
            // Solo cuentas con la misma moneda que el earmark para la confirmación
            const compatibleAccounts = leafAccounts.filter(
              (a) => a.currency === ae.currency && a.id !== ae.account_id
            );

            return (
              <div
                key={ae.id}
                className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{expName}</p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(ae.amount, ae.currency)} → {coveringName}
                  </p>
                </div>
                <ConfirmFundingButton
                  earmarkId={ae.id}
                  earmarkAmount={ae.amount}
                  earmarkCurrency={ae.currency}
                  coveringAccountName={coveringName}
                  expenseName={expName}
                  leafAccounts={compatibleAccounts}
                  allAccounts={allAccounts}
                />
              </div>
            );
          })}
        </section>
      )}

      {installments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-sm font-medium">Sin cuotas pendientes</p>
        </div>
      ) : (
        groups.map((group) => {
          // Sesión J.1.14, TAREA 3: un grupo (tarjeta+mes) puede tener cuotas en
          // monedas distintas (gastos en ARS y en USD con la misma tarjeta el mismo
          // mes) — sumarlas todas junto no tiene sentido económico. Total por
          // moneda, mismo patrón ya usado en BatchPayButton.
          const totalsByCurrency: Record<string, number> = {};
          for (const inst of group.items) {
            const cur = (inst.expenses?.currency ?? "ARS") as Currency;
            totalsByCurrency[cur] = (totalsByCurrency[cur] ?? 0) + Number(inst.amount);
          }
          const missingDays = !group.closingDay || !group.dueDay;

          return (
            <section key={`${group.cardId ?? "no_card"}::${group.yearMonth}`}>
              {/* Encabezado del grupo */}
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="min-w-0">
                  <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    {group.cardName
                      ? `${group.cardName} · ${formatMonth(group.yearMonth)}`
                      : formatMonth(group.yearMonth)}
                  </h2>
                  {group.dueDay && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Vence el día {group.dueDay}
                    </p>
                  )}
                  {missingDays && group.cardName && (
                    <p className="text-[11px] text-amber-600 mt-0.5">
                      Sin cierre/vencimiento configurado — fechas aproximadas
                    </p>
                  )}
                </div>
                {/* Batch pay solo cuando hay más de una cuota en el grupo */}
                {group.items.length > 1 && (
                  <BatchPayButton
                    installments={group.items.map((inst) => ({
                      id: inst.id,
                      amount: Number(inst.amount),
                      currency: (inst.expenses?.currency ?? "ARS") as Currency,
                      coveringAccountId: inst.expenses?.covering_account_id ?? null,
                    }))}
                    cardName={group.cardName ?? "Tarjeta"}
                    yearMonth={group.yearMonth}
                    leafAccounts={leafAccounts}
                    allAccounts={allAccounts}
                  />
                )}
              </div>

              <div className="space-y-2">
                {group.items.map((inst) => {
                  const exp = inst.expenses;
                  const label = exp?.merchant || exp?.description || "Gasto";
                  const total = exp?.installments_total ?? 1;
                  const instCurrency = (exp?.currency ?? "ARS") as Currency;
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
                          {formatCurrency(Number(inst.amount), instCurrency)}
                        </p>
                        <PayInstallmentButton
                          installmentId={inst.id}
                          coveringAccountId={inst.expenses?.covering_account_id ?? null}
                          leafAccounts={leafAccounts}
                          allAccounts={allAccounts}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total del grupo — uno por moneda, nunca sumadas entre sí */}
              {group.items.length > 1 && (
                <div className="flex justify-end mt-1 px-1 gap-3">
                  {Object.entries(totalsByCurrency).map(([cur, amt]) => (
                    <p key={cur} className="text-xs text-gray-400">
                      Total{" "}
                      <span className="font-medium text-gray-600 tabular-nums">
                        {formatCurrency(amt, cur as Currency)}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
