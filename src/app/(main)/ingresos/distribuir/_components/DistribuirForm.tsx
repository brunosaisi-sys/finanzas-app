"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDistribution } from "../../actions";
import { formatCurrency } from "@/lib/format";
import type { Currency, Account } from "@/types";
import type { ObligationBreakdownItem } from "@/lib/finance/monthlyObligations";

interface EditableLine {
  key: string;
  account_id: string;
  label: string;
  amount: string;
}

interface Props {
  incomeId: string;
  incomeAmount: number;
  incomeCurrency: Currency;
  breakdown: ObligationBreakdownItem[];
  obligationsTotal: number; // en la misma moneda que el ingreso
  obligationsTotalOther: number; // en la otra moneda (informativo)
  otherCurrency: Currency;
  disponible: number;
  suggestedLines: EditableLine[];
  accounts: Account[];
}

export default function DistribuirForm({
  incomeId,
  incomeAmount,
  incomeCurrency,
  breakdown,
  obligationsTotal,
  obligationsTotalOther,
  otherCurrency,
  disponible,
  suggestedLines,
  accounts,
}: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<EditableLine[]>(suggestedLines);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAsignado = lines.reduce((s, l) => {
    const v = parseFloat(l.amount);
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  const sobrante = disponible - totalAsignado;

  function updateLine(key: string, field: keyof EditableLine, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: Math.random().toString(36).slice(2),
        account_id: accounts[0]?.id ?? "",
        label: "Ahorro",
        amount: "0",
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function handleConfirm() {
    const validLines = lines.filter((l) => {
      const v = parseFloat(l.amount);
      return l.account_id && !isNaN(v) && v > 0;
    });
    if (validLines.length === 0) {
      setError("Agregá al menos una línea de distribución con monto mayor a 0");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await confirmDistribution(
        incomeId,
        validLines.map((l) => ({
          account_id: l.account_id,
          amount: parseFloat(l.amount),
          currency: incomeCurrency,
        }))
      );
      if (result.error) {
        setError(result.error);
        setSaving(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setSaving(false);
    }
  }

  const INPUT =
    "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";

  return (
    <div className="space-y-5 pb-8">
      {/* Bloque 1: Ingresaron */}
      <section className="bg-gray-900 text-white rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Ingresaron
        </p>
        <p className="text-3xl font-bold tabular-nums">
          {formatCurrency(incomeAmount, incomeCurrency)}
        </p>
      </section>

      {/* Bloque 2: Obligaciones del mes */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Obligaciones del mes
        </h2>
        {breakdown.length === 0 ? (
          <p className="text-sm text-gray-400">Sin obligaciones registradas</p>
        ) : (
          <div className="space-y-2">
            {breakdown.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{item.label}</p>
                  <p className="text-[11px] text-gray-400 capitalize">{item.type}</p>
                </div>
                <p className="text-sm font-medium tabular-nums text-gray-900 shrink-0 ml-3">
                  {formatCurrency(item.amount, item.currency as Currency)}
                </p>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2 flex justify-between">
              <span className="text-xs font-medium text-gray-500">
                Total {incomeCurrency}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(obligationsTotal, incomeCurrency)}
              </span>
            </div>
            {obligationsTotalOther > 0 && (
              <p className="text-[11px] text-gray-400">
                + {formatCurrency(obligationsTotalOther, otherCurrency)} en {otherCurrency} (informativo — apartar por separado)
              </p>
            )}
          </div>
        )}
      </section>

      {/* Bloque 3: Disponible */}
      <section className="bg-indigo-50 rounded-2xl p-4">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-1">
          Disponible para distribuir
        </p>
        <p className={`text-2xl font-bold tabular-nums ${disponible < 0 ? "text-red-600" : "text-indigo-700"}`}>
          {formatCurrency(disponible, incomeCurrency)}
        </p>
        {disponible < 0 && (
          <p className="text-xs text-red-500 mt-1">
            Las obligaciones superan el ingreso en esta moneda
          </p>
        )}
      </section>

      {/* Bloque 4: Distribución */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Distribución
          </h2>
          <button
            type="button"
            onClick={addLine}
            className="text-xs font-medium text-indigo-600"
          >
            + Agregar línea
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">
            Sin líneas. Agregá una para continuar.
          </p>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.key} className="space-y-2 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 mb-1">Cuenta</p>
                    <select
                      value={line.account_id}
                      onChange={(e) => updateLine(line.key, "account_id", e.target.value)}
                      className={INPUT}
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="self-end pb-2 text-gray-300 hover:text-red-400 text-lg"
                  >
                    ×
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Etiqueta</p>
                    <input
                      type="text"
                      value={line.label}
                      onChange={(e) => updateLine(line.key, "label", e.target.value)}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">
                      Monto ({incomeCurrency})
                    </p>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.amount}
                      onChange={(e) => updateLine(line.key, "amount", e.target.value)}
                      className={INPUT}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resumen */}
        <div className="border-t border-gray-200 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Asignado</span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(totalAsignado, incomeCurrency)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Sobrante</span>
            <span className={`font-semibold tabular-nums ${sobrante < 0 ? "text-red-600" : "text-gray-700"}`}>
              {formatCurrency(sobrante, incomeCurrency)}
            </span>
          </div>
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={saving || lines.length === 0}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 transition-opacity"
      >
        {saving ? "Confirmando…" : "Confirmar distribución"}
      </button>
    </div>
  );
}
