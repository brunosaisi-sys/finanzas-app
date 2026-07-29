import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import EditIncomeForm from "./_components/EditIncomeForm";
import type { Account, Income } from "@/types";

export default async function EditarIngresoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: incomeData }, { data: accountsData }] = await Promise.all([
    supabase.from("incomes").select("*").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("accounts").select("*").order("name"),
  ]);

  if (!incomeData) notFound();

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link href="/ingresos" className="text-gray-400 hover:text-gray-900 transition-colors">
          ←
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Editar ingreso</h1>
      </div>
      <EditIncomeForm
        income={incomeData as Income}
        accounts={(accountsData ?? []) as Account[]}
      />
    </div>
  );
}
