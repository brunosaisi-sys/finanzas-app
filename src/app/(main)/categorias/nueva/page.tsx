"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const EMOJI_OPTIONS = [
  "🛒", "🚌", "🏠", "💊", "⛽", "🍕", "💡", "👕",
  "🎬", "📱", "🐾", "📚", "🏋️", "🎁", "✈️", "🐷",
  "💼", "🎮", "🍺", "☕", "💅", "🏥", "🚗", "🎵",
  "📦", "🌿", "🔧", "💻", "📷", "🏪", "🎓", "🧴",
];

export default function NuevaCategoriaPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏷️");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sesión expirada. Recargá la página."); setLoading(false); return; }

    const { error } = await supabase.from("categories").insert({
      user_id: user.id,
      name: name.trim(),
      icon,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/categorias");
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link href="/categorias" className="text-gray-400 hover:text-gray-900 transition-colors">
          ←
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Nueva categoría</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Supermercado"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Ícono{" "}
            <span className="text-gray-400 font-normal">— seleccionado: {icon}</span>
          </label>
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`text-2xl aspect-square flex items-center justify-center rounded-lg transition-colors ${
                  icon === emoji ? "bg-gray-900" : "hover:bg-gray-100"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {loading ? "Guardando..." : "Guardar categoría"}
        </button>
      </form>
    </div>
  );
}
