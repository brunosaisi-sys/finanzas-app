"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateIncome, deleteIncome } from "@/app/(main)/ingresos/actions";
import { getLeafAccounts, accountDisplayName } from "@/lib/accounts";
import { formatCurrency } from "@/lib/format";
import type { Account, Income, Currency, IncomeType } from "@/types";

interface Props {
  income: Income;
  accounts: Account[];
}

const INPUT =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";

export default function EditIncomeForm({ income, accounts }: Props) {
  const router = useRouter();
  const leafAccounts = getLeafAccounts(accounts);

  const [amount, setAmount] = useState(income.amount.toString());
  const [currency, setCurrency] = useState<Currency>(income.currency);
  const [type, setType] = useState<IncomeType>(income.type ?? "otro");
  const [accountId, setAccountId] = useState(income.account_id ?? "");
  const [date, setDate] = useState(income.date);
  const [note, setNote] = useState(income.note ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filteredAccounts = leafAccounts.filter((a) => a.currency === currency);

  const isDistributed = income.distributed;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!isDistributed && (isNaN(parsedAmount) || parsedAmount <= 0)) {
      setError("Ingresá un monto válido mayor a 0");
      return;
    }

    setSaving(true);
    const result = await updateIncome(income.id, {
      ...(isDistributed ? {} : { amount: parsedAmount, currency }),
      type,
      account_id: accountId || null,
      date,
      note: note.trim() || null,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/ingresos");
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteIncome(income.id);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      setConfirmDelete(false);
      return;
    }
    router.push("/ingresos");
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 pb-8">

      {/* Monto + Moneda */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
        {isDistributed ? (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(Number(income.amount), income.currency)}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              El monto y la moneda no son editables: el ingreso ya fue distribuido
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0.01"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={INPUT}
            />
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value as Currency);
                setAccountId("");
              }}
              className={INPUT}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        )}
      </div>

      {/* Tipo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
        <select value={type} onChange={(e) => setType(e.target.value as IncomeType)} className={INPUT}>
          <option value="sueldo">Sueldo</option>
          <option value="freelance">Freelance</option>
          <option value="otro">Otro</option>
        </select>
      </div>

      {/* Cuenta */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cuenta destino <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={INPUT}>
          <option value="">Sin cuenta específica</option>
          {filteredAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {accountDisplayName(a, accounts)}
            </option>
          ))}
        </select>
      </div>

      {/* Fecha */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={INPUT}
        />
      </div>

      {/* Nota */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nota <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ej: Sueldo julio 2026"
          className={INPUT}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 transition-opacity"
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>

      {/* Si no distribuido: botón Distribuir ahora */}
      {!isDistributed && (
        <button
          type="button"
          onClick={() => router.push(`/ingresos/distribuir?ingreso_id=${income.id}`)}
          className="w-full border border-indigo-200 text-indigo-600 rounded-xl py-3 text-sm font-medium hover:bg-indigo-50 transition-colors"
        >
          Distribuir ahora →
        </button>
      )}

      {/* Eliminar */}
      <div className="pt-2">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-colors"
          >
            Eliminar ingreso
          </button>
        ) : (
          <div className="space-y-2">
            {isDistributed && (
              <p className="text-sm text-center text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                ⚠ Este ingreso ya fue distribuido. Los saldos de las cuentas NO se revertirán.
              </p>
            )}
            <p className="text-sm text-center text-gray-600">
              {isDistributed
                ? "¿Eliminar el registro del ingreso?"
                : "¿Confirmar eliminación?"}
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
                {deleting ? "…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
