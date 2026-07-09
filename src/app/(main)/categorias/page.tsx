import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CategoriesOnboarding from "./_components/CategoriesOnboarding";

export default async function CategoriasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .is("parent_id", null)
    .order("name");

  if (!categories || categories.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 pt-2 mb-6">Categorías</h1>
        <CategoriesOnboarding />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold text-gray-900">Categorías</h1>
        <Link
          href="/categorias/nueva"
          className="text-sm font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-2 transition-colors"
        >
          + Nueva
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              i > 0 ? "border-t border-gray-100" : ""
            }`}
          >
            <span className="text-xl w-7 text-center">{cat.icon ?? "🏷️"}</span>
            <p className="text-sm font-medium text-gray-900">{cat.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
