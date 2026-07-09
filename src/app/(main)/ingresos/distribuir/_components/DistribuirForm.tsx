"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDistribution, updateEmergencyFund } from "../../actions";
import { formatCurrency, formatInputAmount } from "@/lib/format";
import { getLeafAccounts, accountDisplayName } from "@/lib/accounts";
import type { Currency, Account } from "@/types";
import type { ObligationBreakdownItem } from "@/lib/finance/monthlyObligations";

interface EmergencyFundInfo {
  id: string;
  currentAmount: number;
  targetAmount: number;
  suggestedContribution: number;
  monthsOfData: number;
}

interface Layer3Line {
  key: string;
  label: string;
  pct: number;
  amount: string;
  accountId: string;
  edited: boolean;
}

interface Props {
  incomeId: string;
  incomeAmount: number;
  incomeCurrency: Currency;
  breakdown: ObligationBreakdownItem[];
  obligationsIncomeCurrency: number;
  obligationsOtherCurrency: number;
  otherCurrency: Currency;
  accounts: Account[];
  emergencyFund: EmergencyFundInfo;
}

function remanente(
  incomeAmount: number,
  obligationsIncomeCurrency: number,
  emergencyContrib: string
): number {
  return incomeAmount - obligationsIncomeCurrency - (parseFloat(emergencyContrib) || 0);
}

function initLayer3(rem: number): Layer3Line[] {
  return [
    { key: "gastos", label: "Gastos corrientes", pct: 50, amount: Math.max(0, Math.round(rem * 0.5)).toString(), accountId: "", edited: false },
    { key: "ocio",   label: "Ocio",               pct: 30, amount: Math.max(0, Math.round(rem * 0.3)).toString(), accountId: "", edited: false },
    { key: "inv",    label: "Inversión",           pct: 20, amount: Math.max(0, Math.round(rem * 0.2)).toString(), accountId: "", edited: false },
  ];
}

export default function DistribuirForm({
  incomeId,
  incomeAmount,
  incomeCurrency,
  breakdown,
  obligationsIncomeCurrency,
  obligationsOtherCurrency,
  otherCurrency,
  accounts,
  emergencyFund,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialContrib = emergencyFund.suggestedContribution > 0
    ? emergencyFund.suggestedContribution.toString()
    : "0";

  const [emergencyContrib, setEmergencyContrib] = useState(initialContrib);

  const initialRem = remanente(incomeAmount, obligationsIncomeCurrency, initialContrib);
  const [layer3, setLayer3] = useState<Layer3Line[]>(initLayer3(initialRem));

  const leafAccounts = getLeafAccounts(accounts);
  const rem = remanente(incomeAmount, obligationsIncomeCurrency, emergencyContrib);

  function handleEmergencyChange(val: string) {
    setEmergencyContrib(val);
    const newRem = remanente(incomeAmount, obligationsIncomeCurrency, val);
    setLayer3((prev) =>
      prev.map((l) =>
        l.edited
          ? l
          : { ...l, amount: Math.max(0, Math.round((newRem * l.pct) / 100)).toString() }
      )
    );
  }

  function handleAmount(key: string, val: string) {
    setLayer3((prev) =>
      prev.map((l) => (l.key === key ? { ...l, amount: val, edited: true } : l))
    );
  }

  function handleAccount(key: string, val: string) {
    setLayer3((prev) => prev.map((l) => (l.key === key ? { ...l, accountId: val } : l)));
  }

  function resetSuggested() {
    setLayer3((prev) =>
      prev.map((l) => ({
        ...l,
        amount: Math.max(0, Math.round((rem * l.pct) / 100)).toString(),
        edited: false,
      }))
    );
  }

  const totalLayer3 = layer3.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const sobrante = rem - totalLayer3;

  const progressPct =
    emergencyFund.targetAmount > 0
      ? Math.min(100, Math.round((emergencyFund.currentAmount / emergencyFund.targetAmount) * 100))
      : 0;

  async function handleConfirm() {
    const contrib = parseFloat(emergencyContrib) || 0;
    const validLines = layer3
      .filter((l) => l.accountId && parseFloat(l.amount) > 0)
      .map((l) => ({
        account_id: l.accountId,
        amount: parseFloat(l.amount),
        currency: incomeCurrency,
      }));

    if (contrib === 0 && validLines.length === 0) {
      setError("Asigná al menos una cuenta en la distribución o un aporte al fondo de emergencia");
      return;
    }

    setSaving(true);
    setError(null);

    if (contrib > 0 && emergencyFund.id) {
      const r1 = await updateEmergencyFund(emergencyFund.id, contrib);
      if (r1.error) {
        setError(r1.error);
        setSaving(false);
        return;
      }
    }

    // confirmDistribution siempre se llama para marcar el ingreso como distributed
    const r2 = await confirmDistribution(incomeId, validLines);
    if (r2.error) {
      setError(r2.error);
      setSaving(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  const INPUT =
    "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";

  return (
    <div className="space-y-4 pb-8">

      {/* Ingresaron */}
      <section className="bg-gray-900 text-white rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Ingresaron
        </p>
        <p className="text-3xl font-bold tabular-nums">
          {formatCurrency(incomeAmount, incomeCurrency)}
        </p>
      </section>

      {/* Capa 1: Obligaciones del mes */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Capa 1 — Obligaciones del mes
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Compromisos ya contraídos · no editables
          </p>
        </div>

        {breakdown.length === 0 ? (
          <p className="text-sm text-gray-400">Sin obligaciones registradas este mes</p>
        ) : (
          <div className="space-y-2">
            {breakdown.map((item, i) => {
              const isOther = item.currency !== incomeCurrency;
              return (
                <div
                  key={i}
                  className={`flex justify-between items-start ${isOther ? "opacity-55" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">{item.label}</p>
                    <p className="text-[11px] text-gray-400 capitalize">
                      {item.type === "sinking"
                        ? "amortización"
                        : item.type === "maintenance"
                        ? "mantenimiento"
                        : "cuota"}
                      {isOther && " · informativo"}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-medium tabular-nums shrink-0 ml-3 ${
                      isOther ? "text-gray-400" : "text-gray-900"
                    }`}
                  >
                    {formatCurrency(item.amount, item.currency as Currency)}
                  </p>
                </div>
              );
            })}

            <div className="border-t border-gray-100 pt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Total a cubrir ({incomeCurrency})
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(obligationsIncomeCurrency, incomeCurrency)}
                </span>
              </div>
              {obligationsOtherCurrency > 0 && (
                <div className="flex justify-between">
                  <span className="text-[11px] text-gray-400">
                    Informativo — cubrir con tus {otherCurrency}
                  </span>
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    {formatCurrency(obligationsOtherCurrency, otherCurrency)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Capa 2: Fondo de emergencia (solo ARS) */}
      {incomeCurrency === "ARS" && (
        <section className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
          <div>
            <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Capa 2 — Fondo de emergencia
            </h2>
            <p className="text-[11px] text-amber-600 mt-0.5">
              Meta: 3× el promedio mensual de gastos
              {emergencyFund.monthsOfData > 0
                ? ` · basado en ${emergencyFund.monthsOfData} mes${emergencyFund.monthsOfData > 1 ? "es" : ""} de historial`
                : " · sin historial aún"}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 tabular-nums">
                {formatCurrency(emergencyFund.currentAmount, "ARS")}
              </span>
              <span className="text-gray-500">
                {emergencyFund.targetAmount > 0
                  ? `Meta: ${formatCurrency(emergencyFund.targetAmount, "ARS")}`
                  : "Meta: sin datos de gastos"}
              </span>
            </div>
            {emergencyFund.targetAmount > 0 && (
              <>
                <div className="w-full bg-amber-100 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-amber-600">
                  {progressPct}% completado
                  {progressPct >= 100 && " · ¡Meta alcanzada!"}
                </p>
              </>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Aporte este mes
              {emergencyFund.suggestedContribution > 0 && (
                <span className="text-gray-400 font-normal ml-1">
                  (sugerido: {formatCurrency(emergencyFund.suggestedContribution, "ARS")}/mes)
                </span>
              )}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={emergencyContrib}
              onChange={(e) => handleEmergencyChange(e.target.value)}
              className={INPUT}
            />
            {emergencyContrib && parseFloat(emergencyContrib) > 0 && (
              <p className="text-[11px] text-amber-600 mt-0.5 text-right">
                {formatInputAmount(emergencyContrib, "ARS")}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Disponible */}
      <section className={`rounded-2xl p-4 ${rem < 0 ? "bg-red-50" : "bg-indigo-50"}`}>
        <p
          className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
            rem < 0 ? "text-red-400" : "text-indigo-400"
          }`}
        >
          Disponible para distribuir
        </p>
        <p
          className={`text-2xl font-bold tabular-nums ${
            rem < 0 ? "text-red-600" : "text-indigo-700"
          }`}
        >
          {formatCurrency(rem, incomeCurrency)}
        </p>
        {rem < 0 && (
          <p className="text-xs text-red-500 mt-1">
            Las obligaciones y el fondo superan el ingreso
          </p>
        )}
      </section>

      {/* Capa 3: 50/30/20 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Capa 3 — Distribución 50/30/20
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Sobre {formatCurrency(Math.max(0, rem), incomeCurrency)} disponible · §2.5
            </p>
          </div>
          {layer3.some((l) => l.edited) && (
            <button
              type="button"
              onClick={resetSuggested}
              className="text-xs text-indigo-600 font-medium shrink-0 ml-2"
            >
              Restablecer
            </button>
          )}
        </div>

        <div className="space-y-3">
          {layer3.map((line) => (
            <div
              key={line.key}
              className="space-y-2 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{line.label}</p>
                  <p className="text-[11px] text-gray-400">{line.pct}% del disponible</p>
                </div>
                {line.edited && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    editado
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Monto ({incomeCurrency})</p>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={line.amount}
                    onChange={(e) => handleAmount(line.key, e.target.value)}
                    className={INPUT}
                  />
                  {line.amount && incomeCurrency === "ARS" && parseFloat(line.amount) > 0 && (
                    <p className="text-[11px] text-gray-400 mt-0.5 text-right">
                      {formatInputAmount(line.amount, "ARS")}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Cuenta destino</p>
                  <select
                    value={line.accountId}
                    onChange={(e) => handleAccount(line.key, e.target.value)}
                    className={INPUT}
                  >
                    <option value="">Sin cuenta</option>
                    {leafAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {accountDisplayName(a, accounts)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Resumen Capa 3 */}
        <div className="border-t border-gray-200 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Asignado</span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(totalLayer3, incomeCurrency)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Sobrante</span>
            <span
              className={`font-semibold tabular-nums ${
                sobrante < 0
                  ? "text-red-600"
                  : sobrante === 0
                  ? "text-green-600"
                  : "text-gray-700"
              }`}
            >
              {formatCurrency(sobrante, incomeCurrency)}
            </span>
          </div>
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={saving}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 transition-opacity"
      >
        {saving ? "Confirmando…" : "Confirmar distribución"}
      </button>
    </div>
  );
}
