"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateAccount,
  deleteAccount,
  forceDeleteAccount,
  linkHoldingToAccount,
  unlinkHoldingFromAccount,
} from "../actions";
import type { DepItem } from "../actions";
import Link from "next/link";
import type { AccountType, Currency } from "@/types";
import FciFundSelector, { type FciFundOption } from "./FciFundSelector";

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "banco", label: "Banco / Billetera" },
  { value: "efectivo", label: "Efectivo" },
  { value: "inversion", label: "Inversión" },
  { value: "usd_reserva", label: "Reserva USD" },
  { value: "credito", label: "Tarjeta de crédito" },
];

export interface FciHoldingOption {
  id: string;
  name: string;
}

interface Props {
  accountId: string;
  accountName: string;
  accountType: AccountType;
  currentBalance: number;
  currency: Currency;
  earnsYield: boolean;
  canChangeType: boolean;
  isChild: boolean;
  holdingId: string | null;
  linkedHoldingName: string | null;
  linkedHoldingReturn30d: number | null;
  fciHoldings: FciHoldingOption[];
  fciCatalog: FciFundOption[];
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
  holdingId,
  linkedHoldingName,
  linkedHoldingReturn30d,
  fciHoldings,
  fciCatalog,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [name, setName] = useState(accountName);
  const [balance, setBalance] = useState(String(currentBalance));
  const [type, setType] = useState<AccountType>(accountType);
  const [earnsYieldEdit, setEarnsYieldEdit] = useState(earnsYield);
  const [holdingIdEdit, setHoldingIdEdit] = useState<string | null>(holdingId);
  const [showManualLink, setShowManualLink] = useState(false);
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
    setHoldingIdEdit(holdingId);
    setError(null);
    setMode("idle");
  }

  const typeEditable = !isChild && canChangeType;
  const isCredit = type === "credito";

  if (mode === "edit") {
    const holdingChanged = holdingIdEdit !== holdingId;
    const currentHoldingName =
      holdingIdEdit === holdingId
        ? linkedHoldingName
        : (fciHoldings.find((h) => h.id === holdingIdEdit)?.name ?? null);

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
            {holdingIdEdit && (
              <span className="text-[10px] text-indigo-500">
                (se sobreescribe al sincronizar VCP)
              </span>
            )}
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
                onChange={(e) => {
                  setEarnsYieldEdit(e.target.checked);
                  if (!e.target.checked) setHoldingIdEdit(null);
                }}
                className="rounded"
              />
              Genera rendimiento (puede recibir coberturas de gastos en cuotas)
            </label>
          )}
          {!isCredit && earnsYieldEdit && !holdingIdEdit && fciCatalog.length === 0 && (
            <p className="text-[10px] text-gray-400 leading-snug">
              Esto solo marca la cuenta. Para que el saldo se actualice solo
              con el mercado, cargá tu inversión real en{" "}
              <Link href="/inversiones" className="underline">
                /inversiones
              </Link>{" "}
              y después vinculala acá.
            </p>
          )}
          {!isCredit && earnsYieldEdit && !holdingIdEdit && fciCatalog.length > 0 && (
            <p className="text-[10px] text-gray-400 leading-snug">
              Esto solo marca la cuenta. Elegí tu fondo abajo y listo — se crea
              y se vincula en un solo paso.
            </p>
          )}

          {/* Sección de vinculación a holding FCI */}
          {!isCredit && earnsYieldEdit && holdingIdEdit && (
            <div className="pt-1 space-y-1">
              <p className="text-[10px] text-gray-500 font-medium">
                Posición FCI vinculada
              </p>
              <div className="flex items-center gap-2 bg-indigo-50 rounded-lg px-2 py-1.5">
                <span className="text-[10px] text-indigo-700 flex-1">
                  📈 {currentHoldingName ?? holdingIdEdit}
                </span>
                {/* Rendimiento 30d — solo para el holding YA vinculado (no al
                    previsualizar otro holding en el selector manual), y solo si
                    hay histórico suficiente (holding_price_history, migración 022).
                    Sesión J.1.11, TAREA 2. */}
                {holdingIdEdit === holdingId && linkedHoldingReturn30d != null && (
                  <span
                    className={`text-[10px] font-medium tabular-nums shrink-0 ${
                      linkedHoldingReturn30d >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {linkedHoldingReturn30d >= 0 ? "+" : ""}
                    {(linkedHoldingReturn30d * 100).toFixed(1)}% · 30d
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setHoldingIdEdit(null)}
                  className="text-[10px] text-gray-400 hover:text-red-500 shrink-0"
                >
                  Desvincular
                </button>
              </div>
              <p className="text-[10px] text-gray-400 leading-snug">
                El saldo se actualizará automáticamente cuando se sincronice el VCP del fondo.
              </p>
            </div>
          )}

          {/* Selector de fondos por institución (Sesión J.1.7) — reemplaza elegir
              un holding ya creado a mano, para las instituciones con catálogo
              verificado (ver docs/lecciones-aprendidas.md §21). */}
          {!isCredit && earnsYieldEdit && !holdingIdEdit && fciCatalog.length > 0 && (
            <FciFundSelector
              accountId={accountId}
              funds={fciCatalog}
              onLinked={() => {
                setMode("idle");
                router.refresh();
              }}
            />
          )}

          {!isCredit &&
            earnsYieldEdit &&
            !holdingIdEdit &&
            fciCatalog.length > 0 &&
            fciHoldings.length > 0 &&
            (showManualLink ? (
              <div className="pt-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-gray-500 font-medium">
                    Vincular un holding ya cargado a mano
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowManualLink(false)}
                    className="text-[10px] text-gray-400 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setHoldingIdEdit(e.target.value);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                >
                  <option value="">— Vincular a un fondo FCI —</option>
                  {fciHoldings.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowManualLink(true)}
                className="text-[10px] text-gray-400 hover:text-gray-700 underline"
              >
                ¿Ya tenés un holding cargado a mano? Vincularlo directo
              </button>
            ))}

          {/* Sin catálogo verificado para esta institución: fallback al flujo manual */}
          {!isCredit && earnsYieldEdit && !holdingIdEdit && fciCatalog.length === 0 && (
            <div className="pt-1 space-y-1">
              {fciHoldings.length > 0 ? (
                <>
                  <p className="text-[10px] text-gray-500 font-medium">
                    Posición FCI vinculada
                  </p>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) setHoldingIdEdit(e.target.value);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                  >
                    <option value="">— Vincular a un fondo FCI —</option>
                    {fciHoldings.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="text-[10px] text-gray-400">
                  No tenés posiciones FCI. Agregá una en{" "}
                  <Link href="/inversiones/nueva" className="underline">
                    /inversiones
                  </Link>{" "}
                  para vincularla.
                </p>
              )}
            </div>
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

              // 1. Actualizar nombre/saldo/tipo/earns_yield
              const result = await updateAccount(accountId, {
                name,
                balance: v,
                type,
                earns_yield: isCredit ? false : earnsYieldEdit,
              });
              if (result.error) {
                setError(result.error);
                setSaving(false);
                return;
              }

              // 2. Manejar cambio de holding vinculado (si aplica)
              if (!isCredit && earnsYieldEdit && holdingChanged) {
                let linkResult: { error?: string };
                if (holdingIdEdit) {
                  linkResult = await linkHoldingToAccount(accountId, holdingIdEdit);
                } else {
                  linkResult = await unlinkHoldingFromAccount(accountId);
                }
                if (linkResult.error) {
                  setError(linkResult.error);
                  setSaving(false);
                  return;
                }
              }

              setSaving(false);
              setMode("idle");
              router.refresh();
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
    <div className="flex gap-3 mt-1 flex-wrap items-center">
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
      {holdingId && (
        <span className="text-[10px] text-indigo-500">📈 FCI</span>
      )}
    </div>
  );
}
