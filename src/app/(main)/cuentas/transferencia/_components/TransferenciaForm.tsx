"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTransfer } from "../../actions";
import { accountDisplayName } from "@/lib/accounts";
import { formatCurrency } from "@/lib/format";
import type { Account, Currency } from "@/types";

interface Props {
  accounts: Account[];
}

const INPUT =
  "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";

export default function TransferenciaForm({ accounts }: Props) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromAccount = accounts.find((a) => a.id === fromId);
  const toAccount = accounts.find((a) => a.id === toId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      setError("Ingresá un monto válido mayor a 0");
      return;
    }
    if (fromId === toId) {
      setError("La cuenta origen y destino no pueden ser la misma");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const result = await createTransfer({
        from_account_id: fromId,
        to_account_id: toId,
        amount: parsed,
        currency: (fromAccount?.currency ?? "ARS") as Currency,
        date,
        note: note.trim() || null,
      });

      if (result.error) {
        setError(result.error);
        setSaving(false);
      } else {
        router.push("/cuentas");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-8">
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Cuenta origen</label>
          <select
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            className={INPUT}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {accountDisplayName(a, accounts)} ({a.currency}) — {formatCurrency(Number(a.balance), a.currency)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Cuenta destino</label>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className={INPUT}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {accountDisplayName(a, accounts)} ({a.currency}) — {formatCurrency(Number(a.balance), a.currency)}
              </option>
            ))}
          </select>
          {fromAccount && toAccount && fromAccount.currency !== toAccount.currency && (
            <p className="text-[11px] text-amber-600 mt-1">
              Las cuentas tienen monedas distintas. El monto se debitará/acreditará tal cual, sin conversión.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">
            Monto ({fromAccount?.currency ?? "ARS"})
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={INPUT}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Fecha</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Nota (opcional)</label>
          <input
            type="text"
            placeholder="ej: Paso de banco a inversiones"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={INPUT}
          />
        </div>
      </section>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      <button
        type="submit"
        disabled={saving || !amount || fromId === toId}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 transition-opacity"
      >
        {saving ? "Transfiriendo…" : "Confirmar transferencia"}
      </button>
    </form>
  );
}
