"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getLeafAccounts, accountDisplayName } from "@/lib/accounts";
import { findCedearQuote, type CedearQuote } from "@/lib/cedearCatalog";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/types";

const ASSET_TYPES = [
  { value: "accion", label: "Acción argentina" },
  { value: "cedear", label: "CEDEAR" },
  { value: "bono", label: "Bono" },
  { value: "fci", label: "FCI" },
  { value: "crypto", label: "Crypto" },
  { value: "otro", label: "Otro" },
];

type PriceMode = "exact" | "pct";

interface Props {
  accounts: { id: string; name: string; parent_id: string | null }[];
  cedearQuotes: CedearQuote[];
}

export default function HoldingForm({ accounts, cedearQuotes }: Props) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [assetType, setAssetType] = useState("accion");
  const [quantity, setQuantity] = useState("");
  const [priceMode, setPriceMode] = useState<PriceMode>("exact");
  const [avgBuyPrice, setAvgBuyPrice] = useState("");
  const [pctGain, setPctGain] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [currentPrice, setCurrentPrice] = useState("");
  const leafAccounts = getLeafAccounts(accounts);
  const [accountId, setAccountId] = useState(leafAccounts[0]?.id ?? "");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CEDEAR detectado en el feed de data912 (matching exacto por símbolo — sin ambigüedad,
  // a diferencia del catálogo de fondos FCI). Autocompleta el precio actual; el usuario
  // siempre puede sobreescribirlo (IAS 16.51 — regla de colaboración #5).
  const cedearQuote =
    assetType === "cedear" ? findCedearQuote(cedearQuotes, ticker) : null;

  useEffect(() => {
    if (cedearQuote) {
      setCurrentPrice(String(cedearQuote.price));
      setCurrency(cedearQuote.currency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cedearQuote]);

  // Precio de compra implícito en modo %: precio_compra = precio_actual / (1 + pct/100)
  // Fórmula documentada en docs/01-fundamentos-teoricos.md §8.6 (derivada de §8.2).
  const parsedCurrentPriceForPreview = parseFloat(currentPrice.replace(",", "."));
  const parsedPctForPreview = parseFloat(pctGain.replace(",", "."));
  const derivedAvgPrice =
    priceMode === "pct" &&
    !isNaN(parsedCurrentPriceForPreview) &&
    parsedCurrentPriceForPreview > 0 &&
    !isNaN(parsedPctForPreview) &&
    parsedPctForPreview > -100
      ? parsedCurrentPriceForPreview / (1 + parsedPctForPreview / 100)
      : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsedQty = parseFloat(quantity.replace(",", "."));
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError(
        "La cantidad debe ser mayor a 0. Si todavía no invertiste, no hace falta cargar la posición todavía — volvé cuando tengas la cantidad real de unidades o cuotapartes."
      );
      return;
    }

    let parsedPrice: number;
    let parsedCurrentPrice: number | null;

    if (priceMode === "pct") {
      const parsedCp = parseFloat(currentPrice.replace(",", "."));
      const parsedPct = parseFloat(pctGain.replace(",", "."));
      if (isNaN(parsedCp) || parsedCp <= 0) {
        setError(
          "Para usar el modo % de ganancia necesitás el precio actual — sin eso no hay forma de derivar el precio de compra."
        );
        return;
      }
      if (isNaN(parsedPct) || parsedPct <= -100) {
        setError(
          "El % de ganancia/pérdida tiene que ser mayor a −100% (una pérdida total no permite derivar un precio de compra)."
        );
        return;
      }
      parsedPrice = parsedCp / (1 + parsedPct / 100);
      parsedCurrentPrice = parsedCp;
    } else {
      const parsedAvg = parseFloat(avgBuyPrice.replace(",", "."));
      if (isNaN(parsedAvg) || parsedAvg <= 0) {
        setError("El precio de compra debe ser mayor a 0.");
        return;
      }
      parsedPrice = parsedAvg;
      parsedCurrentPrice = currentPrice
        ? parseFloat(currentPrice.replace(",", ".")) || null
        : null;
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

  const canSubmit =
    !loading &&
    !!name.trim() &&
    !!quantity &&
    (priceMode === "exact" ? !!avgBuyPrice : !!currentPrice && !!pctGain);

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

      {/* Tipo — va antes que Ticker porque determina si Ticker ofrece el datalist de CEDEARs */}
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

      {/* Ticker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ticker{" "}
          <span className="text-gray-400 font-normal">
            {assetType === "cedear" ? "(elegí de la lista)" : "(opcional)"}
          </span>
        </label>
        <input
          type="text"
          list={assetType === "cedear" ? "cedear-symbols" : undefined}
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Ej: GGAL, PAMP, AAPL, AL30"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 uppercase"
        />
        {assetType === "cedear" && (
          <datalist id="cedear-symbols">
            {cedearQuotes.map((q) => (
              <option key={q.symbol} value={q.symbol} />
            ))}
          </datalist>
        )}
        {assetType === "cedear" && cedearQuote && (
          <p className="text-[11px] text-gray-500 mt-1">
            Precio actual detectado:{" "}
            <span className="font-medium text-gray-700">
              {formatCurrency(cedearQuote.price, cedearQuote.currency)}
            </span>{" "}
            <span
              className={
                cedearQuote.pctChange >= 0 ? "text-green-600" : "text-red-600"
              }
            >
              ({cedearQuote.pctChange >= 0 ? "+" : ""}
              {cedearQuote.pctChange.toFixed(2)}%)
            </span>{" "}
            — autocompletado en &quot;Precio actual&quot; (dato educativo, no en
            tiempo real).
          </p>
        )}
        {assetType === "cedear" &&
          ticker.trim() &&
          !cedearQuote &&
          cedearQuotes.length > 0 && (
            <p className="text-[11px] text-gray-400 mt-1">
              No encontramos &quot;{ticker}&quot; en el feed — podés seguir
              cargando el precio a mano.
            </p>
          )}
      </div>

      {/* Cantidad — sin moneda al lado: es un número de unidades, no un monto */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cantidad
        </label>
        <input
          type="number"
          inputMode="decimal"
          required
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Unidades o cuotapartes"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Modo de precio de compra */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Precio de compra
        </label>
        <div className="flex gap-1 mb-3">
          <button
            type="button"
            onClick={() => setPriceMode("exact")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
              priceMode === "exact"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
            }`}
          >
            Precio exacto
          </button>
          <button
            type="button"
            onClick={() => setPriceMode("pct")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
              priceMode === "pct"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
            }`}
          >
            Sé cuánto gané (%)
          </button>
        </div>

        {priceMode === "exact" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Precio promedio de compra
              </label>
              <input
                type="number"
                inputMode="decimal"
                required
                step="any"
                value={avgBuyPrice}
                onChange={(e) => setAvgBuyPrice(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-right text-lg font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Moneda</label>
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
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Precio actual
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  step="any"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-right text-lg font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Moneda</label>
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                % de ganancia/pérdida
              </label>
              <input
                type="number"
                inputMode="decimal"
                required
                step="any"
                value={pctGain}
                onChange={(e) => setPctGain(e.target.value)}
                placeholder="Ej: 15 (ganaste 15%) o -8 (perdiste 8%)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
              />
            </div>
            <p className="text-xs text-gray-400">
              Es una aproximación, no el dato exacto — derivamos el precio de compra a
              partir del precio actual y este %.
              {derivedAvgPrice != null && (
                <>
                  {" "}
                  Precio de compra estimado:{" "}
                  <span className="font-medium text-gray-600">
                    {derivedAvgPrice.toFixed(2)} {currency}
                  </span>
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Precio actual (solo en modo exacto — en modo % ya se pidió arriba) */}
      {priceMode === "exact" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio actual{" "}
            <span className="text-gray-400 font-normal">
              (opcional, en {currency})
            </span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(e.target.value)}
            placeholder="Para ver ganancia/pérdida ya"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
          />
        </div>
      )}

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
        disabled={!canSubmit}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {loading ? "Guardando..." : "Guardar posición"}
      </button>
    </form>
  );
}
