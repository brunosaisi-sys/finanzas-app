"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getLeafAccounts, accountDisplayName } from "@/lib/accounts";
import { formatInputAmount } from "@/lib/format";
import AmountInput from "@/components/AmountInput";
import { updateExpense, deleteExpense } from "@/app/(main)/gastos/actions";
import type { Account, Category, Expense } from "@/types";

interface Props {
  expense: Expense;
  accounts: Account[];
  categories: Category[];
}

export default function EditExpenseForm({ expense, accounts, categories }: Props) {
  const router = useRouter();
  const isCredito = expense.payment_method === "credito";
  const leafAccounts = getLeafAccounts(accounts);

  const [amount, setAmount] = useState(
    expense.currency === "ARS"
      ? Math.round(expense.amount).toString()
      : expense.amount.toString()
  );
  const [categoryId, setCategoryId] = useState(expense.category_id ?? "");
  const [merchant, setMerchant] = useState(expense.merchant ?? "");
  const [description, setDescription] = useState(expense.description ?? "");
  const [date, setDate] = useState(expense.date);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(amount.replace(",", "."));
    if (!isCredito && (isNaN(parsed) || parsed <= 0)) {
      setError("Ingresá un monto válido mayor a 0");
      return;
    }

    setSaving(true);
    const result = await updateExpense(expense.id, {
      amount: isCredito ? undefined : parsed,
      merchant: merchant.trim() || null,
      description: description.trim() || null,
      categoryId: categoryId || null,
      date,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/gastos");
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteExpense(expense.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      setConfirmDelete(false);
      return;
    }
    router.push("/gastos");
  }

  const accountName = leafAccounts.find((a) => a.id === expense.account_id);

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Monto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
        {isCredito ? (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-sm font-semibold text-gray-900">
              {formatInputAmount(Math.round(expense.amount).toString(), "ARS")}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              El monto de gastos en cuotas no se puede editar
              ({expense.installments_total} cuota{expense.installments_total !== 1 ? "s" : ""})
            </p>
          </div>
        ) : (
          <div>
            {expense.currency === "ARS" ? (
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-right text-lg font-semibold"
              />
            )}
            {amount && expense.currency === "ARS" && (
              <p className="text-[11px] text-gray-400 text-right mt-0.5">
                {formatInputAmount(amount, "ARS")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Info de pago — read only */}
      <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2 space-y-0.5">
        <p>Método: <span className="font-medium text-gray-700 capitalize">{expense.payment_method ?? "—"}</span></p>
        {accountName && (
          <p>Cuenta: <span className="font-medium text-gray-700">{accountDisplayName(accountName, accounts)}</span></p>
        )}
      </div>

      {/* Comercio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Comercio <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="Ej: Carrefour, YPF"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
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

      {/* Nota */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nota <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>

      {/* Eliminar */}
      <div className="pt-2">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-colors"
          >
            Eliminar gasto
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-center text-gray-600">
              ¿Confirmar? El balance de la cuenta se va a revertir.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-40"
              >
                {deleting ? "..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
