"use server";

import { createClient } from "@/lib/supabase/server";
import type { Currency, PaymentMethod } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInstallmentDueDates(
  expenseDateStr: string,
  count: number,
  closingDay?: number | null,
  dueDay?: number | null
): string[] {
  // Sesión J.1.14, TAREA 4: si closingDay SÍ está configurado pero dueDay no, el
  // cálculo antes ignoraba closingDay por completo y caía al heurístico ciego de
  // "+30 días desde la compra" — una fecha sin ninguna relación con el ciclo real
  // de la tarjeta, que por casualidad de calendario puede caer cerca (pero no
  // exactamente) del día de cierre real, generando confusión ("cierre día 7,
  // vencimiento mostrado día 8" sin que el usuario haya configurado ningún
  // vencimiento). Con closingDay conocido, usarlo también como proxy del
  // vencimiento (mismo ciclo mensual, solo sin el offset real de días entre
  // cierre y vencimiento) es una aproximación más honesta que ignorarlo — sigue
  // marcado como aproximado en la UI (`missingDays` en /cuotas) mientras falte
  // dueDay real.
  if (!closingDay) {
    const base = new Date(expenseDateStr + "T12:00:00");
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + 30 * (i + 1));
      return d.toISOString().split("T")[0];
    });
  }
  const effectiveDueDay = dueDay ?? closingDay;
  const expDate = new Date(expenseDateStr + "T12:00:00");
  const expDay = expDate.getDate();
  let closingMonth = expDate.getMonth();
  let closingYear = expDate.getFullYear();
  if (expDay > closingDay) {
    closingMonth++;
    if (closingMonth > 11) { closingMonth = 0; closingYear++; }
  }
  return Array.from({ length: count }, (_, i) => {
    let dueMonth = closingMonth + 1 + i;
    let dueYear = closingYear;
    while (dueMonth > 11) { dueMonth -= 12; dueYear++; }
    const maxDay = new Date(dueYear, dueMonth + 1, 0).getDate();
    return new Date(dueYear, dueMonth, Math.min(effectiveDueDay, maxDay))
      .toISOString()
      .split("T")[0];
  });
}

// ─── createExpense ────────────────────────────────────────────────────────────

export interface CreateExpenseInput {
  amount: number;
  currency: Currency;
  categoryId: string | null;
  accountId: string | null;
  merchant: string | null;
  description: string | null;
  date: string;
  paymentMethod: PaymentMethod;
  installmentsTotal: number;
  coveringAccountId: string | null;
  fundingAccountId: string | null;
  // Para crédito: closing_day/due_day de la cuenta seleccionada (para calcular fechas)
  closingDay?: number | null;
  dueDay?: number | null;
  // Para crédito: moneda de la cuenta de cobertura
  coveringAccountCurrency?: Currency | null;
  // TAREA 8 (Sesión J.1.15): gastos compartidos — filas de expense_participants
  // a insertar (no incluye la parte del usuario, que es implícita).
  participants?: { name: string; amount: number }[];
}

export async function createExpense(
  input: CreateExpenseInput
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const isCredito = input.paymentMethod === "credito";
  const cuotas = isCredito ? Math.max(1, input.installmentsTotal) : 1;
  const installmentAmount = isCredito ? input.amount / cuotas : null;

  const p_expense = {
    user_id: user.id,
    amount: input.amount,
    currency: input.currency,
    category_id: input.categoryId ?? "",
    account_id: input.accountId ?? "",
    merchant: input.merchant ?? null,
    description: input.description ?? null,
    date: input.date,
    source: "app",
    payment_method: input.paymentMethod,
    installments_total: isCredito ? cuotas.toString() : "",
    installment_amount: installmentAmount ? installmentAmount.toString() : "",
    covering_account_id: (isCredito && input.coveringAccountId) ? input.coveringAccountId : "",
    funding_account_id:  (isCredito && input.coveringAccountId && input.fundingAccountId)
      ? input.fundingAccountId : "",
  };

  // Cuotas con fechas reales
  const p_installments = isCredito
    ? getInstallmentDueDates(input.date, cuotas, input.closingDay, input.dueDay).map((due, i) => ({
        installment_number: i + 1,
        amount: installmentAmount!,
        due_date: due,
      }))
    : [];

  // Earmark: solo cuando crédito CON cuenta de cobertura
  let p_earmark: object | null = null;
  if (isCredito && input.coveringAccountId) {
    const dueDates = p_installments.map((i) => i.due_date);
    const lastDueDate = dueDates[dueDates.length - 1] ?? null;
    p_earmark = {
      user_id: user.id,
      account_id: input.coveringAccountId,
      amount: input.amount,
      currency: input.coveringAccountCurrency ?? input.currency,
      reason: `Cuotas: ${(input.merchant ?? input.description ?? "gasto").trim()} (${cuotas}x)`,
      release_date: lastDueDate ?? "",
    };
  }

  const { data, error } = await supabase.rpc("create_expense_with_balance", {
    p_expense,
    p_installments,
    p_earmark,
  });

  if (error) return { error: error.message };

  // TAREA 8: insert best-effort de expense_participants — no atómico con el
  // gasto (mismo nivel de tolerancia que holding_price_history, es metadata de
  // "quién debe qué", no plata: la plata del gasto ya se contabilizó al 100%
  // en create_expense_with_balance arriba). Validación server-side de defensa
  // en profundidad (agente-seguridad): la suma de lo que deben las otras
  // personas nunca puede ser ≥ el monto total, aunque ExpenseForm ya lo
  // valida client-side — no confiar solo en la validación del cliente.
  const participantsSum = (input.participants ?? []).reduce((s, p) => s + p.amount, 0);
  if (
    input.participants &&
    input.participants.length > 0 &&
    input.participants.every((p) => p.name.trim().length > 0 && p.amount > 0) &&
    participantsSum < input.amount
  ) {
    try {
      await supabase.from("expense_participants").insert(
        input.participants.map((p) => ({
          expense_id: data as string,
          name: p.name,
          amount: p.amount,
        }))
      );
    } catch {
      // no interrumpe el flujo — el gasto ya se guardó correctamente
    }
  }

  return { id: data as string };
}

// ─── deleteExpense ────────────────────────────────────────────────────────────

export async function deleteExpense(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("delete_expense_with_balance", {
    p_expense_id: id,
  });

  if (error) return { error: error.message };
  return {};
}

// ─── updateExpense ────────────────────────────────────────────────────────────

export interface UpdateExpenseInput {
  amount?: number;
  merchant?: string | null;
  description?: string | null;
  categoryId?: string | null;
  date?: string;
}

export async function updateExpense(
  id: string,
  input: UpdateExpenseInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const p_updates: Record<string, string | null> = {};
  if (input.amount !== undefined)      p_updates.amount      = input.amount.toString();
  if (input.merchant !== undefined)    p_updates.merchant    = input.merchant;
  if (input.description !== undefined) p_updates.description = input.description;
  if (input.categoryId !== undefined)  p_updates.category_id = input.categoryId;
  if (input.date !== undefined)        p_updates.date        = input.date;

  const { error } = await supabase.rpc("update_expense_with_balance", {
    p_expense_id: id,
    p_updates,
  });

  if (error) return { error: error.message };
  return {};
}
