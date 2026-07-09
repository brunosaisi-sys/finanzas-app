import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import IncomeForm from "./_components/IncomeForm";
import type { Account } from "@/types";

export default async function NuevoIngresoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("accounts")
    .select("*")
    .order("name");

  const accounts = (data ?? []) as Account[];

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-900">
          ← Inicio
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Registrar ingreso</h1>
      </div>
      <IncomeForm accounts={accounts} />
    </div>
  );
}
