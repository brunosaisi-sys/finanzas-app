import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import DeleteAssetButton from "./_components/DeleteAssetButton";
import {
  calcAssetFunds,
  getDefaultsForCategory,
  AssetCategory,
} from "@/lib/finance/sinkingFund";
import type { Asset, Currency } from "@/types";

const CATEGORY_LABELS: Record<string, string> = {
  heladera: "Heladera/Freezer",
  lavarropas: "Lavarropas",
  lavavajillas: "Lavavajillas",
  secarropas: "Secarropas",
  microondas: "Microondas",
  horno: "Horno/Cocina",
  tv: "TV",
  notebook: "Notebook/PC",
  smartphone: "Smartphone",
  auto: "Auto",
  vivienda: "Vivienda",
  muebles: "Muebles",
};

export default async function BienesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  const assets = (data ?? []) as Asset[];

  if (assets.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between pt-2 mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Bienes</h1>
          <Link
            href="/bienes/nuevo"
            className="text-sm font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg"
          >
            + Agregar
          </Link>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-3">
          <p className="text-4xl">🏡</p>
          <p className="text-sm font-medium text-gray-900">Sin bienes registrados</p>
          <p className="text-sm text-gray-400">
            Registrá tus bienes para calcular cuánto reservar cada mes para mantenerlos y reponerlos.
          </p>
          <Link
            href="/bienes/nuevo"
            className="inline-block mt-2 text-sm font-medium text-gray-900 underline"
          >
            Agregar primer bien
          </Link>
        </div>
      </div>
    );
  }

  const today = new Date();

  // Calcular fondos por bien y acumular totales por moneda
  const totals: Record<string, { sinking: number; maintenance: number }> = {};

  const items = assets.map((asset) => {
    const C0 = asset.replacement_cost ?? asset.purchase_price ?? 0;
    const pp = asset.purchase_price ?? C0;
    const pd = asset.purchase_date ?? asset.created_at.split("T")[0];

    // Completar con defaults de categoría si el usuario no sobrescribió
    let ulm = asset.useful_life_months;
    let rp = asset.residual_pct;
    let mpa = asset.maintenance_pct_annual;

    if (asset.category) {
      const def = getDefaultsForCategory(asset.category as AssetCategory);
      if (ulm == null) ulm = def.useful_life_months;
      if (rp == null) rp = def.residual_pct;
      if (mpa == null) mpa = def.maintenance_pct_annual;
    }

    const result = calcAssetFunds({
      C0,
      purchasePrice: pp,
      purchaseDate: pd,
      useful_life_months: ulm,
      residual_pct: rp,
      maintenance_pct_annual: mpa ?? 0,
      interest_rate_monthly: asset.interest_rate_monthly ?? 0,
      current_value: asset.current_value,
      replacement_horizon_months: asset.replacement_horizon_months,
      today,
    });

    const c = asset.currency;
    if (!totals[c]) totals[c] = { sinking: 0, maintenance: 0 };
    totals[c].sinking += result.sinkingFund;
    totals[c].maintenance += result.maintenance;

    return { asset, result };
  });

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-semibold text-gray-900">Bienes</h1>
        <Link
          href="/bienes/nuevo"
          className="text-sm font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg"
        >
          + Agregar
        </Link>
      </div>

      {/* Resumen mensual por moneda */}
      {Object.entries(totals).map(([cur, { sinking, maintenance }]) => (
        <section
          key={cur}
          className="bg-gray-900 text-white rounded-2xl p-4 space-y-3"
        >
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Total a apartar este mes ({cur})
          </p>
          <p className="text-3xl font-bold tabular-nums">
            {formatCurrency(sinking + maintenance, cur as Currency)}
            <span className="text-base font-normal text-gray-400">/mes</span>
          </p>
          <div className="flex gap-4 text-xs text-gray-400">
            <span>Sinking: {formatCurrency(sinking, cur as Currency)}</span>
            <span>·</span>
            <span>Mant.: {formatCurrency(maintenance, cur as Currency)}</span>
          </div>
        </section>
      ))}

      {/* Lista de bienes */}
      <section>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {items.map(({ asset, result }, i) => {
            const yr = Math.floor(result.monthsRemaining / 12);
            const mo = result.monthsRemaining % 12;
            const isExpired =
              result.monthsRemaining === 0 &&
              result.sinkingFund === 0 &&
              asset.category !== "vivienda" &&
              asset.useful_life_months != null;

            return (
              <div
                key={asset.id}
                className={`px-4 py-3 ${i > 0 ? "border-t border-gray-100" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {asset.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {asset.category
                        ? CATEGORY_LABELS[asset.category]
                        : "Sin categoría"}
                      {asset.purchase_date &&
                        ` · ${new Date(asset.purchase_date).getFullYear()}`}
                    </p>
                    {result.monthsRemaining > 0 && (
                      <p className="text-xs text-gray-300 mt-0.5">
                        {asset.replacement_horizon_months
                          ? `${asset.replacement_horizon_months} mes${asset.replacement_horizon_months !== 1 ? "es" : ""} (horizonte manual)`
                          : [
                              yr > 0 && `${yr} año${yr !== 1 ? "s" : ""}`,
                              mo > 0 && `${mo} mes${mo !== 1 ? "es" : ""}`,
                            ]
                              .filter(Boolean)
                              .join(" ")}{" "}
                        para reponer
                      </p>
                    )}
                    {isExpired && (
                      <p className="text-xs text-amber-600 mt-0.5 font-medium">
                        Vida útil cumplida
                      </p>
                    )}
                    <div className="flex gap-3 mt-1.5">
                      <Link
                        href={`/bienes/${asset.id}/editar`}
                        className="text-[11px] text-indigo-600 font-medium"
                      >
                        Editar
                      </Link>
                      <DeleteAssetButton assetId={asset.id} assetName={asset.name} />
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-sm font-bold text-gray-900 tabular-nums">
                      {formatCurrency(result.total, asset.currency)}
                      <span className="text-[11px] font-normal text-gray-400">
                        /mes
                      </span>
                    </p>
                    {result.sinkingFund > 0 && (
                      <p className="text-[11px] text-gray-400 tabular-nums">
                        Sinking {formatCurrency(result.sinkingFund, asset.currency)}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 tabular-nums">
                      Mant. {formatCurrency(result.maintenance, asset.currency)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
