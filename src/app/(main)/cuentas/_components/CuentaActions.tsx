"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAccountBalance, deleteAccount } from "../actions";
import type { Currency } from "@/types";

interface Props {
  accountId: string;
  accountName: string;
  currentBalance: number;
  currency: Currency;
  hasExpenses?: boolean;
}

export default function CuentaActions({
  accountId,
  accountName,
  currentBalance,
  currency,
  hasExpenses = false,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit" | "delete">("idle");
  const [balance, setBalance] = useState(String(currentBalance));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "edit") {
    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          type="number"
          step="0.01"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <span className="text-[10px] text-gray-400">{currency}</span>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            const v = parseFloat(balance);
            if (isNaN(v)) { setError("Monto inválido"); return; }
            setSaving(true);
            setError(null);
            const result = await updateAccountBalance(accountId, v);
            if (result.error) {
              setError(result.error);
              setSaving(false);
            } else {
              setSaving(false);
              setMode("idle");
              router.refresh();
            }
          }}
          className="text-[11px] font-medium text-gray-900 disabled:opacity-40"
        >
          {saving ? "…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => { setMode("idle"); setBalance(String(currentBalance)); setError(null); }}
          className="text-[11px] text-gray-400"
        >
          Cancelar
        </button>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  if (mode === "delete") {
    return (
      <div className="mt-1 space-y-1">
        {hasExpenses && (
          <p className="text-[10px] text-amber-600">
            Esta cuenta tiene gastos asociados. Se eliminarán las referencias.
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              const result = await deleteAccount(accountId);
              if (result.error) {
                setError(result.error);
                setSaving(false);
              } else {
                router.refresh();
              }
            }}
            className="text-[11px] font-medium text-red-600 disabled:opacity-40"
          >
            {saving ? "Eliminando…" : `Confirmar eliminar "${accountName}"`}
          </button>
          <button
            type="button"
            onClick={() => { setMode("idle"); setError(null); }}
            className="text-[11px] text-gray-400"
          >
            Cancelar
          </button>
        </div>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex gap-3 mt-1">
      <button
        type="button"
        onClick={() => setMode("edit")}
        className="text-[11px] text-indigo-600 font-medium"
      >
        Editar saldo
      </button>
      <button
        type="button"
        onClick={() => setMode("delete")}
        className="text-[11px] text-gray-400 hover:text-red-500"
      >
        Eliminar
      </button>
    </div>
  );
}
