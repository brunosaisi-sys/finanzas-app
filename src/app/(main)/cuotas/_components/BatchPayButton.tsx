"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountDisplayName } from "@/lib/accounts";
import { formatCurrency } from "@/lib/format";
import { convertViaMep } from "@/lib/finance/mep";
import { payInstallmentsBatch, payInstallmentsWithConversion } from "../actions";
import type { Account, Currency } from "@/types";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface BatchInstallment {
  id: string;
  amount: number;
  currency: Currency;
  coveringAccountId: string | null;
}

interface Props {
  installments: BatchInstallment[];
  cardName: string;
  yearMonth: string;
  leafAccounts: Account[];
  allAccounts: Account[];
}

export default function BatchPayButton({
  installments,
  cardName,
  yearMonth,
  leafAccounts,
  allAccounts,
}: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(leafAccounts[0]?.id ?? "");
  const [mode, setMode] = useState<"single" | "separate">("single");
  const [mepRate, setMepRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allCovered = installments.every((i) => i.coveringAccountId !== null);
  const uncovered = installments.filter((i) => i.coveringAccountId === null);

  // Totales por moneda para mostrar en confirmación
  const totals: Record<string, number> = {};
  for (const inst of installments) {
    totals[inst.currency] = (totals[inst.currency] ?? 0) + Number(inst.amount);
  }
  const currencies = Object.keys(totals);
  const multiCurrency = currencies.length > 1;

  // TAREA 1 (Sesión J.1.15): modo "cada moneda por separado" — un selector de
  // cuenta por moneda presente en el grupo, inicializado una sola vez al montar.
  const [accountByCurrency, setAccountByCurrency] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const cur of currencies) {
      initial[cur] = leafAccounts.find((a) => a.currency === cur)?.id ?? "";
    }
    return initial;
  });

  const [year, month] = yearMonth.split("-");
  const monthLabel = `${MESES[parseInt(month) - 1]} ${year}`;

  const selectedAccount = allAccounts.find((a) => a.id === selectedAccountId) ?? null;
  const uncoveredCurrencies = Array.from(new Set(uncovered.map((i) => i.currency)));
  const needsMep =
    mode === "single" &&
    !!selectedAccount &&
    uncoveredCurrencies.some((c) => c !== selectedAccount.currency);
  const mepRateNum = parseFloat(mepRate) || 0;

  const conversionPreview =
    needsMep && selectedAccount && mepRateNum > 0
      ? uncoveredCurrencies
          .filter((c) => c !== selectedAccount.currency)
          .map((c) => {
            const sum = uncovered
              .filter((i) => i.currency === c)
              .reduce((s, i) => s + Number(i.amount), 0);
            return {
              from: c as Currency,
              fromAmount: sum,
              toAmount: convertViaMep(sum, c, selectedAccount.currency, mepRateNum),
            };
          })
      : [];

  // Moneda(s) sin cobertura, agrupadas — para el selector por moneda del modo "separado"
  const uncoveredByCurrency: Record<string, BatchInstallment[]> = {};
  for (const i of uncovered) {
    (uncoveredByCurrency[i.currency] ??= []).push(i);
  }

  const canConfirm = (() => {
    if (loading) return false;
    if (allCovered) return true;
    if (!multiCurrency) return !!selectedAccountId;
    if (mode === "single") {
      if (!selectedAccountId) return false;
      if (needsMep && !(mepRateNum > 0)) return false;
      return true;
    }
    // separate
    return Object.keys(uncoveredByCurrency).every((cur) => !!accountByCurrency[cur]);
  })();

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    let result: { error?: string };
    if (allCovered) {
      result = await payInstallmentsBatch(installments.map((i) => i.id), null);
    } else if (!multiCurrency) {
      result = await payInstallmentsBatch(installments.map((i) => i.id), selectedAccountId || null);
    } else if (mode === "single") {
      result = await payInstallmentsWithConversion(
        installments.map((i) => i.id),
        selectedAccountId,
        needsMep ? mepRateNum : null
      );
    } else {
      result = {};
      for (const cur of currencies) {
        const idsForCur = installments.filter((i) => i.currency === cur).map((i) => i.id);
        const r = await payInstallmentsBatch(idsForCur, accountByCurrency[cur] || null);
        if (r.error) {
          result = r;
          break;
        }
      }
    }

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowModal(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs font-medium text-gray-600 border border-gray-200 rounded-full px-3 py-1.5 hover:bg-gray-50 transition-colors shrink-0"
      >
        Pagar todas ({installments.length})
      </button>

      {showModal && (
        // z-[60], no z-50: BottomNav (fixed bottom) también usa z-50 y se renderiza
        // después en el DOM (layout.tsx) — con z-index empatado, gana el último en
        // el DOM y tapa el botón "Confirmar pago" de este sheet bottom-anchored
        // (root cause del bug reportado en TAREA 6, Sesión J.1.14). Mismo fix ya
        // aplicado en ConfirmFundingButton.tsx.
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Pagar {installments.length} cuotas de {cardName}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">{monthLabel}</p>
            </div>

            {/* Totales */}
            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                Total a pagar
              </p>
              {Object.entries(totals).map(([cur, total]) => (
                <div key={cur} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{cur}</span>
                  <span className="text-base font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(total, cur as Currency)}
                  </span>
                </div>
              ))}
            </div>

            {/* TAREA 1: elegir cómo pagar cuando hay más de una moneda y falta cobertura */}
            {!allCovered && multiCurrency && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("single")}
                  className={`flex-1 text-xs font-medium rounded-lg px-2 py-2 border transition-colors ${
                    mode === "single"
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  Pagar todo con una cuenta
                </button>
                <button
                  type="button"
                  onClick={() => setMode("separate")}
                  className={`flex-1 text-xs font-medium rounded-lg px-2 py-2 border transition-colors ${
                    mode === "separate"
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  Cada moneda por separado
                </button>
              </div>
            )}

            {/* Selector de cuenta solo cuando alguna cuota no tiene cobertura */}
            {!allCovered && (!multiCurrency || mode === "single") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ¿Con qué cuenta pagás?
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {leafAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {accountDisplayName(acc, allAccounts)} ({acc.currency})
                    </option>
                  ))}
                </select>

                {needsMep && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-[11px] text-amber-700 font-medium shrink-0">
                        Tipo MEP:
                      </span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="ej. 1200"
                        value={mepRate}
                        onChange={(e) => setMepRate(e.target.value)}
                        className="w-24 border border-amber-200 rounded px-2 py-0.5 text-xs text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 text-right"
                      />
                    </div>
                    {conversionPreview.map((c) => (
                      <p key={c.from} className="text-[11px] text-gray-400">
                        {formatCurrency(c.fromAmount, c.from)} → se descuenta{" "}
                        <span className="font-medium text-gray-600">
                          {formatCurrency(c.toAmount, selectedAccount!.currency)}
                        </span>{" "}
                        de {accountDisplayName(selectedAccount!, allAccounts)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modo "cada moneda por separado": un selector por moneda sin cobertura */}
            {!allCovered && multiCurrency && mode === "separate" && (
              <div className="space-y-3">
                {Object.entries(uncoveredByCurrency).map(([cur, items]) => (
                  <div key={cur}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cuenta para {cur} (
                      {formatCurrency(
                        items.reduce((s, i) => s + Number(i.amount), 0),
                        cur as Currency
                      )}
                      )
                    </label>
                    <select
                      value={accountByCurrency[cur] ?? ""}
                      onChange={(e) =>
                        setAccountByCurrency((prev) => ({ ...prev, [cur]: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      {leafAccounts
                        .filter((a) => a.currency === cur)
                        .map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {accountDisplayName(acc, allAccounts)}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium disabled:opacity-40"
              >
                {loading ? "Pagando..." : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
