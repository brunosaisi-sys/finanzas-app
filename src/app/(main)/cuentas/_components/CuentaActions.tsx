"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateAccount, deleteAccount, forceDeleteAccount } from "../actions";
import type { DepItem } from "../actions";
import Link from "next/link";
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
  earnsYield: boolean;
  canChangeType: boolean;
  isChild: boolean;
}

type Mode = "idle" | "edit" | "delete";

export default function CuentaActions({
  accountId,
  accountName,
  accountType,
  currentBalance,
  currency,
  earnsYield,
  canChangeType,
  isChild,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [name, setName] = useState(accountName);
  const [balance, setBalance] = useState(String(currentBalance));
  const [type, setType] = useState<AccountType>(accountType);
  const [earnsYieldEdit, setEarnsYieldEdit] = useState(earnsYield);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDeps, setDeleteDeps] = useState<DepItem[]>([]);
  const [overflowCount, setOverflowCount] = useState(0);
  const [forceConfirm, setForceConfirm] = useState(false);
  const [forcing, setForcing] = useState(false);

  function resetEdit() {
    setName(accountName);
    setBalance(String(currentBalance));
    setType(accountType);
    setEarnsYieldEdit(earnsYield);
    setError(null);
    setMode("idle");
  }

  const typeEditable = !isChild && canChangeType;
  const isCredit = type === "credito";

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
          {!isCredit && (
            <label className="flex items-center gap-2 text-[10px] text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={earnsYieldEdit}
                onChange={(e) => setEarnsYieldEdit(e.target.checked)}
                className="rounded"
              />
              Genera rendimiento (puede recibir coberturas de gastos en cuotas)
            </label>
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
                earns_yield: isCredit ? false : earnsYieldEdit,
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
              setDeleteDeps([]);
              setOverflowCount(0);
              const result = await deleteAccount(accountId);
              if (result.error) {
                setError(result.error);
                setDeleteDeps(result.deps ?? []);
                setOverflowCount(result.overflowCount ?? 0);
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
              setDeleteDeps([]);
              setOverflowCount(0);
              setForceConfirm(false);
              setMode("idle");
            }}
            className="text-[11px] text-gray-400"
          >
            Cancelar
          </button>
        </div>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
        {deleteDeps.length > 0 && (
          <div className="mt-1 space-y-1">
            <ul className="space-y-1">
              {deleteDeps.map((dep) => (
                <li key={dep.id} className="text-[10px] text-gray-500">
                  {dep.path ? (
                    <Link href={dep.path} className="underline hover:text-gray-900">
                      {dep.label}
                    </Link>
                  ) : (
                    dep.label
                  )}
                </li>
              ))}
              {overflowCount > 0 && (
                <li className="text-[10px] text-gray-400">
                  y {overflowCount} más — andá a{" "}
                  <Link href="/gastos" className="underline hover:text-gray-900">
                    /gastos
                  </Link>
                </li>
              )}
            </ul>

            {/* Opción de borrado forzado — visible solo cuando hay deps */}
            <div className="mt-2 pt-2 border-t border-gray-100">
              {!forceConfirm ? (
                <button
                  type="button"
                  onClick={() => setForceConfirm(true)}
                  className="text-[10px] text-gray-400 hover:text-red-500 underline"
                >
                  Eliminar de todas formas (desvincular dependencias)
                </button>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-red-600 leading-relaxed">
                    ⚠ Los saldos de las cuentas NO se revertirán. Los gastos e ingresos asociados quedarán sin cuenta. Las transferencias vinculadas se eliminarán. Las reservas activas se liberarán.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={forcing}
                      onClick={async () => {
                        setForcing(true);
                        setError(null);
                        const result = await forceDeleteAccount(accountId);
                        if (result.error) {
                          setError(result.error);
                          setForcing(false);
                        } else {
                          setMode("idle");
                          setForcing(false);
                          router.refresh();
                        }
                      }}
                      className="text-[11px] font-medium text-red-600 disabled:opacity-40"
                    >
                      {forcing ? "Eliminando…" : "Confirmar eliminación forzada"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForceConfirm(false)}
                      className="text-[11px] text-gray-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
