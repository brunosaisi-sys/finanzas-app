import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import DistribuirForm from "./_components/DistribuirForm";
import { calculateMonthlyObligations } from "@/lib/finance/monthlyObligations";
import type { Asset, Account, Currency, IncomeDistributionRule, IncomeDistributionLine } from "@/types";

type InstallmentForObligations = {
  amount: number;
  expenses: { description: string | null; currency: string } | null;
};

type RuleWithLines = IncomeDistributionRule & {
  income_distribution_lines: IncomeDistributionLine[];
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

  // Cargar todo en paralelo
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [
    { data: incomeData },
    { data: assetsData },
    { data: installmentsData },
    { data: ruleData },
    { data: accountsData },
  ] = await Promise.all([
    supabase.from("incomes").select("*").eq("id", ingreso_id).single(),
    supabase.from("assets").select("*"),
    supabase
      .from("installments")
      .select("amount, due_date, expenses(description, currency)")
      .eq("paid", false)
      .gte("due_date", firstDay)
      .lte("due_date", lastDay),
    supabase
      .from("income_distribution_rules")
      .select("*, income_distribution_lines(*)")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle(),
    supabase.from("accounts").select("*").order("name"),
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

  const installments = ((installmentsData ?? []) as unknown as InstallmentForObligations[]).map(
    (i) => ({
      expense_description: i.expenses?.description ?? null,
      amount: Number(i.amount),
      currency: i.expenses?.currency ?? "ARS",
    })
  );

  const obligations = calculateMonthlyObligations(assets, installments, now);

  const incomeCurrency = income.currency;
  const otherCurrency: Currency = incomeCurrency === "ARS" ? "USD" : "ARS";

  const obligationsTotal =
    incomeCurrency === "ARS" ? obligations.total_ars : obligations.total_usd;
  const obligationsTotalOther =
    incomeCurrency === "ARS" ? obligations.total_usd : obligations.total_ars;

  const disponible = income.amount - obligationsTotal;

  // Construir líneas sugeridas desde la regla activa
  const rule = ruleData as RuleWithLines | null;
  const lines = rule?.income_distribution_lines ?? [];

  const suggestedLines = lines
    .filter((l) => l.account_id)
    .map((l) => ({
      key: l.id,
      account_id: l.account_id!,
      label: l.label,
      amount: Math.max(0, (disponible * l.percentage) / 100).toFixed(0),
    }));

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-900">
          ← Inicio
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Distribuir sueldo</h1>
        {!rule && (
          <Link
            href="/ingresos/regla"
            className="ml-auto text-xs text-indigo-600 font-medium"
          >
            Configurar regla →
          </Link>
        )}
      </div>

      <DistribuirForm
        incomeId={income.id}
        incomeAmount={income.amount}
        incomeCurrency={incomeCurrency}
        breakdown={obligations.breakdown}
        obligationsTotal={obligationsTotal}
        obligationsTotalOther={obligationsTotalOther}
        otherCurrency={otherCurrency}
        disponible={disponible}
        suggestedLines={suggestedLines}
        accounts={accounts}
      />
    </div>
  );
}
