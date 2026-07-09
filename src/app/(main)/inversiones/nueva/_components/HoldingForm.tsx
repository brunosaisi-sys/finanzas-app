"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getLeafAccounts, accountDisplayName } from "@/lib/accounts";
import type { Currency } from "@/types";

const ASSET_TYPES = [
  { value: "accion", label: "Acción argentina" },
  { value: "cedear", label: "CEDEAR" },
  { value: "bono", label: "Bono" },
  { value: "fci", label: "FCI" },
  { value: "crypto", label: "Crypto" },
  { value: "otro", label: "Otro" },
];

interface Props {
  accounts: { id: string; name: string; parent_id: string | null }[];
}

export default function HoldingForm({ accounts }: Props) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [assetType, setAssetType] = useState("accion");
  const [quantity, setQuantity] = useState("");
  const [avgBuyPrice, setAvgBuyPrice] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [currentPrice, setCurrentPrice] = useState("");
  const leafAccounts = getLeafAccounts(accounts);
  const [accountId, setAccountId] = useState(leafAccounts[0]?.id ?? "");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsedQty = parseFloat(quantity.replace(",", "."));
    const parsedPrice = parseFloat(avgBuyPrice.replace(",", "."));
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError("Cantidad inválida");
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setError("Precio de compra inválido");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesión expirada. Recargá la página.");
      setLoading(false);
      return;
    }

    const parsedCurrentPrice = currentPrice
      ? parseFloat(currentPrice.replace(",", ".")) || null
      : null;

    const { error } = await supabase.from("holdings").insert({
      user_id: user.id,
      account_id: accountId || null,
      name: name.trim(),
      ticker: ticker.trim().toUpperCase() || null,
      asset_type: assetType,
      quantity: parsedQty,
      avg_buy_price: parsedPrice,
      currency,
      current_price: parsedCurrentPrice,
      purchase_date: purchaseDate,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/inversiones");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre del activo
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Grupo Galicia, CEDEAR Apple, Letes USD"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Ticker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ticker{" "}
          <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Ej: GGAL, PAMP, AAPL, AL30"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 uppercase"
        />
      </div>

      {/* Tipo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
        <select
          value={assetType}
          onChange={(e) => setAssetType(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        >
          {ASSET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Cantidad + Moneda */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cantidad
          </label>
          <input
            type="number"
            inputMode="decimal"
            required
            min="0.000001"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Moneda
          </label>
          <div className="flex gap-1">
            {(["ARS", "USD"] as Currency[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  currency === c
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Precio promedio de compra */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Precio promedio de compra
        </label>
        <input
          type="number"
          inputMode="decimal"
          required
          min="0.01"
          step="any"
          value={avgBuyPrice}
          onChange={(e) => setAvgBuyPrice(e.target.value)}
          placeholder="0"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-right text-lg font-semibold"
        />
      </div>

      {/* Precio actual */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Precio actual{" "}
          <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          step="any"
          value={currentPrice}
          onChange={(e) => setCurrentPrice(e.target.value)}
          placeholder="Para ver ganancia/pérdida ya"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
        />
      </div>

      {/* Cuenta / Broker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cuenta / Broker
        </label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        >
          <option value="">Sin cuenta</option>
          {leafAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {accountDisplayName(acc, accounts)}
            </option>
          ))}
        </select>
      </div>

      {/* Fecha de compra */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fecha de compra
        </label>
        <input
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !name.trim() || !quantity || !avgBuyPrice}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {loading ? "Guardando..." : "Guardar posición"}
      </button>
    </form>
  );
}
