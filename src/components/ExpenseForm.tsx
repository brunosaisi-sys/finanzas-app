"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getLeafAccounts, accountDisplayName } from "@/lib/accounts";
import { formatInputAmount } from "@/lib/format";
import AmountInput from "@/components/AmountInput";
import type { Account, Category, Currency, PaymentMethod } from "@/types";

// Calcula las fechas de vencimiento de cada cuota.
// Si la cuenta tiene closing_day/due_day configurados (tarjeta de crédito),
// usa el ciclo real de facturación. Si no, fallback: +30 días por cuota.
function getInstallmentDueDates(
  expenseDateStr: string,
  count: number,
  closingDay?: number | null,
  dueDay?: number | null
): string[] {
  if (!closingDay || !dueDay) {
    const base = new Date(expenseDateStr + "T12:00:00");
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + 30 * (i + 1));
      return d.toISOString().split("T")[0];
    });
  }

  const expDate = new Date(expenseDateStr + "T12:00:00");
  const expDay = expDate.getDate();
  // Si el gasto es DESPUÉS del cierre, cae en el próximo ciclo
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
    return new Date(dueYear, dueMonth, Math.min(dueDay, maxDay))
      .toISOString()
      .split("T")[0];
  });
}

interface Props {
  accounts: Account[];
  categories: Category[];
  merchants?: string[];
  redirectTo?: string;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "debito", label: "Débito" },
  { value: "transferencia", label: "Transferencia" },
  { value: "credito", label: "Crédito" },
];

export default function ExpenseForm({
  accounts,
  categories,
  merchants = [],
  redirectTo = "/gastos",
}: Props) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [categoryId, setCategoryId] = useState("");
  const leafAccounts = getLeafAccounts(accounts);
  const [accountId, setAccountId] = useState(leafAccounts[0]?.id ?? "");
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [installmentsTotal, setInstallmentsTotal] = useState(1);
  const [coveringAccountId, setCoveringAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inversionLeafs = leafAccounts.filter(
    (a) => (a as Account).type === "inversion"
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(amount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      setError("Ingresá un monto válido mayor a 0");
      return;
    }

    const isCredito = paymentMethod === "credito";
    const cuotas = isCredito ? Math.max(1, installmentsTotal) : 1;
    const installmentAmount = isCredito ? parsed / cuotas : null;

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesión expirada. Recargá la página.");
      setLoading(false);
      return;
    }

    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        amount: parsed,
        currency,
        category_id: categoryId || null,
        account_id: accountId || null,
        merchant: merchant.trim() || null,
        description: description.trim() || null,
        date,
        source: "app",
        payment_method: paymentMethod,
        installments_total: isCredito ? cuotas : null,
        installment_amount: installmentAmount,
        covering_account_id: isCredito && coveringAccountId ? coveringAccountId : null,
      })
      .select("id")
      .single();

    if (expenseError || !expenseData) {
      setError(expenseError?.message ?? "Error al guardar el gasto");
      setLoading(false);
      return;
    }

    if (isCredito) {
      const selectedAccount = accounts.find((a) => a.id === accountId);
      const dueDates = getInstallmentDueDates(
        date,
        cuotas,
        selectedAccount?.closing_day,
        selectedAccount?.due_day
      );
      const installmentRows = Array.from({ length: cuotas }, (_, i) => ({
        expense_id: expenseData.id,
        installment_number: i + 1,
        amount: installmentAmount!,
        due_date: dueDates[i],
        paid: false,
      }));

      const { error: installmentsError } = await supabase
        .from("installments")
        .insert(installmentRows);

      if (installmentsError) {
        setError(installmentsError.message);
        setLoading(false);
        return;
      }

      if (coveringAccountId) {
        const coveringAccount = accounts.find((a) => a.id === coveringAccountId);
        const { error: earmarkError } = await supabase
          .from("account_earmarks")
          .insert({
            user_id: user.id,
            account_id: coveringAccountId,
            amount: parsed,
            currency: coveringAccount?.currency ?? currency,
            reason: `Cuotas: ${merchant.trim() || description.trim() || "gasto"} (${cuotas}x)`,
            released: false,
          });

        if (earmarkError) {
          setError(earmarkError.message);
          setLoading(false);
          return;
        }
      }
    }

    setLoading(false);
    router.push(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Monto + moneda */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
        <div className="flex gap-2">
          <div className="flex gap-1 shrink-0">
            {(["ARS", "USD"] as Currency[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  currency === c
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {c === "ARS" ? "$" : "US$"}
              </button>
            ))}
          </div>
          <div className="flex-1">
            {currency === "ARS" ? (
              <AmountInput
                required
                value={amount}
                onChange={setAmount}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-right text-lg font-semibold"
              />
            ) : (
              <input
                type="number"
                inputMode="decimal"
                required
                min="0.01"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-right text-lg font-semibold"
              />
            )}
            {amount && currency === "ARS" && (
              <p className="text-[11px] text-gray-400 text-right mt-0.5">
                {formatInputAmount(amount, "ARS")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Medio de pago */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Medio de pago</label>
        <div className="flex gap-1.5 flex-wrap">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.value}
              type="button"
              onClick={() => setPaymentMethod(pm.value)}
              className={`flex-1 min-w-0 py-2 rounded-lg text-sm font-medium border transition-colors ${
                paymentMethod === pm.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
              }`}
            >
              {pm.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sección crédito */}
      {paymentMethod === "credito" && (
        <div className="space-y-3 bg-gray-50 rounded-xl p-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ¿En cuántas cuotas?
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="48"
              step="1"
              value={installmentsTotal}
              onChange={(e) => setInstallmentsTotal(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-center font-semibold"
            />
            {amount && installmentsTotal > 1 && (
              <p className="text-xs text-gray-400 mt-1 text-center">
                {installmentsTotal} cuotas de{" "}
                {(parseFloat(amount.replace(",", ".")) / installmentsTotal).toLocaleString("es-AR", {
                  style: "currency",
                  currency: currency === "USD" ? "USD" : "ARS",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ¿Qué cuenta cubre este pago?{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <select
              value={coveringAccountId}
              onChange={(e) => setCoveringAccountId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="">Sin cuenta de cobertura</option>
              {inversionLeafs.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {accountDisplayName(acc, accounts)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Comercio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Comercio{" "}
          <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          list="merchant-list"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="Ej: Carrefour, YPF, Rappi, Farmacity"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        {merchants.length > 0 && (
          <datalist id="merchant-list">
            {merchants.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        )}
      </div>

      {/* Categoría */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        >
          <option value="">Sin categoría</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Cuenta */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta</label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        >
          <option value="">Sin cuenta</option>
          {leafAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {accountDisplayName(acc, accounts)}
            </option>
          ))}
        </select>
        {(() => {
          if (paymentMethod !== "credito" || !accountId) return null;
          const acc = accounts.find((a) => a.id === accountId);
          if (!acc?.closing_day || !acc?.due_day) return null;
          return (
            <p className="text-[11px] text-indigo-600 mt-0.5">
              Cierre día {acc.closing_day} · Vencimiento día {acc.due_day} — fechas de cuotas calculadas automáticamente
            </p>
          );
        })()}
      </div>

      {/* Fecha */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Nota */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nota{" "}
          <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Compra semanal"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !amount}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {loading ? "Guardando..." : "Guardar gasto"}
      </button>
    </form>
  );
}
