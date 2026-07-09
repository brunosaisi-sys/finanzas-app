"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_CATEGORIES } from "@/lib/categories-defaults";

export default function CategoriesOnboarding() {
  const router = useRouter();
  // Todas seleccionadas por defecto
  const [selected, setSelected] = useState<Set<string>>(
    new Set(DEFAULT_CATEGORIES.map((c) => c.name))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
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

    const cats = DEFAULT_CATEGORIES.filter((c) => selected.has(c.name));

    const { error } = await supabase.from("categories").insert(
      cats.map((c) => ({ user_id: user.id, name: c.name, icon: c.icon }))
    );

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/categorias");
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        Elegí las categorías que querés usar. Podés agregar más en cualquier momento.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {DEFAULT_CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            onClick={() => toggle(cat.name)}
            className={`flex items-center gap-2 text-left px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
              selected.has(cat.name)
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
            }`}
          >
            <span className="text-lg">{cat.icon}</span>
            <span className="leading-tight">{cat.name}</span>
          </button>
        ))}
      </div>

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
            : `Crear ${selected.size} categoría${selected.size !== 1 ? "s" : ""}`}
        </button>
        <Link
          href="/categorias/nueva"
          className="block w-full text-center text-sm text-gray-500 hover:text-gray-900 transition-colors py-2"
        >
          O agregar categoría personalizada →
        </Link>
      </div>
    </div>
  );
}
