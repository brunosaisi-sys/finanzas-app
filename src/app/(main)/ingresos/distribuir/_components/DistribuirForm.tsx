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
  suggestedPct: number;
  userPct: string;
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
  capa1IncomeCurrency: number;
  capa1OtherCurrency: number;
  otherCurrency: Currency;
  accounts: Account[];
  emergencyFund: EmergencyFundInfo;
  savingsTargets: SavingsTarget[];
}

function makeLayer4(rem: number): Layer4Line[] {
  return [
    { key: "gastos", label: "Gastos corrientes", suggestedPct: 50, userPct: "50", amount: Math.max(0, Math.round(rem * 0.5)).toString(), accountId: "", edited: false },
    { key: "ocio",   label: "Ocio",              suggestedPct: 30, userPct: "30", amount: Math.max(0, Math.round(rem * 0.3)).toString(), accountId: "", edited: false },
    { key: "inv",    label: "Inversión",          suggestedPct: 20, userPct: "20", amount: Math.max(0, Math.round(rem * 0.2)).toString(), accountId: "", edited: false },
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

const INPUT =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";

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
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTheory, setShowTheory] = useState(false);
  const [layer4Mode, setLayer4Mode] = useState<"amount" | "pct">("amount");

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

  // rem: base para calcular los 50/30/20 (después de cubrir capas 1+2+3)
  const rem = Math.max(0, incomeAmount - capa1IncomeCurrency - totalMetasSameCurrency - (parseFloat(emergencyContrib) || 0));

  const [layer4, setLayer4] = useState<Layer4Line[]>(() => {
    const initialRem = Math.max(0, incomeAmount - capa1IncomeCurrency - totalMetasSameCurrency - (parseFloat(initialContrib) || 0));
    return makeLayer4(initialRem);
  });

  function recomputeLayer4(newRem: number, currentMode: "amount" | "pct") {
    setLayer4((prev) =>
      prev.map((l) => {
        if (!l.edited) {
          return {
            ...l,
            amount: Math.max(0, Math.round(newRem * l.suggestedPct / 100)).toString(),
            userPct: l.suggestedPct.toString(),
          };
        }
        if (currentMode === "pct") {
          return {
            ...l,
            amount: Math.max(0, Math.round(newRem * (parseFloat(l.userPct) || 0) / 100)).toString(),
          };
        }
        return l;
      })
    );
  }

  function handleMetaCheck(id: string, checked: boolean) {
    setMetaChecks((prev) => ({ ...prev, [id]: { ...prev[id], checked } }));
  }

  function handleMetaAmount(id: string, amount: string) {
    setMetaChecks((prev) => ({ ...prev, [id]: { ...prev[id], amount } }));
  }

  function handleEmergencyChange(val: string) {
    setEmergencyContrib(val);
    const newRem = Math.max(
      0,
      incomeAmount - capa1IncomeCurrency - totalMetasSameCurrency - (parseFloat(val) || 0)
    );
    recomputeLayer4(newRem, layer4Mode);
  }

  function handleAmount4(key: string, val: string) {
    setLayer4((prev) =>
      prev.map((l) => (l.key === key ? { ...l, amount: val, edited: true } : l))
    );
  }

  function handlePct4(key: string, val: string) {
    const computedAmount = Math.max(0, Math.round(rem * (parseFloat(val) || 0) / 100)).toString();
    setLayer4((prev) =>
      prev.map((l) => (l.key === key ? { ...l, userPct: val, amount: computedAmount, edited: true } : l))
    );
  }

  function handleAccount4(key: string, val: string) {
    setLayer4((prev) =>
      prev.map((l) => (l.key === key ? { ...l, accountId: val } : l))
    );
  }

  function toggleLayer4Mode(newMode: "amount" | "pct") {
    if (newMode === "pct") {
      // Sync userPct from current amounts so el input refleja el estado real
      setLayer4((prev) =>
        prev.map((l) => ({
          ...l,
          userPct:
            rem > 0
              ? ((parseFloat(l.amount) || 0) / rem * 100).toFixed(1)
              : l.suggestedPct.toString(),
        }))
      );
    }
    setLayer4Mode(newMode);
  }

  function resetSuggested() {
    setLayer4(
      makeLayer4(rem).map((l) => ({ ...l, edited: false }))
    );
    if (layer4Mode === "pct") {
      setLayer4Mode("amount");
    }
  }

  const totalLayer4 = layer4.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalAsignado =
    capa1IncomeCurrency +
    totalMetasSameCurrency +
    (parseFloat(emergencyContrib) || 0) +
    totalLayer4;
  const sinAsignar = incomeAmount - totalAsignado;

  const progressPct =
    emergencyFund.targetAmount > 0
      ? Math.min(100, Math.round((emergencyFund.currentAmount / emergencyFund.targetAmount) * 100))
      : 0;

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

    setSaving(true);
    setError(null);

    const result = await confirmDistributionWithContributions(
      incomeId,
      validLines,
      contributionPayloads,
      contrib,
      emergencyFund.id || null
    );

    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  function handleSkip() {
    setSkipping(true);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-4 pb-8">

      {/* Header: Ingresaron + Sin asignar */}
      <section className="bg-gray-900 text-white rounded-2xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Ingresaron
            </p>
            <p className="text-3xl font-bold tabular-nums">
              {formatCurrency(incomeAmount, incomeCurrency)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Sin asignar
            </p>
            <p
              className={`text-xl font-bold tabular-nums ${
                sinAsignar < 0
                  ? "text-red-400"
                  : sinAsignar === 0
                  ? "text-green-400"
                  : "text-gray-200"
              }`}
            >
              {formatCurrency(sinAsignar, incomeCurrency)}
            </p>
          </div>
        </div>
        {sinAsignar > 0 && (
          <p className="text-[11px] text-gray-400 mt-2">
            Podés confirmar dejando parte sin asignar — queda en tus cuentas de origen.
          </p>
        )}
        {sinAsignar < 0 && (
          <p className="text-[11px] text-red-400 mt-2">
            Asignaste más del ingreso recibido.
          </p>
        )}
      </section>

      {/* Obligaciones del mes (no editables) */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Obligaciones del mes
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
                <div
                  key={i}
                  className={`flex justify-between items-start ${isOther ? "opacity-55" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">{item.label}</p>
                    <p className="text-[11px] text-gray-400 capitalize">
                      {item.type === "maintenance" ? "mantenimiento" : "cuota"}
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
                  Total ({incomeCurrency})
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(capa1IncomeCurrency, incomeCurrency)}
                </span>
              </div>
              {capa1OtherCurrency > 0 && (
                <div className="flex justify-between">
                  <span className="text-[11px] text-gray-400">
                    Informativo — cubrir con {otherCurrency}
                  </span>
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    {formatCurrency(capa1OtherCurrency, otherCurrency)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Metas de ahorro (bienes + objetivos) */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Metas de ahorro
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Sinking funds de bienes + objetivos · destildá si no aportás este mes
          </p>
        </div>

        {sameCurrencyTargets.length === 0 ? (
          <p className="text-sm text-gray-400">
            Sin metas en {incomeCurrency} — creá una en{" "}
            <a href="/objetivos" className="text-indigo-600 underline">
              Metas
            </a>
          </p>
        ) : (
          <div className="space-y-3">
            {sameCurrencyTargets.map((target) => {
              const mc = metaChecks[target.id] ?? { checked: false, amount: "0" };
              return (
                <div
                  key={target.id}
                  className={`pb-3 border-b border-gray-100 last:border-0 last:pb-0 ${
                    !mc.checked ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={mc.checked}
                      onChange={(e) => handleMetaCheck(target.id, e.target.checked)}
                      className="mt-0.5 shrink-0 w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {target.name}
                        </p>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            target.kind === "goal"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {target.kind === "goal" ? "Objetivo" : "Bien"}
                        </span>
                      </div>
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
              <span className="text-xs font-medium text-gray-500">
                Total metas ({incomeCurrency})
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(totalMetasSameCurrency, incomeCurrency)}
              </span>
            </div>
          </div>
        )}

        {otherCurrencyTargets.length > 0 && (
          <div className="pt-3 border-t border-dashed border-gray-200 space-y-1">
            <p className="text-[11px] text-gray-400 font-medium">
              Además apartar en {otherCurrency} (informativo):
            </p>
            {otherCurrencyTargets.map((t) => (
              <div
                key={t.id}
                className="flex justify-between text-[11px] text-gray-400"
              >
                <span className="truncate">{t.name}</span>
                <span className="tabular-nums shrink-0 ml-2">
                  {formatCurrency(t.monthlyContribution, t.currency)}/mes
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fondo de emergencia (solo ARS) */}
      {incomeCurrency === "ARS" && (
        <section className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
          <div>
            <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Fondo de emergencia
            </h2>
            <p className="text-[11px] text-amber-600 mt-0.5">
              Meta: 3× promedio mensual de gastos
              {emergencyFund.monthsOfData > 0
                ? ` · ${emergencyFund.monthsOfData} mes${emergencyFund.monthsOfData > 1 ? "es" : ""} de historial`
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
                  {progressPct}% completado{progressPct >= 100 && " · ¡Meta alcanzada!"}
                </p>
              </>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Aporte este mes{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
              {emergencyFund.suggestedContribution > 0 && (
                <span className="text-gray-400 font-normal ml-1">
                  · sugerido: {formatCurrency(emergencyFund.suggestedContribution, "ARS")}/mes
                </span>
              )}
            </label>
            <AmountInput
              value={emergencyContrib}
              onChange={handleEmergencyChange}
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

      {/* Distribución del remanente — 50/30/20 */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Distribución del remanente
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              50/30/20 sobre {formatCurrency(rem, incomeCurrency)} disponible · §2.5
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {layer4.some((l) => l.edited) && (
              <button
                type="button"
                onClick={resetSuggested}
                className="text-[11px] text-indigo-600 font-medium"
              >
                Restablecer
              </button>
            )}
            {/* Toggle $ / % */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                type="button"
                onClick={() => toggleLayer4Mode("amount")}
                className={`px-2.5 py-1 ${
                  layer4Mode === "amount"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                $
              </button>
              <button
                type="button"
                onClick={() => toggleLayer4Mode("pct")}
                className={`px-2.5 py-1 ${
                  layer4Mode === "pct"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                %
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {layer4.map((line) => {
            const derivedPct =
              rem > 0
                ? ((parseFloat(line.amount) || 0) / rem * 100).toFixed(1)
                : "0";
            const derivedAmount =
              Math.max(0, Math.round(rem * (parseFloat(line.userPct) || 0) / 100));

            return (
              <div
                key={line.key}
                className="space-y-2 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{line.label}</p>
                    <p className="text-[11px] text-gray-400">
                      {layer4Mode === "pct"
                        ? `= ${formatCurrency(derivedAmount, incomeCurrency)}`
                        : `${derivedPct}% del disponible`}
                    </p>
                  </div>
                  {line.edited && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      editado
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    {layer4Mode === "amount" ? (
                      <>
                        <p className="text-[10px] text-gray-400 mb-1">
                          Monto ({incomeCurrency})
                        </p>
                        {incomeCurrency === "ARS" ? (
                          <AmountInput
                            value={line.amount}
                            onChange={(raw) => handleAmount4(line.key, raw)}
                            className={INPUT}
                          />
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={line.amount}
                            onChange={(e) => handleAmount4(line.key, e.target.value)}
                            className={INPUT}
                          />
                        )}
                        {line.amount && incomeCurrency === "ARS" && parseFloat(line.amount) > 0 && (
                          <p className="text-[11px] text-gray-400 mt-0.5 text-right">
                            {formatInputAmount(line.amount, "ARS")}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] text-gray-400 mb-1">Porcentaje</p>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={line.userPct}
                            onChange={(e) => handlePct4(line.key, e.target.value)}
                            className={INPUT + " pr-7"}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                            %
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Cuenta destino</p>
                    <select
                      value={line.accountId}
                      onChange={(e) => handleAccount4(line.key, e.target.value)}
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
            );
          })}
        </div>

        <div className="border-t border-gray-200 pt-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Asignado en esta sección</span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(totalLayer4, incomeCurrency)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Disponible restante</span>
            <span
              className={`font-semibold tabular-nums ${
                rem - totalLayer4 < 0
                  ? "text-red-600"
                  : rem - totalLayer4 === 0
                  ? "text-green-600"
                  : "text-gray-700"
              }`}
            >
              {formatCurrency(rem - totalLayer4, incomeCurrency)}
            </span>
          </div>
        </div>
      </section>

      {/* Justificación teórica — colapsable */}
      <section className="border border-gray-200 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTheory((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 text-left bg-white"
        >
          <span className="text-sm font-medium text-gray-700">
            ¿Por qué esta distribución?
          </span>
          <span className="text-gray-400 text-xs ml-2">{showTheory ? "▲" : "▼"}</span>
        </button>
        {showTheory && (
          <div className="px-4 pb-4 pt-1 bg-gray-50 space-y-3 text-[12px] text-gray-600 leading-relaxed border-t border-gray-200">
            <div>
              <p className="font-semibold text-gray-700 mb-1.5">Orden de prioridad</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>
                  <span className="font-medium">Obligaciones</span> — mantenimiento de
                  bienes + cuotas del mes. Compromisos ya contraídos; se cubren primero.
                </li>
                <li>
                  <span className="font-medium">Metas de ahorro</span> — sinking funds
                  (§1.2) y objetivos. El motor calcula el aporte mensual sugerido para
                  llegar al objetivo en el plazo elegido. Podés ajustar o destildar.
                </li>
                <li>
                  <span className="font-medium">Fondo de emergencia</span> — colchón
                  de 3–6× el gasto mensual promedio (§0). En Argentina: denominado en
                  ARS para gastos corrientes; la cobertura real en USD es complementaria
                  (§3.1).
                </li>
                <li>
                  <span className="font-medium">Remanente 50/30/20</span> — marco de
                  referencia §2.5: 50% necesidades, 30% ocio, 20% ahorro/inversión. Los
                  porcentajes son sugeridos y completamente editables.
                </li>
              </ol>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Fuentes</p>
              <p>
                Sinking Fund (§1.2): NPTEL Ingeniería Económica · 50/30/20 (§2.5):
                consenso finanzas personales · Emergencia (§0): 3–6 meses · Argentina
                (§3.1): fondos en USD, tasa i=0 por defecto.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 space-y-1">
              <p>
                <span className="font-semibold">⚠ La app puede errar.</span> Los montos
                sugeridos son puntos de partida; vos tenés la última palabra en cada
                campo (principio IAS 16.51).
              </p>
              <p>
                La distribución parcial es válida: el saldo sin asignar queda en tus
                cuentas de origen sin modificar ningún balance.
              </p>
            </div>
          </div>
        )}
      </section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || skipping || sinAsignar < 0}
          className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          {saving
            ? "Confirmando…"
            : sinAsignar > 0
            ? `Confirmar (${formatCurrency(sinAsignar, incomeCurrency)} sin asignar)`
            : "Confirmar distribución"}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={saving || skipping}
          className="w-full border border-gray-200 rounded-xl py-3 text-sm text-gray-500 font-medium disabled:opacity-40 transition-opacity"
        >
          {skipping ? "Saltando…" : "Saltear por ahora →"}
        </button>
      </div>
    </div>
  );
}
