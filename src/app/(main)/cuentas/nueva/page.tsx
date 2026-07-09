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

  let parent: { id: string; name: string; type: AccountType } | null = null;
  if (parentId) {
    const { data } = await supabase
      .from("accounts")
      .select("id, name, type")
      .eq("id", parentId)
      .is("parent_id", null)
      .single();
    parent = data ?? null;
  }

  return <NuevaCuentaForm parent={parent} />;
}
