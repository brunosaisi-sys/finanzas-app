"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountDisplayName } from "@/lib/accounts";
import { payInstallment } from "../actions";
import type { Account } from "@/types";

interface Props {
  installmentId: string;
  coveringAccountId: string | null;
  leafAccounts: Account[];
  allAccounts: Account[];
}

export default function PayInstallmentButton({
  installmentId,
  coveringAccountId,
  leafAccounts,
  allAccounts,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(leafAccounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handlePay(accountId: string | null) {
    setLoading(true);
    setError(null);
    const result = await payInstallment(installmentId, accountId);
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
                  {accountDisplayName(acc, allAccounts)}
                </option>
              ))}
            </select>

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
                disabled={loading || !selectedAccountId}
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
