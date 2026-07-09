"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateHoldingPrice } from "../actions";
import type { Currency } from "@/types";

interface Props {
  holdingId: string;
  currentPrice: number | null;
  currency: Currency;
}

export default function HoldingPriceEdit({ holdingId, currentPrice, currency }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit">("idle");
  const [price, setPrice] = useState(currentPrice?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "edit") {
    return (
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
          placeholder="0"
          autoFocus
        />
        <span className="text-[10px] text-gray-400">{currency}</span>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            const v = parseFloat(price);
            if (isNaN(v) || v < 0) {
              setError("Precio inválido");
              return;
            }
            setSaving(true);
            setError(null);
            const result = await updateHoldingPrice(holdingId, v);
            if (result.error) {
              setError(result.error);
              setSaving(false);
            } else {
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
          onClick={() => {
            setMode("idle");
            setError(null);
            setPrice(currentPrice?.toString() ?? "");
          }}
          className="text-[11px] text-gray-400"
        >
          Cancelar
        </button>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setMode("edit")}
      className="text-[11px] text-indigo-600 font-medium mt-1 block"
    >
      {currentPrice != null ? "Actualizar precio" : "Ingresar precio"}
    </button>
  );
}
