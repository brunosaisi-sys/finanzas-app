"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateHoldingPosition } from "../actions";
import type { Currency } from "@/types";

interface Props {
  holdingId: string;
  quantity: number;
  avgBuyPrice: number;
  currency: Currency;
}

// Sesión J.1.13, TAREA 4 — permite corregir cantidad y precio promedio de
// compra de un holding ya cargado (ej. split de CEDEAR: BYMA cambió el ratio
// de SPY de 20:1 a 60:1, el usuario recibió más unidades y necesita ajustar
// la posición sin borrarla y recrearla).
export default function HoldingPositionEdit({
  holdingId,
  quantity,
  avgBuyPrice,
  currency,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit">("idle");
  const [qty, setQty] = useState(quantity.toString());
  const [price, setPrice] = useState(avgBuyPrice.toString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("idle");
    setError(null);
    setQty(quantity.toString());
    setPrice(avgBuyPrice.toString());
  }

  if (mode === "edit") {
    return (
      <div className="mt-1.5 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400">Cant.</span>
            <input
              type="number"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400">PA</span>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
            <span className="text-[10px] text-gray-400">{currency}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              const parsedQty = parseFloat(qty);
              const parsedPrice = parseFloat(price);
              if (isNaN(parsedQty) || parsedQty <= 0) {
                setError("Cantidad inválida — tiene que ser mayor a 0");
                return;
              }
              if (isNaN(parsedPrice) || parsedPrice < 0) {
                setError("Precio promedio inválido");
                return;
              }
              setSaving(true);
              setError(null);
              const result = await updateHoldingPosition(holdingId, parsedQty, parsedPrice);
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
          <button type="button" onClick={reset} className="text-[11px] text-gray-400">
            Cancelar
          </button>
        </div>
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
      Editar cantidad / precio de compra
    </button>
  );
}
