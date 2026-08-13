"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CategoryPieChart, { type CategorySlice } from "@/components/charts/CategoryPieChart";
import MonthlyComparativaChart, { type MonthBar } from "@/components/charts/MonthlyComparativaChart";
import type { Currency } from "@/types";

// TAREA 4 (Sesión J.1.17): resumen con gráfico en Inicio — tabs Gastos /
// Comparativa / Inversiones, igual concepto que la sección "Resumen" del
// prototipo de Claude Design (confirmado leyendo el .dc.html, Sesión J.1.16
// TAREA 3 ya había hecho lo mismo para el gráfico faltante de Inversiones).
// El tab "Comparativa" (gastos vs. ingresos, 6 meses) hace también de
// "resumen de ingresos" pedido en el brief — mostrar ingresos aislados sin
// el contraste de gastos tendría menos información, no más. El render de
// cada gráfico reusa los mismos componentes que /movimientos (TAREA 3), sin
// duplicar lógica. El tab Inversiones recibe el contenido ya renderizado en
// el servidor (`inversionesSlot`) porque `FciPortfolioSummary` es un Server
// Component async — no se puede importar dentro de este Client Component.
type Tab = "gastos" | "comparativa" | "inversiones";

interface Props {
  categoryDataByCurrency: Partial<Record<Currency, CategorySlice[]>>;
  monthlyComparativa: MonthBar[];
  inversionesSlot: ReactNode;
  hasInvestments: boolean;
}

export default function InicioResumen({
  categoryDataByCurrency,
  monthlyComparativa,
  inversionesSlot,
  hasInvestments,
}: Props) {
  const router = useRouter();
  const currencies = (Object.keys(categoryDataByCurrency) as Currency[]).filter(
    (c) => (categoryDataByCurrency[c]?.length ?? 0) > 0
  );
  const [tab, setTab] = useState<Tab>("gastos");
  const [gastosCurrency, setGastosCurrency] = useState<Currency>(
    currencies.includes("ARS") ? "ARS" : currencies[0]
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "gastos", label: "Gastos" },
    { key: "comparativa", label: "Comparativa" },
    { key: "inversiones", label: "Inversiones" },
  ];

  return (
    <section className="bg-fz-surface border border-fz-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3.5 gap-2">
        <p className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide shrink-0">
          Resumen
        </p>
        <div className="flex bg-fz-surface-high rounded-lg p-0.5 gap-0.5 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                tab === t.key ? "bg-fz-accent text-fz-accent-text" : "text-fz-text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "gastos" &&
        (currencies.length === 0 ? (
          <p className="text-sm text-fz-text-tertiary text-center py-6">Sin gastos este mes.</p>
        ) : (
          <div className="space-y-2">
            {currencies.length > 1 && (
              <div className="flex justify-end">
                <div className="flex bg-fz-surface-high rounded-lg p-0.5 gap-0.5">
                  {currencies.map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => setGastosCurrency(cur)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        gastosCurrency === cur ? "bg-fz-accent text-fz-accent-text" : "text-fz-text-secondary"
                      }`}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <CategoryPieChart
              data={categoryDataByCurrency[gastosCurrency] ?? []}
              currency={gastosCurrency}
              activeCategory={null}
              onSelect={(name) => router.push(`/movimientos?categoria=${encodeURIComponent(name)}`)}
            />
          </div>
        ))}

      {tab === "comparativa" && <MonthlyComparativaChart data={monthlyComparativa} />}

      {tab === "inversiones" &&
        (hasInvestments ? (
          <div className="space-y-3">{inversionesSlot}</div>
        ) : (
          <div className="text-center py-6 space-y-2">
            <p className="text-sm text-fz-text-tertiary">Sin inversiones cargadas.</p>
            <Link href="/inversiones/nueva" className="text-sm font-medium text-fz-text underline">
              Cargar primera posición
            </Link>
          </div>
        ))}

      <Link
        href={tab === "inversiones" ? "/inversiones" : "/movimientos"}
        className="block text-center text-xs font-medium text-fz-text-secondary hover:text-fz-text mt-3 pt-3 border-t border-fz-border"
      >
        {tab === "inversiones" ? "Ver todo en Inversiones →" : "Ver todo en Movimientos →"}
      </Link>
    </section>
  );
}
