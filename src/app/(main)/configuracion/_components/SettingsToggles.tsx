"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useHideBalances, setHideBalances } from "@/components/Money";

// TAREA 1e (Sesión J.1.16): pantalla de Configuración — toggles reales de
// modo claro/oscuro y ocultar saldos, mismo layout que el prototipo de
// Claude Design (pill de 2 opciones para el modo, switch para privacidad).
export default function SettingsToggles() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const hide = useHideBalances();

  // Evita mismatch de hidratación: `theme` de next-themes no está disponible
  // hasta montar en cliente (depende de localStorage, igual que Money.tsx).
  useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";

  return (
    <>
      <div>
        <p className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide mb-2 px-1">
          Apariencia
        </p>
        <div className="bg-fz-surface border border-fz-border rounded-2xl px-4 py-3.5 flex items-center justify-between">
          <p className="text-sm font-medium text-fz-text">Modo</p>
          <div className="flex bg-fz-surface-high rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mounted && !isDark ? "bg-fz-accent text-fz-accent-text" : "text-fz-text-secondary"
              }`}
            >
              Claro
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isDark ? "bg-fz-accent text-fz-accent-text" : "text-fz-text-secondary"
              }`}
            >
              Oscuro
            </button>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide mb-2 px-1">
          Privacidad
        </p>
        <div className="bg-fz-surface border border-fz-border rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-fz-text">Ocultar saldos</p>
            <p className="text-xs text-fz-text-tertiary mt-0.5">
              Reemplaza los montos por puntos en toda la app
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHideBalances(!hide)}
            aria-label="Ocultar saldos"
            aria-pressed={hide}
            className={`w-[46px] h-[27px] rounded-full relative shrink-0 transition-colors ${
              hide ? "bg-fz-accent" : "bg-fz-border"
            }`}
          >
            <span
              className={`w-[21px] h-[21px] rounded-full bg-white absolute top-[3px] transition-all ${
                hide ? "left-[22px]" : "left-[3px]"
              }`}
            />
          </button>
        </div>
      </div>
    </>
  );
}
