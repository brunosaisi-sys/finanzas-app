import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import DistribuirForm from "./_components/DistribuirForm";
import { calculateMonthlyObligations } from "@/lib/finance/monthlyObligations";
import { getAllSavingsTargets } from "@/lib/finance/savingsGoals";
import type { Asset, Account, SavingsGoal, SavingsContribution, Currency } from "@/types";

type InstallmentForObligations = {
  amount: number;
  expenses: { description: string | null; currency: string } | null;
};

export default async function DistribuirPage({
  searchParams,
}: {
  searchParams: Promise<{ ingreso_id?: string }>;
}) {
  const { ingreso_id } = await searchParams;
  if (!ingreso_id) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().split("T")[0];

  const [
    { data: incomeData },
    { data: assetsData },
    { data: installmentsData },
    { data: accountsData },
    { data: emergencyFundData },
    { data: recentExpenses },
    { data: goalsData },
    { data: contribsData },
  ] = await Promise.all([
    supabase.from("incomes").select("*").eq("id", ingreso_id).single(),
    supabase.from("assets").select("*"),
    supabase
      .from("installments")
      .select("amount, due_date, expenses(description, currency)")
      .eq("paid", false)
      .gte("due_date", firstDay)
      .lte("due_date", lastDay),
    supabase.from("accounts").select("*").order("name"),
    supabase
      .from("funds")
      .select("id, name, type, current_amount, currency")
      .eq("user_id", user.id)
      .eq("type", "emergency")
      .maybeSingle(),
    supabase
      .from("expenses")
      .select("amount, date")
      .eq("currency", "ARS")
      .gte("date", threeMonthsAgoStr),
    supabase
      .from("savings_goals")
      .select("*")
      .eq("archived", false),
    supabase.from("savings_contributions").select("*"),
  ]);

  if (!incomeData) redirect("/");

  const income = incomeData as {
    id: string;
    amount: number;
    currency: Currency;
    type: string;
    distributed: boolean;
  };

  if (income.distributed) redirect("/");

  const assets = (assetsData ?? []) as Asset[];
  const accounts = (accountsData ?? []) as Account[];
  const goals = (goalsData ?? []) as SavingsGoal[];
  const contributions = (contribsData ?? []) as SavingsContribution[];

  const installments = (
    (installmentsData ?? []) as unknown as InstallmentForObligations[]
  ).map((i) => ({
    expense_description: i.expenses?.description ?? null,
    amount: Number(i.amount),
    currency: i.expenses?.currency ?? "ARS",
  }));

  const obligations = calculateMonthlyObligations(assets, installments, now);

  const incomeCurrency = income.currency;
  const otherCurrency: Currency = incomeCurrency === "ARS" ? "USD" : "ARS";

  // Capa 1 usa solo maintenance + cuotas (sin sinking, que pasa a Capa 2 como metas).
  const capa1IncomeCurrency =
    incomeCurrency === "ARS"
      ? obligations.maintenance_only_ars
      : obligations.maintenance_only_usd;
  const capa1OtherCurrency =
    incomeCurrency === "ARS"
      ? obligations.maintenance_only_usd
      : obligations.maintenance_only_ars;

  // Promedio mensual gastos ARS para el fondo de emergencia
  const currentMonthKey = now.toISOString().substring(0, 7);
  const monthTotals = new Map<string, number>();
  for (const exp of recentExpenses ?? []) {
    const monthKey = (exp.date as string).substring(0, 7);
    if (monthKey < currentMonthKey) {
      monthTotals.set(monthKey, (monthTotals.get(monthKey) ?? 0) + Number(exp.amount));
    }
  }
  const completedMonths = [...monthTotals.keys()].sort().slice(-3);
  const monthlyAverage =
    completedMonths.length > 0
      ? completedMonths.reduce((s, m) => s + (monthTotals.get(m) ?? 0), 0) /
        completedMonths.length
      : 0;
  const emergencyTarget = Math.round(monthlyAverage * 3);

  let emergencyFund = emergencyFundData;
  if (!emergencyFund) {
    const { data: newFund } = await supabase
      .from("funds")
      .insert({
        user_id: user.id,
        type: "emergency",
        name: "Fondo de emergencia",
        current_amount: 0,
        currency: "ARS",
      })
      .select("id, name, type, current_amount, currency")
      .single();
    emergencyFund = newFund;
  }

  const currentAmount = Number(emergencyFund?.current_amount ?? 0);
  const suggestedContribution =
    currentAmount < emergencyTarget && emergencyTarget > 0
      ? Math.round((emergencyTarget - currentAmount) / 12)
      : 0;

  // Metas de ahorro (bienes + objetivos) para Capa 2
  const savingsTargets = getAllSavingsTargets(assets, goals, contributions, now);

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-900">
          ← Inicio
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Distribuir sueldo</h1>
      </div>

      <DistribuirForm
        incomeId={income.id}
        incomeAmount={income.amount}
        incomeCurrency={incomeCurrency}
        breakdown={obligations.breakdown}
        capa1IncomeCurrency={capa1IncomeCurrency}
        capa1OtherCurrency={capa1OtherCurrency}
        otherCurrency={otherCurrency}
        accounts={accounts}
        emergencyFund={{
          id: emergencyFund?.id ?? "",
          currentAmount,
          targetAmount: emergencyTarget,
          suggestedContribution,
          monthsOfData: completedMonths.length,
        }}
        savingsTargets={savingsTargets}
      />
    </div>
  );
}
