"use client";

import { useState } from "react";
import { createAndLinkFciHolding } from "../actions";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/types";

export interface FciFundOption {
  fundFamily: string;
  representativeName: string;
  risk: string;
  vcp: number;
  fecha: string;
  currency: Currency;
  return30d?: number | null;
}

interface Props {
  accountId: string;
  funds: FciFundOption[];
  onLinked: () => void;
}

export default function FciFundSelector({ accountId, funds, onLinked }: Props) {
  const [selected, setSelected] = useState<FciFundOption | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!selected) {
    return (
      <div className="pt-1 space-y-1">
        <p className="text-[10px] text-gray-500 font-medium">
          Elegí tu fondo en esta institución
        </p>
        <div className="space-y-1">
          {funds.map((f) => (
            <button
              key={f.representativeName}
              type="button"
              onClick={() => setSelected(f)}
              className="w-full flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-2.5 min-h-[44px] text-left hover:border-gray-400 active:border-gray-500 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-gray-900 truncate">
                  {f.fundFamily}
                </span>
                <span className="block text-[10px] text-gray-400">
                  {f.currency} · Riesgo {f.risk}
                </span>
              </span>
              {f.return30d != null && (
                <span
                  className={`text-[10px] font-medium tabular-nums shrink-0 ${
                    f.return30d >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {f.return30d >= 0 ? "+" : ""}
                  {(f.return30d * 100).toFixed(1)}% · 30d
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-1 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-500 font-medium">
          {selected.fundFamily}
        </p>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setAmount("");
            setError(null);
          }}
          className="text-[10px] text-gray-400 hover:text-gray-700"
        >
          Cambiar fondo
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Monto invertido"
          className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <span className="text-[10px] text-gray-400">{selected.currency}</span>
      </div>
      {amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && (
        <p className="text-[10px] text-gray-400">
          ≈ {(parseFloat(amount) / selected.vcp).toFixed(4)} cuotapartes a{" "}
          {formatCurrency(selected.vcp, selected.currency)} c/u ({selected.fecha})
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            const parsed = parseFloat(amount.replace(",", "."));
            if (isNaN(parsed) || parsed <= 0) {
              setError(
                "Ingresá el monto en pesos/dólares que tenés invertido en este fondo — tiene que ser mayor a 0."
              );
              return;
            }
            setSaving(true);
            setError(null);
            const result = await createAndLinkFciHolding(
              accountId,
              selected.representativeName,
              parsed,
              selected.vcp,
              selected.currency,
              selected.fecha
            );
            setSaving(false);
            if (result.error) {
              setError(result.error);
              return;
            }
            onLinked();
          }}
          className="text-[11px] font-medium text-gray-900 disabled:opacity-40"
        >
          {saving ? "Vinculando…" : "Vincular"}
        </button>
      </div>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
