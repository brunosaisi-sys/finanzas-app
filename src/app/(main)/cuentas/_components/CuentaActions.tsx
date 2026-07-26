"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAccount, deleteAccount } from "../actions";
import type { AccountType, Currency } from "@/types";

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "banco", label: "Banco / Billetera" },
  { value: "efectivo", label: "Efectivo" },
  { value: "inversion", label: "Inversión" },
  { value: "usd_reserva", label: "Reserva USD" },
  { value: "credito", label: "Tarjeta de crédito" },
];

interface Props {
  accountId: string;
  accountName: string;
  accountType: AccountType;
  currentBalance: number;
  currency: Currency;
  // true si la cuenta tiene dependencias (gastos/earmarks) — bloquea cambio de tipo
  canChangeType: boolean;
  // true si la cuenta es hija (tiene parent_id) — tipo siempre heredado, nunca editable
  isChild: boolean;
}

type Mode = "idle" | "edit" | "delete";

export default function CuentaActions({
  accountId,
  accountName,
  accountType,
  currentBalance,
  currency,
  canChangeType,
  isChild,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [name, setName] = useState(accountName);
  const [balance, setBalance] = useState(String(currentBalance));
  const [type, setType] = useState<AccountType>(accountType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetEdit() {
    setName(accountName);
    setBalance(String(currentBalance));
    setType(accountType);
    setError(null);
    setMode("idle");
  }

  const typeEditable = !isChild && canChangeType;

  if (mode === "edit") {
    return (
      <div className="mt-2 space-y-2">
        <div className="space-y-1.5">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la cuenta"
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
            <span className="text-[10px] text-gray-400">{currency}</span>
          </div>
          {typeEditable ? (
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[10px] text-gray-400 bg-gray-50 rounded px-2 py-1">
              {isChild
                ? "Tipo no editable — los bolsillos heredan el tipo del padre."
                : "Tipo no editable — la cuenta tiene gastos o reservas asociadas."}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={async () => {
              const v = parseFloat(balance);
              if (isNaN(v)) {
                setError("Monto inválido");
                return;
              }
              setSaving(true);
              setError(null);
              const result = await updateAccount(accountId, {
                name,
                balance: v,
                type,
              });
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
            onClick={resetEdit}
            className="text-[11px] text-gray-400"
          >
            Cancelar
          </button>
        </div>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  if (mode === "delete") {
    return (
      <div className="mt-1 space-y-1">
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
                setMode("idle");
                setSaving(false);
                router.refresh();
              }
            }}
            className="text-[11px] font-medium text-red-600 disabled:opacity-40"
          >
            {saving ? "Eliminando…" : `Confirmar eliminar "${accountName}"`}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("idle");
            }}
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
    <div className="flex gap-3 mt-1 flex-wrap">
      <button
        type="button"
        onClick={() => setMode("edit")}
        className="text-[11px] text-indigo-600 font-medium"
      >
        Editar
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
