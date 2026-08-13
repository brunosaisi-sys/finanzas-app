import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import EyeToggle from "@/components/EyeToggle";
import { Money } from "@/components/Money";
import { formatCurrency, formatARS, formatUSD } from "@/lib/format";
import { getLeafAccounts } from "@/lib/accounts";
import { AlertTriangle, CreditCard, Wallet, Home as HomeIcon, TrendingUp, Receipt, Settings } from "lucide-react";
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

  // TAREA 8 (Sesión J.1.15): "Te deben $X de N personas" — gastos compartidos
  // sin cobrar, agrupados por moneda (nunca sumados entre monedas, TAREA 3/8
  // Sesión J.1.14). Best-effort: si la tabla todavía no existe (migración 029
  // pendiente de ejecución), no bloquea el dashboard.
  const pendingByCurrency = new Map<Currency, { count: number; total: number }>();
  try {
    const { data: pendingParticipants } = await supabase
      .from("expense_participants")
      .select("amount, expenses!inner(currency)")
      .eq("paid", false);
    for (const row of (pendingParticipants ?? []) as unknown as {
      amount: number;
      expenses: { currency: Currency } | null;
    }[]) {
      const cur = row.expenses?.currency ?? "ARS";
      const existing = pendingByCurrency.get(cur) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += Number(row.amount);
      pendingByCurrency.set(cur, existing);
    }
  } catch {
    // expense_participants todavía no existe — sin banner, no bloquea
  }

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

    // Sesión J.1.14, TAREA 3: una tarjeta+mes puede tener cuotas en monedas
    // distintas — antes se sumaban todas juntas y se etiquetaban con la moneda de
    // la primera fila (ej. "US$263.299" que en realidad era ARS+USD sumados).
    // Un resumen por card+mes+moneda, nunca mezclados.
    paymentSummaries = paymentSummaryCandidates.flatMap(({ card, dueDate }) => {
      const targetYearMonth = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
      const cardRows = rows.filter(
        (r) =>
          r.expenses?.account_id === card.id &&
          r.due_date.slice(0, 7) === targetYearMonth
      );
      const byCurrency = new Map<string, SummaryInstRow[]>();
      for (const r of cardRows) {
        const cur = r.expenses?.currency ?? "ARS";
        const arr = byCurrency.get(cur) ?? [];
        arr.push(r);
        byCurrency.set(cur, arr);
      }
      return Array.from(byCurrency.entries()).map(([currency, currencyRows]) => ({
        cardId: card.id,
        cardName: card.name,
        dueDate,
        total: currencyRows.reduce((sum, r) => sum + Number(r.amount), 0),
        currency: currency as Currency,
        pendingCount: currencyRows.filter((r) => !r.paid).length,
        totalCount: currencyRows.length,
      }));
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
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-24 bg-fz-bg min-h-screen -mt-[1px]">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="font-display font-extrabold text-[30px] leading-none text-fz-text uppercase tracking-wide">
            Finanzas
          </h1>
          <p className="text-[13px] text-fz-text-tertiary mt-1">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <EyeToggle />
          <Link
            href="/configuracion"
            className="w-9 h-9 rounded-xl bg-fz-surface border border-fz-border flex items-center justify-center text-fz-text-secondary"
            aria-label="Configuración"
          >
            <Settings size={18} />
          </Link>
        </div>
      </div>

      {/* Saldo total consolidado — hero card principal (TAREA 4, mismo
          tratamiento que el prototipo: c.surfaceHigh, el número más grande de
          toda la pantalla). */}
      <section className="bg-fz-surface-high rounded-[22px] p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-fz-text-tertiary">
          Saldo total consolidado
        </p>
        <p className="font-display font-extrabold text-[42px] leading-tight text-fz-text mt-1">
          <Money>{formatARS(arsBalance)}</Money>
        </p>
        {usdBalance > 0 && (
          <p className="text-sm font-semibold text-fz-text-secondary font-mono mt-1">
            + <Money>{formatUSD(usdBalance)}</Money> en dólares
          </p>
        )}
      </section>

      {/* Tarjetas sin cierre/vencimiento configurado — aviso persistente, no es
          un banner de fecha próxima (Sesión J.1.12, TAREA 5b). */}
      {creditCardsMissingConfig.length > 0 && (
        <section className="space-y-2">
          {creditCardsMissingConfig.map((card) => (
            <Link
              key={card.id}
              href={`/cuentas?editar=${card.id}`}
              className="block bg-fz-negative-soft rounded-xl px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-fz-negative shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fz-text">
                    Falta configurar {card.name}
                  </p>
                  <p className="text-xs text-fz-text-secondary">
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
                key={`${s.cardId}-${s.currency}`}
                href="/cuotas"
                className={`block rounded-xl px-4 py-3 ${
                  allPaid ? "bg-fz-accent-soft" : "bg-fz-surface-high"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fz-text">
                      {s.cardName} · vence{" "}
                      {s.dueDate.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                    </p>
                    <p className={`text-xs ${allPaid ? "text-fz-accent" : "text-fz-text-secondary"}`}>
                      {allPaid
                        ? "Ya pagaste todas las cuotas de este vencimiento ✓"
                        : `${s.pendingCount} de ${s.totalCount} cuota${s.totalCount !== 1 ? "s" : ""} sin pagar`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums font-mono shrink-0 text-fz-text">
                    <Money>{formatCurrency(s.total, s.currency)}</Money>
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
              className="bg-fz-surface border border-fz-border rounded-xl px-4 py-3 flex items-start gap-3"
            >
              <CreditCard size={18} className="text-fz-negative shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-fz-text">
                  {r.type} {r.name}
                </p>
                <p className="text-xs text-fz-text-secondary">
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
              className="bg-fz-accent-soft rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Wallet size={18} className="text-fz-accent shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fz-text">
                    Sueldo sin distribuir
                  </p>
                  <p className="text-xs text-fz-accent tabular-nums font-mono">
                    <Money>{formatCurrency(Number(inc.amount), inc.currency as "ARS" | "USD")}</Money> ·{" "}
                    {new Date(inc.date + "T00:00:00").toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
              <span className="text-sm text-fz-accent shrink-0 ml-3">Distribuir →</span>
            </Link>
          ))}
        </section>
      )}

      {/* TAREA 8: gastos compartidos pendientes de cobro — mismo estilo que el
          banner de "Sueldo sin distribuir" de abajo. */}
      {pendingByCurrency.size > 0 && (
        <section className="space-y-2">
          {Array.from(pendingByCurrency.entries()).map(([cur, { count, total }]) => (
            <Link
              key={cur}
              href="/compartidos"
              className="bg-fz-accent-soft rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Wallet size={18} className="text-fz-accent shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fz-text">
                    Te deben <Money>{formatCurrency(total, cur)}</Money>
                  </p>
                  <p className="text-xs text-fz-accent">
                    {count} persona{count !== 1 ? "s" : ""} sin cobrar
                  </p>
                </div>
              </div>
              <span className="text-sm text-fz-accent shrink-0 ml-3">Ver →</span>
            </Link>
          ))}
        </section>
      )}

      {/* Gastos del mes */}
      <section>
        <h2 className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide mb-2">
          Gastos de {monthName}
        </h2>
        <div className="bg-fz-surface border border-fz-border rounded-2xl p-4">
          {arsExpenses === 0 && usdExpenses === 0 ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-fz-text-tertiary">Sin gastos este mes</p>
              <Link
                href="/nuevo-gasto"
                className="text-sm font-medium text-fz-text underline"
              >
                Registrar gasto
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {arsExpenses > 0 && (
                <p className="font-display font-extrabold text-4xl text-fz-text tabular-nums">
                  <Money>{formatARS(arsExpenses)}</Money>
                </p>
              )}
              {usdExpenses > 0 && (
                <p className="text-sm text-fz-text-secondary tabular-nums font-mono">
                  + <Money>{formatUSD(usdExpenses)}</Money> en dólares
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Saldos */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide">
            Saldos
          </h2>
          <div className="flex items-center gap-3">
            <Link
              href="/ingresos/nuevo"
              className="text-xs font-medium bg-fz-accent text-fz-accent-text px-2.5 py-1 rounded-lg"
            >
              + Ingreso
            </Link>
            <Link href="/ingresos" className="text-xs text-fz-text-secondary hover:text-fz-text">
              Ver ingresos →
            </Link>
          </div>
        </div>

        {leafAccounts.length === 0 ? (
          <div className="bg-fz-surface border border-fz-border rounded-2xl p-4 text-center space-y-2">
            <p className="text-sm text-fz-text-tertiary">Todavía no cargaste cuentas</p>
            <Link href="/cuentas" className="text-sm font-medium text-fz-text underline">
              Agregar cuentas
            </Link>
          </div>
        ) : (
          <div className="bg-fz-surface border border-fz-border rounded-2xl overflow-hidden">
            {leafAccounts.map((account, i) => (
              <div
                key={account.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i > 0 ? "border-t border-fz-border" : ""
                }`}
              >
                <p className="text-sm font-medium text-fz-text">{account.name}</p>
                <p className="text-sm text-fz-text-secondary tabular-nums font-mono">
                  <Money>{formatCurrency(Number(account.balance), account.currency)}</Money>
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 border-t border-fz-border bg-fz-surface-high">
              <p className="text-xs font-medium text-fz-text-secondary">Total ARS</p>
              <p className="text-sm font-semibold text-fz-text tabular-nums font-mono">
                <Money>{formatARS(arsBalance)}</Money>
              </p>
            </div>
            {usdBalance > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-fz-border bg-fz-surface-high">
                <p className="text-xs font-medium text-fz-text-secondary">Total USD</p>
                <p className="text-sm font-semibold text-fz-text tabular-nums font-mono">
                  <Money>{formatUSD(usdBalance)}</Money>
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Accesos rápidos */}
      <section>
        <div className="grid grid-cols-3 gap-2">
          <Link href="/cuotas" className="bg-fz-surface border border-fz-border rounded-xl px-3 py-3.5 text-center hover:bg-fz-surface-high transition-colors">
            <CreditCard size={20} className="mx-auto mb-1.5 text-fz-text-secondary" />
            <p className="text-xs font-medium text-fz-text">Cuotas</p>
          </Link>
          <Link href="/bienes" className="bg-fz-surface border border-fz-border rounded-xl px-3 py-3.5 text-center hover:bg-fz-surface-high transition-colors">
            <HomeIcon size={20} className="mx-auto mb-1.5 text-fz-text-secondary" />
            <p className="text-xs font-medium text-fz-text">Bienes</p>
          </Link>
          <Link href="/inversiones" className="bg-fz-surface border border-fz-border rounded-xl px-3 py-3.5 text-center hover:bg-fz-surface-high transition-colors">
            <TrendingUp size={20} className="mx-auto mb-1.5 text-fz-text-secondary" />
            <p className="text-xs font-medium text-fz-text">Inversiones</p>
          </Link>
        </div>
      </section>

      {/* Últimos gastos */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide">
            Últimos gastos
          </h2>
          <Link href="/gastos" className="text-xs text-fz-text-secondary hover:text-fz-text">
            Ver todos →
          </Link>
        </div>

        {!recentExpenses || recentExpenses.length === 0 ? (
          <div className="bg-fz-surface border border-fz-border rounded-2xl p-4 text-center space-y-2">
            <p className="text-sm text-fz-text-tertiary">Sin gastos registrados</p>
            <Link
              href="/nuevo-gasto"
              className="text-sm font-medium text-fz-text underline"
            >
              Registrar primer gasto
            </Link>
          </div>
        ) : (
          <div className="bg-fz-surface border border-fz-border rounded-2xl overflow-hidden">
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
                    i > 0 ? "border-t border-fz-border" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {cat?.icon ? (
                      <span className="text-xl shrink-0">{cat.icon}</span>
                    ) : (
                      <Receipt size={20} className="text-fz-text-tertiary shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fz-text truncate">
                        {label}
                      </p>
                      <p className="text-xs text-fz-text-tertiary">{dateStr}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-fz-text tabular-nums font-mono ml-3 shrink-0">
                    <Money>{formatCurrency(Number(expense.amount), expense.currency)}</Money>
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
