import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import TransferenciaForm from "./_components/TransferenciaForm";
import type { Account } from "@/types";

export default async function TransferenciaPage() {
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
        <Link href="/cuentas" className="text-sm text-gray-400 hover:text-gray-900">
          ← Cuentas
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Transferencia</h1>
      </div>
      {accounts.length < 2 ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-3">
          <p className="text-sm text-gray-500">
            Necesitás al menos dos cuentas para transferir.
          </p>
          <Link href="/cuentas/nueva" className="text-sm font-medium text-gray-900 underline">
            Crear cuenta
          </Link>
        </div>
      ) : (
        <TransferenciaForm accounts={accounts} />
      )}
    </div>
  );
}
