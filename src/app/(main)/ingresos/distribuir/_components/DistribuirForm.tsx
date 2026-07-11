"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDistributionWithContributions } from "../../actions";
import { formatCurrency, formatInputAmount } from "@/lib/format";
import AmountInput from "@/components/AmountInput";
import { getLeafAccounts, accountDisplayName } from "@/lib/accounts";
import type { Currency, Account } from "@/types";
import type { ObligationBreakdownItem } from "@/lib/finance/monthlyObligations";
import type { SavingsTarget } from "@/lib/finance/savingsGoals";

interface EmergencyFundInfo {
  id: string;
  currentAmount: number;
  targetAmount: number;
  suggestedContribution: number;
  monthsOfData: number;
}

interface Layer4Line {
  key: string;
  label: string;
  pct: number;
  amount: string;
  accountId: string;
  edited: boolean;
}

interface MetaCheckState {
  checked: boolean;
  amount: string;
}

interface Props {
  incomeId: string;
  incomeAmount: number;
  incomeCurrency: Currency;
  breakdown: ObligationBreakdownItem[];
  capa1IncomeCurrency: number;  // maintenance + cuotas en la moneda del ingreso
  capa1OtherCurrency: number;   // maintenance + cuotas en la otra moneda (informativo)
  otherCurrency: Currency;
  accounts: Account[];
  emergencyFund: EmergencyFundInfo;
  savingsTargets: SavingsTarget[];
}

function calcRem(
  incomeAmount: number,
  capa1: number,
  metasTotal: number,
  emergencyContrib: string
): number {
  return incomeAmount - capa1 - metasTotal - (parseFloat(emergencyContrib) || 0);
}

function initLayer4(rem: number): Layer4Line[] {
  return [
    { key: "gastos", label: "Gastos corrientes", pct: 50, amount: Math.max(0, Math.round(rem * 0.5)).toString(), accountId: "", edited: false },
    { key: "ocio",   label: "Ocio",               pct: 30, amount: Math.max(0, Math.round(rem * 0.3)).toString(), accountId: "", edited: false },
    { key: "inv",    label: "Inversión",           pct: 20, amount: Math.max(0, Math.round(rem * 0.2)).toString(), accountId: "", edited: false },
  ];
}

function initMetaChecks(targets: SavingsTarget[], currency: Currency): Record<string, MetaCheckState> {
  return Object.fromEntries(
    targets
      .filter((t) => t.currency === currency)
      .map((t) => [
        t.id,
        {
          checked: true,
          amount: t.monthlyContribution > 0
            ? String(Math.round(t.monthlyContribution * 100) / 100)
            : "0",
        },
      ])
  );
}

export default function DistribuirForm({
  incomeId,
  incomeAmount,
  incomeCurrency,
  breakdown,
  capa1IncomeCurrency,
  capa1OtherCurrency,
  otherCurrency,
  accounts,
  emergencyFund,
  savingsTargets,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sameCurrencyTargets = savingsTargets.filter((t) => t.currency === incomeCurrency);
  const otherCurrencyTargets = savingsTargets.filter((t) => t.currency !== incomeCurrency);

  const [metaChecks, setMetaChecks] = useState<Record<string, MetaCheckState>>(
    () => initMetaChecks(savingsTargets, incomeCurrency)
  );

  const totalMetasSameCurrency = sameCurrencyTargets.reduce((sum, t) => {
    const mc = metaChecks[t.id];
    if (!mc?.checked) return sum;
    return sum + (parseFloat(mc.amount) || 0);
  }, 0);

  const initialContrib = emergencyFund.suggestedContribution > 0
    ? emergencyFund.suggestedContribution.toString()
    : "0";
  const [emergencyContrib, setEmergencyContrib] = useState(initialContrib);

  const initialRem = calcRem(incomeAmount, capa1IncomeCurrency, totalMetasSameCurrency, initialContrib);
  const [layer4, setLayer4] = useState<Layer4Line[]>(() => initLayer4(initialRem));

  const rem = calcRem(incomeAmount, capa1IncomeCurrency, totalMetasSameCurrency, emergencyContrib);

  function recomputeLayer4(newRem: number) {
    setLayer4((prev) =>
      prev.map((l) =>
        l.edited ? l : { ...l, amount: Math.max(0, Math.round((newRem * l.pct) / 100)).toString() }
      )
    );
  }

  function handleMetaCheck(id: string, checked: boolean) {
    setMetaChecks((prev) => ({ ...prev, [id]: { ...prev[id], checked } }));
    // No recalculamos layer4 automáticamente cuando cambia Capa 2 para no pisarle al usuario sus edits
  }

  function handleMetaAmount(id: string, amount: string) {
    setMetaChecks((prev) => ({ ...prev, [id]: { ...prev[id], amount } }));
  }

  function handleEmergencyChange(val: string) {
    setEmergencyContrib(val);
    const newRem = calcRem(incomeAmount, capa1IncomeCurrency, totalMetasSameCurrency, val);
    recomputeLayer4(newRem);
  }

  function handleAmount4(key: string, val: string) {
    setLayer4((prev) => prev.map((l) => (l.key === key ? { ...l, amount: val, edited: true } : l)));
  }

  function handleAccount4(key: string, val: string) {
    setLayer4((prev) => prev.map((l) => (l.key === key ? { ...l, accountId: val } : l)));
  }

  function resetSuggested() {
    setLayer4((prev) => prev.map((l) => ({
      ...l,
      amount: Math.max(0, Math.round((rem * l.pct) / 100)).toString(),
      edited: false,
    })));
  }

  const totalLayer4 = layer4.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const sobrante = rem - totalLayer4;

  const progressPct =
    emergencyFund.targetAmount > 0
      ? Math.min(100, Math.round((emergencyFund.currentAmount / emergencyFund.targetAmount) * 100))
      : 0;

  // Solo mostrar items de mantenimiento y cuotas en Capa 1 (sinking va a Capa 2)
  const capa1Items = breakdown.filter((item) => item.type !== "sinking");

  const leafAccounts = getLeafAccounts(accounts);

  async function handleConfirm() {
    const contrib = parseFloat(emergencyContrib) || 0;
    const validLines = layer4
      .filter((l) => l.accountId && parseFloat(l.amount) > 0)
      .map((l) => ({
        account_id: l.accountId,
        amount: parseFloat(l.amount),
        currency: incomeCurrency,
      }));

    const contributionPayloads = sameCurrencyTargets
      .filter((t) => {
        const mc = metaChecks[t.id];
        return mc?.checked && parseFloat(mc.amount) > 0;
      })
      .map((t) => ({
        asset_id: t.kind === "asset" ? t.id : null,
        goal_id: t.kind === "goal" ? t.id : null,
        amount: parseFloat(metaChecks[t.id].amount),
        currency: t.currency,
        dest_account_id: t.accountId ?? null,
        name: t.name,
      }));

    if (contrib === 0 && validLines.length === 0 && contributionPayloads.length === 0) {
      setError("Asigná al menos una cuenta en la distribución, un aporte a una meta, o al fondo de emergencia");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await confirmDistributionWithContributions(
      incomeId,
      validLines,
      contributionPayloads,
      contrib,
      emergencyFund.id || null,
    );

    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  const INPUT =
    "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";

  return (
    <div className="space-y-4 pb-8">

      {/* Ingresaron */}
      <section className="bg-gray-900 text-white rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Ingresaron</p>
        <p className="text-3xl font-bold tabular-nums">
          {formatCurrency(incomeAmount, incomeCurrency)}
        </p>
      </section>

      {/* Capa 1 — Obligaciones (mantenimiento + cuotas, sin sinking) */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Capa 1 — Obligaciones del mes
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Mantenimiento de bienes + cuotas · no editables
          </p>
        </div>

        {capa1Items.length === 0 ? (
          <p className="text-sm text-gray-400">Sin obligaciones registradas este mes</p>
        ) : (
          <div className="space-y-2">
            {capa1Items.map((item, i) => {
              const isOther = item.currency !== incomeCurrency;
              return (
                <div key={i} className={`flex justify-between items-start ${isOther ? "opacity-55" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">{item.label}</p>
                    <p className="text-[11px] text-gray-400 capitalize">
                      {item.type === "maintenance" ? "mantenimiento" : "cuota"}
                      {isOther && " · informativo"}
                    </p>
                  </div>
                  <p className={`text-sm font-medium tabular-nums shrink-0 ml-3 ${isOther ? "text-gray-400" : "text-gray-900"}`}>
                    {formatCurrency(item.amount, item.currency as Currency)}
                  </p>
                </div>
              );
            })}
            <div className="border-t border-gray-100 pt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-xs font-medium text-gray-500">Total ({incomeCurrency})</span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(capa1IncomeCurrency, incomeCurrency)}
                </span>
              </div>
              {capa1OtherCurrency > 0 && (
                <div className="flex justify-between">
                  <span className="text-[11px] text-gray-400">Informativo — cubrir con {otherCurrency}</span>
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    {formatCurrency(capa1OtherCurrency, otherCurrency)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Capa 2 — Aportes a metas */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Capa 2 — Metas de ahorro
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Sinking funds de bienes + objetivos · destildá si no aportas este mes
          </p>
        </div>

        {sameCurrencyTargets.length === 0 ? (
          <p className="text-sm text-gray-400">
            Sin metas en {incomeCurrency} — creá una en{" "}
            <a href="/objetivos" className="text-indigo-600 underline">Metas</a>
          </p>
        ) : (
          <div className="space-y-3">
            {sameCurrencyTargets.map((target) => {
              const mc = metaChecks[target.id] ?? { checked: false, amount: "0" };
              return (
                <div key={target.id} className={`pb-3 border-b border-gray-100 last:border-0 last:pb-0 ${!mc.checked ? "opacity-50" : ""}`}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={mc.checked}
                      onChange={(e) => handleMetaCheck(target.id, e.target.checked)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">{target.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${target.kind === "goal" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>
                          {target.kind === "goal" ? "Objetivo" : "Bien"}
                        </span>
                      </div>
                      {/* Mini barra de progreso */}
                      <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 rounded-full"
                          style={{ width: `${Math.min(100, target.progressPct)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {formatCurrency(target.accumulated, target.currency)} de{" "}
                        {formatCurrency(target.targetAmount, target.currency)}{" "}
                        ({Math.round(target.progressPct)}%)
                      </p>
                    </div>
                    <div className="shrink-0 w-28">
                      <p className="text-[10px] text-gray-400 mb-1">Monto</p>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={mc.amount}
                        onChange={(e) => handleMetaAmount(target.id, e.target.value)}
                        disabled={!mc.checked}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="border-t border-gray-100 pt-2 flex justify-between">
              <span className="text-xs font-medium text-gray-500">Total metas ({incomeCurrency})</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(totalMetasSameCurrency, incomeCurrency)}
              </span>
            </div>
          </div>
        )}

        {/* Metas en otra moneda (informativo) */}
        {otherCurrencyTargets.length > 0 && (
          <div className="mt-2 pt-3 border-t border-dashed border-gray-200 space-y-1">
            <p className="text-[11px] text-gray-400 font-medium">
              Además tenés que apartar en {otherCurrency} (informativo):
            </p>
            {otherCurrencyTargets.map((t) => (
              <div key={t.id} className="flex justify-between text-[11px] text-gray-400">
                <span className="truncate">{t.name}</span>
                <span className="tabular-nums shrink-0 ml-2">
                  {formatCurrency(t.monthlyContribution, t.currency)}/mes
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Capa 3 — Fondo de emergencia (solo ARS) */}
      {incomeCurrency === "ARS" && (
        <section className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
          <div>
            <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Capa 3 — Fondo de emergencia
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
              <span className="text-gray-700 tabular-nums">{formatCurrency(emergencyFund.currentAmount, "ARS")}</span>
              <span className="text-gray-500">
                {emergencyFund.targetAmount > 0
                  ? `Meta: ${formatCurrency(emergencyFund.targetAmount, "ARS")}`
                  : "Meta: sin datos de gastos"}
              </span>
            </div>
            {emergencyFund.targetAmount > 0 && (
              <>
                <div className="w-full bg-amber-100 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="text-[11px] text-amber-600">
                  {progressPct}% completado{progressPct >= 100 && " · ¡Meta alcanzada!"}
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
            <AmountInput value={emergencyContrib} onChange={handleEmergencyChange} className={INPUT} />
            {emergencyContrib && parseFloat(emergencyContrib) > 0 && (
              <p className="text-[11px] text-amber-600 mt-0.5 text-right">
                {formatInputAmount(emergencyContrib, "ARS")}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Remanente */}
      <section className={`rounded-2xl p-4 ${rem < 0 ? "bg-red-50" : "bg-indigo-50"}`}>
        <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${rem < 0 ? "text-red-400" : "text-indigo-400"}`}>
          Disponible para distribuir
        </p>
        <p className={`text-2xl font-bold tabular-nums ${rem < 0 ? "text-red-600" : "text-indigo-700"}`}>
          {formatCurrency(rem, incomeCurrency)}
        </p>
        {rem < 0 && (
          <p className="text-xs text-red-500 mt-1">
            Tus compromisos superan el ingreso
          </p>
        )}
      </section>

      {/* Capa 4 — 50/30/20 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Capa 4 — Distribución 50/30/20
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Sobre {formatCurrency(Math.max(0, rem), incomeCurrency)} disponible · §2.5
            </p>
          </div>
          {layer4.some((l) => l.edited) && (
            <button type="button" onClick={resetSuggested} className="text-xs text-indigo-600 font-medium shrink-0 ml-2">
              Restablecer
            </button>
          )}
        </div>

        <div className="space-y-3">
          {layer4.map((line) => (
            <div key={line.key} className="space-y-2 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{line.label}</p>
                  <p className="text-[11px] text-gray-400">{line.pct}% del disponible</p>
                </div>
                {line.edited && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">editado</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Monto ({incomeCurrency})</p>
                  {incomeCurrency === "ARS" ? (
                    <AmountInput value={line.amount} onChange={(raw) => handleAmount4(line.key, raw)} className={INPUT} />
                  ) : (
                    <input type="number" min="0" step="1" value={line.amount} onChange={(e) => handleAmount4(line.key, e.target.value)} className={INPUT} />
                  )}
                  {line.amount && incomeCurrency === "ARS" && parseFloat(line.amount) > 0 && (
                    <p className="text-[11px] text-gray-400 mt-0.5 text-right">
                      {formatInputAmount(line.amount, "ARS")}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Cuenta destino</p>
                  <select value={line.accountId} onChange={(e) => handleAccount4(line.key, e.target.value)} className={INPUT}>
                    <option value="">Sin cuenta</option>
                    {leafAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{accountDisplayName(a, accounts)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Asignado</span>
            <span className="font-semibold tabular-nums">{formatCurrency(totalLayer4, incomeCurrency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Sobrante</span>
            <span className={`font-semibold tabular-nums ${sobrante < 0 ? "text-red-600" : sobrante === 0 ? "text-green-600" : "text-gray-700"}`}>
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
