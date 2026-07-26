import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NuevaCuentaForm from "./_components/NuevaCuentaForm";
import type { AccountType } from "@/types";

export default async function NuevaCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ parent?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { parent: parentId } = await searchParams;

  let parent: {
    id: string;
    name: string;
    type: AccountType;
    balance: number;
    currency: string;
  } | null = null;
  let parentHasChildren = false;

  if (parentId) {
    // Removed .is("parent_id", null) — accounts at any level can be parents
    const { data } = await supabase
      .from("accounts")
      .select("id, name, type, balance, currency")
      .eq("id", parentId)
      .single();
    parent = data ?? null;

    if (parent) {
      const { count } = await supabase
        .from("accounts")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", parentId);
      parentHasChildren = (count ?? 0) > 0;
    }
  }

  // Bank accounts — offered as optional parent when creating a credit card
  const { data: bankAccountsRaw } = await supabase
    .from("accounts")
    .select("id, name")
    .in("type", ["banco"])
    .is("parent_id", null)
    .order("name");

  const bankAccounts: { id: string; name: string }[] = bankAccountsRaw ?? [];

  return (
    <NuevaCuentaForm
      parent={parent}
      parentHasChildren={parentHasChildren}
      bankAccounts={bankAccounts}
    />
  );
}
