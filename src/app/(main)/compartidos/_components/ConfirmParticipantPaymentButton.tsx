"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountDisplayName } from "@/lib/accounts";
import { confirmParticipantPayment } from "../actions";
import type { Account } from "@/types";

interface Props {
  participantId: string;
  participantName: string;
  compatibleAccounts: Account[];
  allAccounts: Account[];
}

export default function ConfirmParticipantPaymentButton({
  participantId,
  participantName,
  compatibleAccounts,
  allAccounts,
}: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(compatibleAccounts[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await confirmParticipantPayment(participantId, selectedAccountId);
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
        className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-full px-3 py-1.5 transition-colors shrink-0"
      >
        Ya me pagaron
      </button>

      {showModal && (
        // z-[60], no z-50 — ver comentario en cuotas/_components/BatchPayButton.tsx
        // (BottomNav empata en z-50 y tapa el botón de confirmar).
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              ¿A qué cuenta entró la plata de {participantName}?
            </h2>

            {compatibleAccounts.length === 0 ? (
              <p className="text-sm text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                No tenés cuentas en esa moneda todavía.
              </p>
            ) : (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {compatibleAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {accountDisplayName(acc, allAccounts)}
                  </option>
                ))}
              </select>
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
                disabled={loading || !selectedAccountId}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium disabled:opacity-40"
              >
                {loading ? "Confirmando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
