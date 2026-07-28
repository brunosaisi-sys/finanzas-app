"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createIncome } from "../../actions";
import { getLeafAccounts } from "@/lib/accounts";
import { formatInputAmount } from "@/lib/format";
import type { Account, Currency, IncomeType } from "@/types";

interface Props {
  accounts: Account[];
}

const INPUT =
  "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {hint && <p className="text-[11px] text-gray-400 leading-tight">{hint}</p>}
      {children}
    </div>
  );
}

export default function IncomeForm({ accounts }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [type, setType] = useState<IncomeType>("sueldo");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");

  const leafAccounts = getLeafAccounts(accounts);
  const filteredAccounts = leafAccounts.filter((a) => a.currency === currency);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitIncome({ distribute: type === "sueldo" });
  }

  async function handleSoloRegistrar() {
    await submitIncome({ distribute: false });
  }

  async function submitIncome({ distribute }: { distribute: boolean }) {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Ingresá un monto válido");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const result = await createIncome({
        amount: parsed,
        currency,
        type,
        account_id: accountId || null,
        date,
        note: note.trim() || null,
      });

      if ("error" in result) {
        setError(result.error);
        setSaving(false);
        return;
      }

      if (distribute) {
        router.push(`/ingresos/distribuir?ingreso_id=${result.id}`);
      } else {
        router.push("/");
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
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Ingreso
        </h2>

        <Field label="Tipo de ingreso">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as IncomeType)}
            className={INPUT}
          >
            <option value="sueldo">Sueldo</option>
            <option value="freelance">Freelance</option>
            <option value="otro">Otro</option>
          </select>
          {type === "sueldo" && (
            <p className="text-[11px] text-indigo-600 mt-1">
              Se abrirá la pantalla de distribución para repartir el ingreso
            </p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={INPUT}
            />
            {amount && currency === "ARS" && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                {formatInputAmount(amount, "ARS")}
              </p>
            )}
          </Field>
          <Field label="Moneda">
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
          </Field>
        </div>

        <Field
          label="Cuenta destino (opcional)"
          hint="Cuenta donde aterrizó el ingreso"
        >
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={INPUT}
          >
            <option value="">Sin cuenta específica</option>
            {filteredAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fecha">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label="Nota (opcional)">
          <input
            type="text"
            placeholder="ej: Sueldo julio 2026"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={INPUT}
          />
        </Field>
      </section>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving || !amount}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 transition-opacity"
      >
        {saving
          ? "Guardando…"
          : type === "sueldo"
          ? "Registrar y distribuir →"
          : "Registrar ingreso"}
      </button>

      {type === "sueldo" && (
        <button
          type="button"
          onClick={handleSoloRegistrar}
          disabled={saving || !amount}
          className="w-full border border-gray-200 rounded-xl py-3 text-sm text-gray-500 font-medium disabled:opacity-40 transition-opacity"
        >
          Solo registrar
        </button>
      )}
    </form>
  );
}
