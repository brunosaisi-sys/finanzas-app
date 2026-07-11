"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ASSET_DEFAULTS,
  AssetCategory,
  CAR_DEPRECIATION_SEGMENTS,
  CarSegment,
  calcAssetFunds,
} from "@/lib/finance/sinkingFund";
import { formatCurrency } from "@/lib/format";
import { updateAsset } from "../../../actions";
import type { Asset } from "@/types";

const CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
  { value: "heladera", label: "Heladera / Freezer" },
  { value: "lavarropas", label: "Lavarropas" },
  { value: "lavavajillas", label: "Lavavajillas" },
  { value: "secarropas", label: "Secarropas" },
  { value: "microondas", label: "Microondas" },
  { value: "horno", label: "Horno / Cocina" },
  { value: "tv", label: "TV" },
  { value: "notebook", label: "Notebook / PC" },
  { value: "smartphone", label: "Smartphone" },
  { value: "auto", label: "Auto" },
  { value: "vivienda", label: "Vivienda" },
  { value: "muebles", label: "Muebles" },
];

const CAR_SEGMENT_OPTIONS = Object.entries(CAR_DEPRECIATION_SEGMENTS).map(
  ([value, { label }]) => ({ value: value as CarSegment, label })
);

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {hint && <p className="text-[11px] text-gray-400 leading-tight">{hint}</p>}
      {children}
    </div>
  );
}

const INPUT =
  "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";

function pctToStr(v: number | null): string {
  return v != null ? String(v * 100) : "";
}

export default function EditAssetForm({ asset }: { asset: Asset }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [name, setName] = useState(asset.name);
  const [category, setCategory] = useState<AssetCategory | "">(
    (asset.category as AssetCategory) ?? ""
  );
  const [defaultSource, setDefaultSource] = useState(
    asset.category ? ASSET_DEFAULTS[asset.category as AssetCategory]?.source ?? "" : ""
  );

  const [purchaseDate, setPurchaseDate] = useState(asset.purchase_date ?? "");
  const [purchasePrice, setPurchasePrice] = useState(
    asset.purchase_price != null ? String(asset.purchase_price) : ""
  );
  const [currency, setCurrency] = useState<"ARS" | "USD">(asset.currency);
  const [replacementCost, setReplacementCost] = useState(
    asset.replacement_cost != null ? String(asset.replacement_cost) : ""
  );
  const [currentValueOverride, setCurrentValueOverride] = useState(
    asset.current_value != null ? String(asset.current_value) : ""
  );

  const [usefulLifeMonths, setUsefulLifeMonths] = useState(
    asset.useful_life_months != null ? String(asset.useful_life_months) : ""
  );
  const [residualPct, setResidualPct] = useState(pctToStr(asset.residual_pct));
  const [maintenancePct, setMaintenancePct] = useState(pctToStr(asset.maintenance_pct_annual));
  const [interestRate, setInterestRate] = useState(
    asset.interest_rate_monthly != null ? String(asset.interest_rate_monthly * 100) : "0"
  );
  const [replacementHorizon, setReplacementHorizon] = useState(
    asset.replacement_horizon_months != null ? String(asset.replacement_horizon_months) : ""
  );

  // Campos específicos de autos
  const [carSegment, setCarSegment] = useState<CarSegment>(
    (asset.car_segment as CarSegment) ?? "popular"
  );
  const [boughtUsed, setBoughtUsed] = useState(asset.bought_used ?? true);

  // Objetivo de ahorro
  const [savingsGoalMode, setSavingsGoalMode] = useState<"calculated" | "manual">(
    asset.savings_goal_mode === "manual" ? "manual" : "calculated"
  );
  const [savingsGoalAmount, setSavingsGoalAmount] = useState(
    asset.savings_goal_amount != null ? String(asset.savings_goal_amount) : ""
  );
  const [savingsGoalMonths, setSavingsGoalMonths] = useState(
    asset.savings_goal_months != null ? String(asset.savings_goal_months) : ""
  );

  function handleCategoryChange(cat: AssetCategory | "") {
    setCategory(cat);
    if (!cat) {
      setDefaultSource("");
      return;
    }
    const d = ASSET_DEFAULTS[cat];
    setUsefulLifeMonths(d.useful_life_months != null ? String(d.useful_life_months) : "");
    setResidualPct(d.residual_pct != null ? String(d.residual_pct * 100) : "");
    setMaintenancePct(String(d.maintenance_pct_annual * 100));
    setCurrency(d.currency_ref);
    setDefaultSource(d.source);
  }

  const isAuto = category === "auto";
  const isVivienda = category === "vivienda";

  const preview = useMemo(() => {
    if (!purchaseDate || !purchasePrice || !replacementCost) return null;
    if (savingsGoalMode === "manual") {
      const goal = parseFloat(savingsGoalAmount);
      const months = parseInt(savingsGoalMonths);
      if (isNaN(goal) || isNaN(months) || months <= 0 || goal <= 0) return null;
      const pp = parseFloat(purchasePrice);
      const cv =
        currentValueOverride && !isNaN(parseFloat(currentValueOverride))
          ? parseFloat(currentValueOverride)
          : null;
      const mpa = maintenancePct ? parseFloat(maintenancePct) / 100 : 0;
      const currentValue = cv ?? pp;
      const maintenance = currentValue * (mpa / 12);
      return {
        sinkingFund: goal / months,
        maintenance,
        total: goal / months + maintenance,
        monthsRemaining: months,
        goalAmount: goal,
        residualValue: null as number | null,
        isManual: true,
      };
    }
    const C0 = parseFloat(replacementCost);
    const pp = parseFloat(purchasePrice);
    if (isNaN(C0) || isNaN(pp) || pp <= 0 || C0 <= 0) return null;
    const mpa = maintenancePct ? parseFloat(maintenancePct) / 100 : 0;
    if (isNaN(mpa)) return null;
    const cv =
      currentValueOverride && !isNaN(parseFloat(currentValueOverride))
        ? parseFloat(currentValueOverride)
        : null;
    const rh = replacementHorizon ? parseInt(replacementHorizon) : null;
    const result = calcAssetFunds({
      C0,
      purchasePrice: pp,
      purchaseDate,
      useful_life_months: usefulLifeMonths ? parseInt(usefulLifeMonths) : null,
      residual_pct: residualPct ? parseFloat(residualPct) / 100 : null,
      maintenance_pct_annual: mpa,
      interest_rate_monthly: interestRate ? parseFloat(interestRate) / 100 : 0,
      current_value: cv,
      replacement_horizon_months: rh,
      car_segment: isAuto ? carSegment : null,
      bought_used: isAuto ? boughtUsed : null,
    });
    return { ...result, isManual: false };
  }, [
    purchaseDate,
    purchasePrice,
    replacementCost,
    usefulLifeMonths,
    residualPct,
    maintenancePct,
    interestRate,
    currentValueOverride,
    replacementHorizon,
    isAuto,
    carSegment,
    boughtUsed,
    savingsGoalMode,
    savingsGoalAmount,
    savingsGoalMonths,
  ]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setServerError(null);

    const pct = (v: string) => (v ? parseFloat(v) / 100 : null);
    const num = (v: string) => (v ? parseFloat(v) : null);
    const int = (v: string) => (v ? parseInt(v) : null);

    try {
      const result = await updateAsset(asset.id, {
        name,
        category: category || null,
        purchase_date: purchaseDate || null,
        purchase_price: num(purchasePrice),
        currency,
        replacement_cost: num(replacementCost),
        current_value: num(currentValueOverride),
        useful_life_months: int(usefulLifeMonths),
        residual_pct: pct(residualPct),
        maintenance_pct_annual: pct(maintenancePct),
        interest_rate_monthly: interestRate ? parseFloat(interestRate) / 100 : 0,
        replacement_horizon_months: int(replacementHorizon),
        car_segment: isAuto ? carSegment : null,
        bought_used: isAuto ? boughtUsed : null,
        savings_goal_mode: savingsGoalMode,
        savings_goal_amount: savingsGoalMode === "manual" ? num(savingsGoalAmount) : null,
        savings_goal_months: savingsGoalMode === "manual" ? int(savingsGoalMonths) : null,
      });

      if (result.error) {
        setServerError(result.error);
        setSaving(false);
      } else {
        router.push("/bienes");
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Error inesperado al guardar");
      setSaving(false);
    }
  }

  const carSeg = CAR_DEPRECIATION_SEGMENTS[carSegment];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-8">
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Identificación
        </h2>

        <Field label="Nombre del bien">
          <input
            type="text"
            required
            placeholder="ej: Heladera Samsung"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label="Categoría">
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value as AssetCategory | "")}
            className={INPUT}
          >
            <option value="">Sin categoría</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {defaultSource && (
            <p className="text-[11px] text-indigo-600 mt-1">
              Defaults · Fuente: {defaultSource}
            </p>
          )}
        </Field>

        {/* Campos específicos de autos */}
        {isAuto && (
          <div className="space-y-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-700">Detalles del auto</p>

            <Field label="Segmento">
              <select
                value={carSegment}
                onChange={(e) => setCarSegment(e.target.value as CarSegment)}
                className={INPUT}
              >
                {CAR_SEGMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-blue-600 mt-1">
                {carSeg.label}: −{(carSeg.d1 * 100).toFixed(0)}% primer año, −{(carSeg.d2 * 100).toFixed(0)}% años siguientes · Fuente: {carSeg.source}
              </p>
            </Field>

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={boughtUsed}
                onChange={(e) => setBoughtUsed(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Lo compré usado (el primer año de caída fuerte ya ocurrió con el dueño anterior)
            </label>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Datos de compra
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de compra">
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Moneda">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as "ARS" | "USD")}
              className={INPUT}
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </Field>
        </div>

        <Field
          label={`Precio de compra (${currency})`}
          hint="Si no lo recordás con exactitud, estimalo."
        >
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field
          label={`¿Cuánto cuesta el bien con el que lo vas a reemplazar? (${currency})`}
          hint="Puede ser más caro (upgrade) o más barato. Si querés algo similar, poné el precio de un equivalente hoy."
        >
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={replacementCost}
            onChange={(e) => setReplacementCost(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field
          label={`Valor actual (${currency}) — opcional`}
          hint={isAuto ? "Vacío = precio de compra (auto reciente)" : "Vacío = depreciación 16%/año automática (§1.3)"}
        >
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Calculado automáticamente"
            value={currentValueOverride}
            onChange={(e) => setCurrentValueOverride(e.target.value)}
            className={INPUT}
          />
        </Field>
      </section>

      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Horizonte de reemplazo
        </h2>

        <Field
          label="¿En cuántos meses querés reemplazarlo?"
          hint="Sobreescribe el cálculo automático de vida útil restante. Ej: 24 = en 2 años."
        >
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Calculado desde fecha de compra"
            value={replacementHorizon}
            onChange={(e) => setReplacementHorizon(e.target.value)}
            className={INPUT}
          />
        </Field>
        {replacementHorizon && (
          <p className="text-[11px] text-indigo-600">
            El sinking fund se calculará sobre {replacementHorizon} meses, ignorando la vida útil registrada.
          </p>
        )}
      </section>

      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Parámetros del fondo
        </h2>

        {isVivienda ? (
          <p className="text-xs text-gray-400 italic">
            Vivienda: solo Maintenance Reserve. Vida útil y residual no aplican.
          </p>
        ) : (
          <>
            <Field label="Vida útil (meses)">
              <input
                type="number"
                min="1"
                placeholder="144"
                value={usefulLifeMonths}
                onChange={(e) => setUsefulLifeMonths(e.target.value)}
                className={INPUT}
              />
            </Field>

            {!isAuto && (
              <Field label="Valor residual al fin de vida (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="10"
                  value={residualPct}
                  onChange={(e) => setResidualPct(e.target.value)}
                  className={INPUT}
                />
              </Field>
            )}
          </>
        )}

        <Field label="Mantenimiento anual (%)">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="1"
            value={maintenancePct}
            onChange={(e) => setMaintenancePct(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field
          label="Tasa de rendimiento mensual i (%)"
          hint="Default 0 — Argentina, ahorro en USD billete (§3.1)"
        >
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            className={INPUT}
          />
        </Field>
      </section>

      {/* Objetivo de ahorro */}
      {!isVivienda && (
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Objetivo de ahorro
          </h2>
          <div className="flex gap-2">
            {(["calculated", "manual"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSavingsGoalMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  savingsGoalMode === m
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {m === "calculated" ? "Calculado" : "Manual"}
              </button>
            ))}
          </div>
          {savingsGoalMode === "manual" && (
            <div className="space-y-3">
              <Field
                label={`Quiero juntar (${currency})`}
                hint="La app usará exactamente este monto, ignorando el modelo de depreciación."
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={savingsGoalAmount}
                  onChange={(e) => setSavingsGoalAmount(e.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field label="En (meses)">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="24"
                  value={savingsGoalMonths}
                  onChange={(e) => setSavingsGoalMonths(e.target.value)}
                  className={INPUT}
                />
              </Field>
            </div>
          )}
        </section>
      )}

      {preview && (
        <section className="bg-gray-900 text-white rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Aporte mensual estimado
            {preview.isManual && (
              <span className="ml-2 text-amber-400 normal-case font-normal">· modo manual</span>
            )}
          </p>
          <div className="space-y-2">
            {preview.sinkingFund > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-300">Sinking Fund</span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(preview.sinkingFund, currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-300">Mantenimiento</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(preview.maintenance, currency)}
              </span>
            </div>
            <div className="border-t border-gray-700 pt-2 flex justify-between">
              <span className="text-sm font-medium">Total</span>
              <span className="text-base font-bold tabular-nums">
                {formatCurrency(preview.total, currency)}
                <span className="text-xs font-normal text-gray-400">/mes</span>
              </span>
            </div>
          </div>
          {preview.goalAmount > 0 && (
            <p className="text-xs text-gray-400">
              Meta: {formatCurrency(preview.goalAmount, currency)} en {preview.monthsRemaining} meses
              {!preview.isManual && preview.residualValue != null && (
                <span className="ml-1">(reventa estimada: {formatCurrency(preview.residualValue, currency)})</span>
              )}
            </p>
          )}
        </section>
      )}

      {serverError && (
        <p className="text-sm text-red-600 text-center">{serverError}</p>
      )}

      <button
        type="submit"
        disabled={saving || !name}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 transition-opacity"
      >
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
