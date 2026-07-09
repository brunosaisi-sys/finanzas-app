import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import DistribuirForm from "./_components/DistribuirForm";
import { calculateMonthlyObligations } from "@/lib/finance/monthlyObligations";
import type { Asset, Account, Currency } from "@/types";

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

  // Últimos 3 meses para calcular el promedio de gastos ARS
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

  const installments = (
    (installmentsData ?? []) as unknown as InstallmentForObligations[]
  ).map((i) => ({
    expense_description: i.expenses?.description ?? null,
    amount: Number(i.amount),
    currency: i.expenses?.currency ?? "ARS",
  }));

  const obligations = calculateMonthlyObligations(assets, installments, now);

  // Solo se resta del remanente lo que está en la misma moneda que el ingreso.
  // Las obligaciones en la otra moneda son informativas — el usuario las cubre
  // por separado con sus ahorros en esa moneda.
  const incomeCurrency = income.currency;
  const otherCurrency: Currency = incomeCurrency === "ARS" ? "USD" : "ARS";
  const obligationsIncomeCurrency =
    incomeCurrency === "ARS" ? obligations.total_ars : obligations.total_usd;
  const obligationsOtherCurrency =
    incomeCurrency === "ARS" ? obligations.total_usd : obligations.total_ars;

  // Promedio mensual de gastos ARS en los últimos 3 meses completos (§0 fundamentos)
  const currentMonthKey = now.toISOString().substring(0, 7); // "YYYY-MM"
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

  // Crear fondo de emergencia si no existe
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
        obligationsIncomeCurrency={obligationsIncomeCurrency}
        obligationsOtherCurrency={obligationsOtherCurrency}
        otherCurrency={otherCurrency}
        accounts={accounts}
        emergencyFund={{
          id: emergencyFund?.id ?? "",
          currentAmount,
          targetAmount: emergencyTarget,
          suggestedContribution,
          monthsOfData: completedMonths.length,
        }}
      />
    </div>
  );
}
