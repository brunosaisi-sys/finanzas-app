import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ExpenseForm from "@/components/ExpenseForm";
import { fetchShareGroupsWithMembers } from "@/lib/queries/shareGroups";
import type { Account, Category } from "@/types";

// Ruta optimizada para el Action Button de iPhone (iOS Shortcuts).
export default async function NuevoGastoDirectoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: accounts }, { data: categories }, shareGroups] = await Promise.all([
    supabase.from("accounts").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
    fetchShareGroupsWithMembers(),
  ]);

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 pt-2 mb-6">Nuevo gasto</h1>
      <ExpenseForm
        accounts={(accounts ?? []) as Account[]}
        categories={(categories ?? []) as Category[]}
        shareGroups={shareGroups}
        redirectTo="/"
      />
    </div>
  );
}
