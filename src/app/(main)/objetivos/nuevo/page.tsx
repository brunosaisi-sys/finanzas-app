import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import GoalForm from "./_components/GoalForm";
import type { Account } from "@/types";

export default async function NuevoObjetivoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountsData } = await supabase
    .from("accounts")
    .select("*")
    .order("name");

  const accounts = (accountsData ?? []) as Account[];

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link href="/objetivos" className="text-sm text-gray-400 hover:text-gray-900">
          ← Metas
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Nuevo objetivo</h1>
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <GoalForm accounts={accounts} />
      </div>
    </div>
  );
}
