import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ReglaForm from "./_components/ReglaForm";
import type { Account, IncomeDistributionRule, IncomeDistributionLine } from "@/types";

type RuleWithLines = IncomeDistributionRule & {
  income_distribution_lines: IncomeDistributionLine[];
};

export default async function ReglaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: ruleData }, { data: accountsData }] = await Promise.all([
    supabase
      .from("income_distribution_rules")
      .select("*, income_distribution_lines(*)")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle(),
    supabase.from("accounts").select("*").order("name"),
  ]);

  const rule = ruleData as RuleWithLines | null;
  const accounts = (accountsData ?? []) as Account[];

  const initialLines = (rule?.income_distribution_lines ?? []).map((l) => ({
    key: l.id,
    account_id: l.account_id ?? "",
    label: l.label,
    percentage: String(l.percentage),
  }));

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-2">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-900">
          ← Inicio
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Regla de distribución</h1>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        Definí cómo repartir el disponible (ingreso − obligaciones) cada vez que registrás un sueldo.
      </p>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-3">
          <p className="text-sm text-gray-500">
            Necesitás al menos una cuenta para configurar la regla.
          </p>
          <Link href="/cuentas/nueva" className="text-sm font-medium text-gray-900 underline">
            Crear cuenta
          </Link>
        </div>
      ) : (
        <ReglaForm accounts={accounts} initialLines={initialLines} />
      )}
    </div>
  );
}
