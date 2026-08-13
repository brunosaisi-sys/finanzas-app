"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Receipt, Landmark, TrendingUp, Plus, X, ArrowLeftRight, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Sesión J.1.15, TAREA 7a: emoji reemplazados por lucide-react — el set de
// iconos elegido para todo el "chrome" de la app (nunca para contenido elegido
// por el usuario, como el ícono de una categoría). Ver "Sistema de diseño" en
// CLAUDE.md. Sesión J.1.16, TAREA 5: se mantiene lucide-react (no se migra a
// los SVG custom del prototipo de Claude Design) — decisión documentada en
// CLAUDE.md, sección "Sistema de diseño".
// Sesión J.1.17, TAREA 5: Inversiones reemplaza a Metas en la barra — el
// usuario pidió que Inversiones sea un tab de primer nivel. Metas (/objetivos)
// no se elimina, se reubica como acceso rápido en Inicio (ver CLAUDE.md,
// checkpoint de sesión, para el motivo de esa elección de lugar).
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/movimientos", label: "Movimientos", icon: Receipt },
  { href: "/cuentas", label: "Cuentas", icon: Landmark },
  { href: "/inversiones", label: "Inversiones", icon: TrendingUp },
];

const QUICK_ACTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/gastos/nuevo", label: "Nuevo gasto", icon: Receipt },
  { href: "/ingresos/nuevo", label: "Nuevo ingreso", icon: Wallet },
  { href: "/cuentas/transferencia", label: "Transferencia", icon: ArrowLeftRight },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function handleAction(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Bottom sheet */}
      {open && (
        <div className="fixed bottom-16 left-0 right-0 z-50 flex justify-center px-4">
          <div className="w-full max-w-lg bg-fz-surface rounded-2xl shadow-xl overflow-hidden">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={action.href}
                onClick={() => handleAction(action.href)}
                className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-fz-surface-high transition-colors ${
                  i > 0 ? "border-t border-fz-border" : ""
                }`}
              >
                <span className="w-9 h-9 rounded-full bg-fz-accent-soft flex items-center justify-center shrink-0">
                  <action.icon size={18} className="text-fz-accent" />
                </span>
                <span className="text-sm font-medium text-fz-text">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-fz-nav-bg border-t border-fz-border z-50 safe-area-pb">
        <div className="flex items-stretch max-w-lg mx-auto">
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <NavItem key={item.href} item={item} active={isActive(item.href)} />
          ))}

          {/* Botón central + — único elemento que usa el acento a pleno color,
              a propósito: es la acción primaria de toda la app (TAREA 7b,
              "acento usado con moderación", no en cada elemento). */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex-1 flex flex-col items-center justify-center py-2"
            aria-label="Acciones rápidas"
          >
            <span
              className={`w-11 h-11 flex items-center justify-center rounded-full shadow-md -mt-4 transition-colors ${
                open ? "bg-fz-text-tertiary text-fz-bg" : "bg-fz-accent text-fz-accent-text"
              }`}
            >
              {open ? <X size={22} /> : <Plus size={22} />}
            </span>
            <span className="text-[10px] text-fz-text-tertiary mt-1">Nuevo</span>
          </button>

          {NAV_ITEMS.slice(2).map((item) => (
            <NavItem key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
      </nav>
    </>
  );
}

function NavItem({
  item,
  active,
}: {
  item: (typeof NAV_ITEMS)[0];
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`flex-1 flex flex-col items-center justify-center py-3 text-[10px] transition-colors ${
        active ? "text-fz-accent font-semibold" : "text-fz-text-tertiary"
      }`}
    >
      <item.icon size={20} className="mb-0.5" strokeWidth={active ? 2.5 : 2} />
      {item.label}
    </Link>
  );
}
