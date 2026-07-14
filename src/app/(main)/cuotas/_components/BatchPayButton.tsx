"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountDisplayName } from "@/lib/accounts";
import { formatCurrency } from "@/lib/format";
import { payInstallmentsBatch } from "../actions";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allCovered = installments.every((i) => i.coveringAccountId !== null);

  // Totales por moneda para mostrar en confirmación
  const totals: Record<string, number> = {};
  for (const inst of installments) {
    totals[inst.currency] = (totals[inst.currency] ?? 0) + Number(inst.amount);
  }

  const [year, month] = yearMonth.split("-");
  const monthLabel = `${MESES[parseInt(month) - 1]} ${year}`;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const accountId = allCovered ? null : (selectedAccountId || null);
    const result = await payInstallmentsBatch(
      installments.map((i) => i.id),
      accountId
    );
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 space-y-4">
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

            {/* Selector de cuenta solo cuando alguna cuota no tiene cobertura */}
            {!allCovered && (
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
                      {accountDisplayName(acc, allAccounts)}
                    </option>
                  ))}
                </select>
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
                disabled={loading || (!allCovered && !selectedAccountId)}
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
