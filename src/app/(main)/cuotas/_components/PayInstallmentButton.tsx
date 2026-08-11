"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountDisplayName } from "@/lib/accounts";
import { formatCurrency } from "@/lib/format";
import { convertViaMep } from "@/lib/finance/mep";
import { payInstallment, payInstallmentsWithConversion } from "../actions";
import type { Account, Currency } from "@/types";

interface Props {
  installmentId: string;
  amount: number;
  currency: Currency;
  coveringAccountId: string | null;
  leafAccounts: Account[];
  allAccounts: Account[];
}

export default function PayInstallmentButton({
  installmentId,
  amount,
  currency,
  coveringAccountId,
  leafAccounts,
  allAccounts,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(
    leafAccounts.find((a) => a.currency === currency)?.id ?? leafAccounts[0]?.id ?? ""
  );
  const [mepRate, setMepRate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = allAccounts.find((a) => a.id === selectedAccountId) ?? null;
  // TAREA 1 (Sesión J.1.15): la cuenta elegida puede ser de otra moneda — antes
  // esto descontaba el monto crudo de la cuenta equivocada sin convertir. Ahora,
  // si hay mismatch, se pide el tipo MEP y se usa pay_installments_with_conversion.
  const needsMep = !!selectedAccount && selectedAccount.currency !== currency;
  const mepRateNum = parseFloat(mepRate) || 0;
  const convertedAmount =
    needsMep && selectedAccount && mepRateNum > 0
      ? convertViaMep(amount, currency, selectedAccount.currency, mepRateNum)
      : null;

  async function handlePay(accountId: string | null) {
    setLoading(true);
    setError(null);

    let result: { error?: string };
    if (accountId && needsMep) {
      if (!(mepRateNum > 0)) {
        setLoading(false);
        setError("Ingresá el tipo de cambio MEP para convertir.");
        return;
      }
      result = await payInstallmentsWithConversion([installmentId], accountId, mepRateNum);
    } else {
      result = await payInstallment(installmentId, accountId);
    }

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowModal(false);
    router.refresh();
  }

  // Con cuenta de cobertura: un solo botón, no hay que elegir de dónde sale la plata
  if (coveringAccountId) {
    return (
      <button
        onClick={() => handlePay(null)}
        disabled={loading}
        className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 rounded-full px-3 py-1.5 transition-colors"
      >
        {loading ? "..." : "Pagada"}
      </button>
    );
  }

  // Sin cuenta de cobertura: modal para elegir cuenta
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={loading}
        className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40 rounded-full px-3 py-1.5 transition-colors"
      >
        {loading ? "..." : "Pagada"}
      </button>

      {showModal && (
        // z-[60], no z-50: ver comentario en BatchPayButton.tsx — BottomNav
        // empata en z-50 y tapa el botón de confirmar por orden de DOM.
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">¿Con qué cuenta pagás?</h2>

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
              <div className="space-y-2">
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
                {convertedAmount !== null && (
                  <p className="text-[11px] text-gray-400">
                    {formatCurrency(amount, currency)} → se descuenta{" "}
                    <span className="font-medium text-gray-600">
                      {formatCurrency(convertedAmount, selectedAccount!.currency)}
                    </span>
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => handlePay(selectedAccountId || null)}
                disabled={loading || !selectedAccountId || (needsMep && !(mepRateNum > 0))}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium disabled:opacity-40"
              >
                {loading ? "..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
