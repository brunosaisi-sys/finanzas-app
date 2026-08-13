"use client";

import { Eye, EyeOff } from "lucide-react";
import { useHideBalances, setHideBalances } from "./Money";

// TAREA 1d (Sesión J.1.16): ícono reutilizable para prender/apagar "ocultar
// saldos" desde cualquier pantalla (además del switch dedicado en
// /configuracion). Mismo estado global de Money.tsx.
export default function EyeToggle({ className }: { className?: string }) {
  const hide = useHideBalances();
  return (
    <button
      type="button"
      onClick={() => setHideBalances(!hide)}
      aria-label={hide ? "Mostrar saldos" : "Ocultar saldos"}
      className={
        className ??
        "w-9 h-9 rounded-xl bg-fz-surface border border-fz-border flex items-center justify-center text-fz-text-secondary"
      }
    >
      {hide ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}
