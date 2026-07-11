import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { getAllSavingsTargets } from "@/lib/finance/savingsGoals";
import AportarButton from "./_components/AportarButton";
import DeleteGoalButton from "./_components/DeleteGoalButton";
import type { Asset, SavingsGoal, SavingsContribution, Account, Currency } from "@/types";

export default async function ObjetivosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: assetsData },
    { data: goalsData },
    { data: contribsData },
    { data: accountsData },
  ] = await Promise.all([
    supabase.from("assets").select("*").order("created_at", { ascending: false }),
    supabase.from("savings_goals").select("*").eq("archived", false).order("created_at", { ascending: false }),
    supabase.from("savings_contributions").select("*"),
    supabase.from("accounts").select("*").order("name"),
  ]);

  const assets = (assetsData ?? []) as Asset[];
  const goals = (goalsData ?? []) as SavingsGoal[];
  const contributions = (contribsData ?? []) as SavingsContribution[];
  const accounts = (accountsData ?? []) as Account[];

  const today = new Date();
  const targets = getAllSavingsTargets(assets, goals, contributions, today);

  // Totales por moneda para el resumen superior
  const totals: Record<string, number> = {};
  for (const t of targets) {
    if (!totals[t.currency]) totals[t.currency] = 0;
    totals[t.currency] += t.monthlyContribution;
  }

  const isEmpty = targets.length === 0;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-semibold text-gray-900">Metas</h1>
        <Link
          href="/objetivos/nuevo"
          className="text-sm font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg"
        >
          + Objetivo
        </Link>
      </div>

      {isEmpty ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-3">
          <p className="text-4xl">🎯</p>
          <p className="text-sm font-medium text-gray-900">Sin metas activas</p>
          <p className="text-sm text-gray-400">
            Tus bienes registrados y los objetivos manuales (viajes, etc.) aparecen acá.
          </p>
          <Link
            href="/objetivos/nuevo"
            className="inline-block mt-2 text-sm font-medium text-gray-900 underline"
          >
            Crear primer objetivo
          </Link>
        </div>
      ) : (
        <>
          {/* Resumen mensual por moneda */}
          {Object.entries(totals).map(([cur, total]) => (
            <section
              key={cur}
              className="bg-gray-900 text-white rounded-2xl p-4 space-y-1"
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                A apartar este mes ({cur})
              </p>
              <p className="text-3xl font-bold tabular-nums">
                {formatCurrency(total, cur as Currency)}
                <span className="text-base font-normal text-gray-400">/mes</span>
              </p>
            </section>
          ))}

          {/* Lista de metas */}
          <section>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {targets.map((target, i) => {
                const yr = Math.floor(target.monthsRemaining / 12);
                const mo = target.monthsRemaining % 12;
                const timeLabel =
                  target.monthsRemaining === 0
                    ? "Vencida"
                    : [
                        yr > 0 && `${yr} año${yr !== 1 ? "s" : ""}`,
                        mo > 0 && `${mo} mes${mo !== 1 ? "es" : ""}`,
                      ]
                        .filter(Boolean)
                        .join(" ");

                return (
                  <div
                    key={target.id}
                    className={`px-4 py-3 ${i > 0 ? "border-t border-gray-100" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Nombre + badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {target.name}
                          </p>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              target.kind === "goal"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {target.kind === "goal" ? "Objetivo" : "Bien"}
                          </span>
                        </div>

                        {/* Progreso */}
                        <div className="mt-1.5 mb-1">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, target.progressPct)}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {formatCurrency(target.accumulated, target.currency)} de{" "}
                            {formatCurrency(target.targetAmount, target.currency)}{" "}
                            ({Math.round(target.progressPct)}%)
                          </p>
                        </div>

                        {/* Tiempo restante */}
                        {timeLabel && (
                          <p className="text-[11px] text-gray-300">
                            {timeLabel === "Vencida" ? (
                              <span className="text-amber-600 font-medium">Vencida</span>
                            ) : (
                              `${timeLabel} restantes`
                            )}
                          </p>
                        )}

                        {/* Acciones */}
                        <div className="flex gap-3 mt-1.5 flex-wrap">
                          <AportarButton
                            targetKind={target.kind}
                            targetId={target.id}
                            targetName={target.name}
                            targetCurrency={target.currency}
                            destAccountId={target.accountId}
                            suggestedAmount={target.monthlyContribution}
                            accounts={accounts}
                          />
                          {target.kind === "asset" ? (
                            <Link
                              href={`/bienes/${target.id}/editar`}
                              className="text-[11px] text-gray-500"
                            >
                              Editar bien
                            </Link>
                          ) : (
                            <>
                              <Link
                                href={`/objetivos/${target.id}/editar`}
                                className="text-[11px] text-gray-500"
                              >
                                Editar
                              </Link>
                              <DeleteGoalButton goalId={target.id} goalName={target.name} />
                            </>
                          )}
                        </div>
                      </div>

                      {/* Aporte mensual */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">
                          {formatCurrency(target.monthlyContribution, target.currency)}
                          <span className="text-[11px] font-normal text-gray-400">/mes</span>
                        </p>
                        <p className="text-[11px] text-gray-400">
                          Meta {formatCurrency(target.targetAmount, target.currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Link a /bienes para ver detalle de mantenimiento */}
          <p className="text-xs text-center text-gray-400">
            Los aportes de mantenimiento aparecen en{" "}
            <Link href="/bienes" className="underline">
              Bienes
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
