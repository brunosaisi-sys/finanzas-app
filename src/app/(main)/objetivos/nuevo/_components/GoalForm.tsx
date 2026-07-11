"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGoal } from "../../actions";
import { formatCurrency } from "@/lib/format";
import type { Account, Currency } from "@/types";

interface Props {
  accounts: Account[];
}

export default function GoalForm({ accounts }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [targetMonths, setTargetMonths] = useState("");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseFloat(targetAmount) || 0;
  const parsedMonths = parseInt(targetMonths) || 0;
  const monthly = parsedMonths > 0 ? parsedAmount / parsedMonths : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Ingresá un nombre"); return; }
    if (parsedAmount <= 0) { setError("El monto debe ser mayor a 0"); return; }
    if (parsedMonths <= 0) { setError("El plazo debe ser mayor a 0"); return; }

    setSaving(true);
    setError(null);

    const result = await createGoal({
      name: name.trim(),
      target_amount: parsedAmount,
      currency,
      target_months: parsedMonths,
      account_id: accountId || null,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.push("/objetivos");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre del objetivo
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
          placeholder="ej. Viaje a Europa, Mudanza, Renovar cocina"
          maxLength={100}
          required
        />
      </div>

      {/* Monto + moneda */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Monto meta
        </label>
        <div className="flex gap-2">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white"
          >
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </select>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
            placeholder="3000"
            required
          />
        </div>
      </div>

      {/* Plazo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Plazo (meses)
        </label>
        <input
          type="number"
          min="1"
          max="600"
          value={targetMonths}
          onChange={(e) => setTargetMonths(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
          placeholder="12"
          required
        />
      </div>

      {/* Cuenta donde se guarda */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cuenta donde lo vas a guardar{" "}
          <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white"
        >
          <option value="">Sin cuenta específica</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Si asignás una cuenta, cada aporte reservará el monto ahí.
        </p>
      </div>

      {/* Preview */}
      {monthly > 0 && (
        <div className="bg-indigo-50 rounded-xl p-3 text-sm text-indigo-900">
          Necesitás aportar{" "}
          <span className="font-bold">{formatCurrency(monthly, currency)}/mes</span>{" "}
          durante {parsedMonths} mes{parsedMonths !== 1 ? "es" : ""} para llegar a{" "}
          {formatCurrency(parsedAmount, currency)}.
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-gray-900 text-white text-sm font-medium py-3 rounded-xl disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Crear objetivo"}
      </button>
    </form>
  );
}
