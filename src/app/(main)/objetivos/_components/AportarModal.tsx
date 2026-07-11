"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addContribution } from "../actions";
import { formatCurrency } from "@/lib/format";
import type { Account, Currency } from "@/types";

interface Props {
  targetKind: "asset" | "goal";
  targetId: string;
  targetName: string;
  targetCurrency: Currency;
  destAccountId: string | null;
  suggestedAmount: number;
  accounts: Account[];
  onClose: () => void;
}

export default function AportarModal({
  targetKind,
  targetId,
  targetName,
  targetCurrency,
  destAccountId,
  suggestedAmount,
  accounts,
  onClose,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    suggestedAmount > 0 ? String(Math.round(suggestedAmount * 100) / 100) : ""
  );
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Solo mostrar cuentas en la misma moneda que la meta
  const eligibleAccounts = accounts.filter(
    (a) => a.currency === targetCurrency && !a.parent_id === false || true
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Ingresá un monto válido");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await addContribution({
      targetKind,
      targetId,
      targetName,
      amount: parsedAmount,
      currency: targetCurrency,
      fromAccountId: fromAccountId || null,
      destAccountId,
      date,
      note: note.trim() || null,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Aportar a "{targetName}"
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Monto */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Monto ({targetCurrency})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder={suggestedAmount > 0 ? formatCurrency(suggestedAmount, targetCurrency) : "0"}
              required
            />
          </div>

          {/* Cuenta de origen */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Cuenta de origen{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Sin cuenta específica</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatCurrency(a.balance, a.currency)})
                </option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>

          {/* Nota */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nota{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="ej. Parte del sueldo de julio"
              maxLength={200}
            />
          </div>

          {destAccountId && (
            <p className="text-xs text-indigo-600">
              Se reservará en la cuenta asignada a esta meta.
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm text-gray-600 border border-gray-300 rounded-lg py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 text-sm font-medium bg-gray-900 text-white rounded-lg py-2 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Confirmar aporte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
