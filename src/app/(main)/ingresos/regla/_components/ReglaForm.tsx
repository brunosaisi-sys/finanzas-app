"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDistributionRule } from "../../actions";
import type { Account } from "@/types";

interface RuleLine {
  key: string;
  account_id: string;
  label: string;
  percentage: string;
}

interface Props {
  accounts: Account[];
  initialLines: RuleLine[];
}

const INPUT =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";

export default function ReglaForm({ accounts, initialLines }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<RuleLine[]>(
    initialLines.length > 0
      ? initialLines
      : [
          {
            key: "default-1",
            account_id: accounts[0]?.id ?? "",
            label: "Gastos del mes",
            percentage: "60",
          },
          {
            key: "default-2",
            account_id: accounts[0]?.id ?? "",
            label: "Ahorro",
            percentage: "20",
          },
          {
            key: "default-3",
            account_id: accounts[0]?.id ?? "",
            label: "Fondos bienes",
            percentage: "20",
          },
        ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPct = lines.reduce((s, l) => {
    const v = parseFloat(l.percentage);
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  function update(key: string, field: keyof RuleLine, value: string) {
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
        label: "Nueva línea",
        percentage: "0",
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function handleSave() {
    if (totalPct > 100) {
      setError("La suma de porcentajes no puede superar 100%");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await saveDistributionRule(
        lines
          .filter((l) => parseFloat(l.percentage) > 0)
          .map((l) => ({
            account_id: l.account_id || null,
            label: l.label,
            percentage: parseFloat(l.percentage),
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

  return (
    <div className="space-y-5 pb-8">
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Líneas de distribución
          </h2>
          <button
            type="button"
            onClick={addLine}
            className="text-xs font-medium text-indigo-600"
          >
            + Agregar
          </button>
        </div>

        <div className="space-y-4">
          {lines.map((line) => (
            <div
              key={line.key}
              className="space-y-2 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
            >
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 mb-1">Cuenta destino</p>
                  <select
                    value={line.account_id}
                    onChange={(e) => update(line.key, "account_id", e.target.value)}
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
                    onChange={(e) => update(line.key, "label", e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Porcentaje (%)</p>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={line.percentage}
                    onChange={(e) => update(line.key, "percentage", e.target.value)}
                    className={INPUT}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totalizador */}
        <div
          className={`flex justify-between items-center pt-2 border-t ${
            totalPct > 100 ? "border-red-200" : "border-gray-200"
          }`}
        >
          <span className="text-xs font-medium text-gray-500">Total asignado</span>
          <span
            className={`text-sm font-bold ${
              totalPct > 100 ? "text-red-600" : totalPct === 100 ? "text-green-600" : "text-gray-900"
            }`}
          >
            {totalPct.toFixed(0)}%
          </span>
        </div>
        {totalPct < 100 && totalPct > 0 && (
          <p className="text-[11px] text-gray-400">
            El {(100 - totalPct).toFixed(0)}% restante queda sin asignar
          </p>
        )}
      </section>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || lines.length === 0 || totalPct > 100}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 transition-opacity"
      >
        {saving ? "Guardando…" : "Guardar regla"}
      </button>
    </div>
  );
}
