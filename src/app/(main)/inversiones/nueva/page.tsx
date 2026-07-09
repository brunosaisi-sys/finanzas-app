import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import HoldingForm from "./_components/HoldingForm";

export default async function NuevaInversionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, parent_id")
    .order("name");

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link
          href="/inversiones"
          className="text-gray-400 hover:text-gray-900 transition-colors"
        >
          ←
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Nueva posición</h1>
      </div>
      <HoldingForm accounts={accounts ?? []} />
    </div>
  );
}
