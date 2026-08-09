import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { formatCurrency, formatARS, formatUSD } from "@/lib/format";
import { getLeafAccounts } from "@/lib/accounts";
import type { Account, Currency } from "@/types";

// Sesión J.1.12, TAREA 5 — la ocurrencia de un día de mes (closing_day/due_day,
// 1–28) más cercana a hoy, mirando mes anterior/actual/siguiente. Necesario porque
// "próximo vencimiento" puede en realidad ser el de un par de días atrás (ventana
// ±7 días del brief) — no siempre el que todavía no pasó este mes.
function closestOccurrence(day: number, today: Date): Date {
  const candidates = [-1, 0, 1].map(
    (offset) => new Date(today.getFullYear(), today.getMonth() + offset, day)
  );
  return candidates.reduce((best, d) =>
    Math.abs(d.getTime() - today.getTime()) < Math.abs(best.getTime() - today.getTime())
      ? d
      : best
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  // Recordatorio de sueldo sin distribuir: aplica si tiene más de 7 días sin distribuir
  const UNDISTRIBUTED_REMINDER_DAYS = 7;
  const reminderCutoff = new Date(now);
  reminderCutoff.setDate(reminderCutoff.getDate() - UNDISTRIBUTED_REMINDER_DAYS);
  const reminderCutoffStr = reminderCutoff.toISOString().split("T")[0];

  const [{ data: accounts }, { data: monthExpenses }, { data: recentExpenses }, { data: undistributedSueldos }] =
    await Promise.all([
      supabase.from("accounts").select("*").order("created_at"),
      supabase
        .from("expenses")
        .select("amount, currency")
        .gte("date", firstDay)
        .lte("date", lastDay),
      supabase
        .from("expenses")
        .select(
          "id, amount, currency, merchant, description, date, categories(name, icon)"
        )
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("incomes")
        .select("id, amount, currency, date")
        .eq("type", "sueldo")
        .eq("distributed", false)
        .lte("date", reminderCutoffStr)
        .order("date", { ascending: false }),
    ]);

  const leafAccounts = getLeafAccounts((accounts ?? []) as Account[]);
  const arsBalance = leafAccounts
    .filter((a) => a.currency === "ARS")
    .reduce((sum, a) => sum + Number(a.balance), 0);
  const usdBalance = leafAccounts
    .filter((a) => a.currency === "USD")
    .reduce((sum, a) => sum + Number(a.balance), 0);

  // Recordatorios de cierre/vencimiento (N=3 días)
  const REMINDER_DAYS = 3;
  function daysUntil(targetDay: number, today: Date): number {
    const todayNum = today.getDate();
    if (targetDay >= todayNum) return targetDay - todayNum;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return daysInMonth - todayNum + targetDay;
  }
  type CardReminder = { name: string; type: "Cierre" | "Vencimiento"; day: number; daysLeft: number };
  const reminders: CardReminder[] = [];
  for (const acc of leafAccounts) {
    if ((acc as Account).type !== "credito") continue;
    const a = acc as Account;
    if (a.closing_day != null) {
      const d = daysUntil(a.closing_day, now);
      if (d <= REMINDER_DAYS) reminders.push({ name: a.name, type: "Cierre", day: a.closing_day, daysLeft: d });
    }
    if (a.due_day != null) {
      const d = daysUntil(a.due_day, now);
      if (d <= REMINDER_DAYS) reminders.push({ name: a.name, type: "Vencimiento", day: a.due_day, daysLeft: d });
    }
  }

  // Sesión J.1.12, TAREA 5a/5b — tarjetas sin closing_day/due_day configurado.
  // A diferencia del banner de arriba (que avisa cuando se acerca una fecha YA
  // configurada), este aviso es persistente: no depende de la fecha de hoy, se
  // muestra siempre que falte el dato, hasta que el usuario lo complete. Se
  // infiere en cada carga comparando el estado actual de la cuenta — no hace
  // falta una tabla nueva para trackear "ya se avisó este mes" (decisión tomada
  // en el brief: preferir esta opción si alcanza, y alcanza).
  const creditCardsMissingConfig = leafAccounts.filter(
    (a) => (a as Account).type === "credito" && (a.closing_day == null || a.due_day == null)
  ) as Account[];

  // TAREA 5c/5d — resumen "cuánto vas a pagar" para tarjetas SÍ configuradas cuyo
  // próximo/último vencimiento cae dentro de ±7 días de hoy. Reutiliza el mismo
  // agrupamiento por cuenta+mes que /cuotas (no reinventa la lógica de cuotas).
  // "Ya pagué" reusa installments.paid — el mismo estado que actualiza
  // pay_installments_batch — no se agrega ningún campo nuevo.
  const UPCOMING_WINDOW_DAYS = 7;
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const paymentSummaryCandidates = leafAccounts
    .filter(
      (a): a is Account =>
        (a as Account).type === "credito" &&
        (a as Account).closing_day != null &&
        (a as Account).due_day != null
    )
    .map((card) => {
      const dueDate = closestOccurrence(card.due_day!, todayMidnight);
      const diffDays = Math.round(
        (dueDate.getTime() - todayMidnight.getTime()) / 86400000
      );
      return { card, dueDate, diffDays };
    })
    .filter((c) => Math.abs(c.diffDays) <= UPCOMING_WINDOW_DAYS);

  type PaymentSummary = {
    cardId: string;
    cardName: string;
    dueDate: Date;
    total: number;
    currency: Currency;
    pendingCount: number;
    totalCount: number;
  };
  let paymentSummaries: PaymentSummary[] = [];
  if (paymentSummaryCandidates.length > 0) {
    const { data: summaryInstallments } = await supabase
      .from("installments")
      .select(
        "id, amount, due_date, paid, expenses ( account_id, currency )"
      );
    type SummaryInstRow = {
      amount: number;
      due_date: string;
      paid: boolean;
      expenses: { account_id: string | null; currency: string } | null;
    };
    const rows = (summaryInstallments ?? []) as unknown as SummaryInstRow[];

    paymentSummaries = paymentSummaryCandidates.map(({ card, dueDate }) => {
      const targetYearMonth = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
      const cardRows = rows.filter(
        (r) =>
          r.expenses?.account_id === card.id &&
          r.due_date.slice(0, 7) === targetYearMonth
      );
      return {
        cardId: card.id,
        cardName: card.name,
        dueDate,
        total: cardRows.reduce((sum, r) => sum + Number(r.amount), 0),
        currency: (cardRows[0]?.expenses?.currency ?? "ARS") as Currency,
        pendingCount: cardRows.filter((r) => !r.paid).length,
        totalCount: cardRows.length,
      };
    }).filter((s) => s.totalCount > 0);
  }

  const arsExpenses = (monthExpenses ?? [])
    .filter((e) => e.currency === "ARS")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const usdExpenses = (monthExpenses ?? [])
    .filter((e) => e.currency === "USD")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const monthName = now.toLocaleDateString("es-AR", { month: "long" });

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Finanzas</h1>
          <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      {/* Tarjetas sin cierre/vencimiento configurado — aviso persistente, no es
          un banner de fecha próxima (Sesión J.1.12, TAREA 5b). */}
      {creditCardsMissingConfig.length > 0 && (
        <section className="space-y-2">
          {creditCardsMissingConfig.map((card) => (
            <Link
              key={card.id}
              href="/cuentas"
              className="block bg-red-50 border border-red-200 rounded-xl px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-base shrink-0">⚠️</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-red-900">
                    Falta configurar {card.name}
                  </p>
                  <p className="text-xs text-red-700">
                    Completá el día de cierre y vencimiento para ver cuánto vas a
                    pagar cada mes →
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* Resumen de pago para tarjetas configuradas con vencimiento cercano
          (±7 días — Sesión J.1.12, TAREA 5c/5d). */}
      {paymentSummaries.length > 0 && (
        <section className="space-y-2">
          {paymentSummaries.map((s) => {
            const allPaid = s.pendingCount === 0;
            return (
              <Link
                key={s.cardId}
                href="/cuotas"
                className={`block border rounded-xl px-4 py-3 ${
                  allPaid
                    ? "bg-green-50 border-green-200"
                    : "bg-indigo-50 border-indigo-200"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${allPaid ? "text-green-900" : "text-indigo-900"}`}
                    >
                      {s.cardName} · vence{" "}
                      {s.dueDate.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                    </p>
                    <p className={`text-xs ${allPaid ? "text-green-700" : "text-indigo-700"}`}>
                      {allPaid
                        ? "Ya pagaste todas las cuotas de este vencimiento ✓"
                        : `${s.pendingCount} de ${s.totalCount} cuota${s.totalCount !== 1 ? "s" : ""} sin pagar`}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold tabular-nums shrink-0 ${allPaid ? "text-green-900" : "text-indigo-900"}`}
                  >
                    {formatCurrency(s.total, s.currency)}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {/* Recordatorios de cierre/vencimiento de tarjetas */}
      {reminders.length > 0 && (
        <section className="space-y-2">
          {reminders.map((r, i) => (
            <div
              key={i}
              className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3"
            >
              <span className="text-base shrink-0">💳</span>
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {r.type} {r.name}
                </p>
                <p className="text-xs text-amber-700">
                  {r.daysLeft === 0
                    ? `Hoy (día ${r.day})`
                    : `En ${r.daysLeft} día${r.daysLeft !== 1 ? "s" : ""} (día ${r.day})`}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Recordatorio de sueldo sin distribuir (>7 días pendiente) */}
      {undistributedSueldos && undistributedSueldos.length > 0 && (
        <section className="space-y-2">
          {undistributedSueldos.map((inc) => (
            <Link
              key={inc.id}
              href={`/ingresos/distribuir?ingreso_id=${inc.id}`}
              className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-base shrink-0">💰</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-indigo-900">
                    Sueldo sin distribuir
                  </p>
                  <p className="text-xs text-indigo-600 tabular-nums">
                    {formatCurrency(Number(inc.amount), inc.currency as "ARS" | "USD")} ·{" "}
                    {new Date(inc.date + "T00:00:00").toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
              <span className="text-sm text-indigo-600 shrink-0 ml-3">Distribuir →</span>
            </Link>
          ))}
        </section>
      )}

      {/* Gastos del mes */}
      <section>
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
          Gastos de {monthName}
        </h2>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          {arsExpenses === 0 && usdExpenses === 0 ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-400">Sin gastos este mes</p>
              <Link
                href="/nuevo-gasto"
                className="text-sm font-medium text-gray-900 underline"
              >
                Registrar gasto
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {arsExpenses > 0 && (
                <p className="text-3xl font-semibold text-gray-900 tabular-nums">
                  {formatARS(arsExpenses)}
                </p>
              )}
              {usdExpenses > 0 && (
                <p className="text-sm text-gray-500 tabular-nums">
                  + {formatUSD(usdExpenses)} en dólares
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Saldos */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Saldos
          </h2>
          <div className="flex items-center gap-3">
            <Link
              href="/ingresos/nuevo"
              className="text-xs font-medium bg-indigo-600 text-white px-2.5 py-1 rounded-lg"
            >
              + Ingreso
            </Link>
            <Link href="/ingresos" className="text-xs text-gray-500 hover:text-gray-900">
              Ver ingresos →
            </Link>
          </div>
        </div>

        {leafAccounts.length === 0 ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center space-y-2">
            <p className="text-sm text-gray-400">Todavía no cargaste cuentas</p>
            <Link href="/cuentas" className="text-sm font-medium text-gray-900 underline">
              Agregar cuentas
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {leafAccounts.map((account, i) => (
              <div
                key={account.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <p className="text-sm font-medium text-gray-900">{account.name}</p>
                <p className="text-sm text-gray-600 tabular-nums">
                  {formatCurrency(Number(account.balance), account.currency)}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs font-medium text-gray-500">Total ARS</p>
              <p className="text-sm font-semibold text-gray-900 tabular-nums">
                {formatARS(arsBalance)}
              </p>
            </div>
            {usdBalance > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs font-medium text-gray-500">Total USD</p>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">
                  {formatUSD(usdBalance)}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Accesos rápidos */}
      <section>
        <div className="grid grid-cols-3 gap-2">
          <Link href="/cuotas" className="bg-white rounded-xl shadow-sm px-3 py-3 text-center hover:bg-gray-50 transition-colors">
            <p className="text-lg mb-0.5">💳</p>
            <p className="text-xs font-medium text-gray-700">Cuotas</p>
          </Link>
          <Link href="/bienes" className="bg-white rounded-xl shadow-sm px-3 py-3 text-center hover:bg-gray-50 transition-colors">
            <p className="text-lg mb-0.5">🏡</p>
            <p className="text-xs font-medium text-gray-700">Bienes</p>
          </Link>
          <Link href="/inversiones" className="bg-white rounded-xl shadow-sm px-3 py-3 text-center hover:bg-gray-50 transition-colors">
            <p className="text-lg mb-0.5">📈</p>
            <p className="text-xs font-medium text-gray-700">Inversiones</p>
          </Link>
        </div>
      </section>

      {/* Últimos gastos */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Últimos gastos
          </h2>
          <Link href="/gastos" className="text-xs text-gray-500 hover:text-gray-900">
            Ver todos →
          </Link>
        </div>

        {!recentExpenses || recentExpenses.length === 0 ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center space-y-2">
            <p className="text-sm text-gray-400">Sin gastos registrados</p>
            <Link
              href="/nuevo-gasto"
              className="text-sm font-medium text-gray-900 underline"
            >
              Registrar primer gasto
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {recentExpenses.map((expense, i) => {
              const cat = expense.categories as unknown as {
                name: string;
                icon: string | null;
              } | null;
              const label =
                expense.merchant ||
                expense.description ||
                cat?.name ||
                "Gasto";
              const dateStr = new Date(
                expense.date + "T00:00:00"
              ).toLocaleDateString("es-AR", {
                day: "numeric",
                month: "short",
              });
              return (
                <div
                  key={expense.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i > 0 ? "border-t border-gray-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{cat?.icon ?? "💸"}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {label}
                      </p>
                      <p className="text-xs text-gray-400">{dateStr}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums ml-3 shrink-0">
                    {formatCurrency(Number(expense.amount), expense.currency)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
