"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { INSTITUTIONS, INSTITUTION_GROUPS } from "@/lib/institutions";

export default function AccountsOnboarding() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sesión expirada. Recargá la página."); setLoading(false); return; }

    const toCreate = INSTITUTIONS.filter((i) => selected.has(i.id));

    const { error } = await supabase.from("accounts").insert(
      toCreate.map((inst) => ({
        user_id: user.id,
        name: inst.name,
        type: inst.dbType,
        currency: inst.defaultCurrency,
        balance: 0,
      }))
    );

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/cuentas");
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Seleccioná las cuentas y billeteras que usás. Podés agregar más en cualquier momento.
      </p>

      {INSTITUTION_GROUPS.map((group) => {
        const items = INSTITUTIONS.filter((i) => i.group === group.key);
        return (
          <section key={group.key}>
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              {group.label}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {items.map((inst) => (
                <button
                  key={inst.id}
                  onClick={() => toggle(inst.id)}
                  className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    selected.has(inst.id)
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {inst.name}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="space-y-3 pt-2">
        <button
          onClick={handleCreate}
          disabled={selected.size === 0 || loading}
          className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {loading
            ? "Creando..."
            : selected.size > 0
            ? `Agregar ${selected.size} cuenta${selected.size !== 1 ? "s" : ""}`
            : "Seleccioná al menos una"}
        </button>
        <Link
          href="/cuentas/nueva"
          className="block w-full text-center text-sm text-gray-500 hover:text-gray-900 transition-colors py-2"
        >
          O agregar cuenta personalizada →
        </Link>
      </div>
    </div>
  );
}
