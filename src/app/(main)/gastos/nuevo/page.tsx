import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ExpenseForm from "@/components/ExpenseForm";
import type { Account, Category } from "@/types";

export default async function NuevoGastoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: accounts }, { data: categories }, { data: merchantRows }] =
    await Promise.all([
      supabase.from("accounts").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase
        .from("expenses")
        .select("merchant")
        .not("merchant", "is", null)
        .order("merchant"),
    ]);

  const merchants = [
    ...new Set(
      (merchantRows ?? []).map((r) => r.merchant).filter(Boolean) as string[]
    ),
  ];

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link href="/gastos" className="text-gray-400 hover:text-gray-900 transition-colors">
          ←
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Nuevo gasto</h1>
      </div>
      <ExpenseForm
        accounts={(accounts ?? []) as Account[]}
        categories={(categories ?? []) as Category[]}
        merchants={merchants}
        redirectTo="/gastos"
      />
    </div>
  );
}
