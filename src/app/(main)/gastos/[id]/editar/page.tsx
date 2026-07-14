import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import EditExpenseForm from "./_components/EditExpenseForm";
import type { Account, Category, Expense } from "@/types";

export default async function EditarGastoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: expenseData },
    { data: accountsData },
    { data: categoriesData },
  ] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("accounts").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
  ]);

  if (!expenseData) notFound();

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link href="/gastos" className="text-gray-400 hover:text-gray-900 transition-colors">
          ←
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Editar gasto</h1>
      </div>
      <EditExpenseForm
        expense={expenseData as Expense}
        accounts={(accountsData ?? []) as Account[]}
        categories={(categoriesData ?? []) as Category[]}
      />
    </div>
  );
}
