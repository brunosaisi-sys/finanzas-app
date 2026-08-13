"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** "link" = texto chico gris (Inicio, sin cambios). "block" = botón rojo
   * centrado, mismo tratamiento que el prototipo de Claude Design en
   * Configuración (Sesión J.1.16). */
  variant?: "link" | "block";
}

export default function LogoutButton({ variant = "link" }: Props) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (variant === "block") {
    return (
      <button
        onClick={handleLogout}
        className="text-sm font-semibold text-fz-negative py-3"
      >
        Cerrar sesión
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
    >
      Cerrar sesión
    </button>
  );
}
