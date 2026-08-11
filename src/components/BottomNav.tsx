"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Receipt, Landmark, Target, Plus, X, ArrowLeftRight, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Sesión J.1.15, TAREA 7a: emoji reemplazados por lucide-react — el set de
// iconos elegido para todo el "chrome" de la app (nunca para contenido elegido
// por el usuario, como el ícono de una categoría). Ver "Sistema de diseño" en
// CLAUDE.md.
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/movimientos", label: "Movimientos", icon: Receipt },
  { href: "/cuentas", label: "Cuentas", icon: Landmark },
  { href: "/objetivos", label: "Metas", icon: Target },
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
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={action.href}
                onClick={() => handleAction(action.href)}
                className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <span className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <action.icon size={18} className="text-indigo-600" />
                </span>
                <span className="text-sm font-medium text-gray-900">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb">
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
              className={`w-11 h-11 flex items-center justify-center rounded-full text-white shadow-md -mt-4 transition-colors ${
                open ? "bg-gray-600" : "bg-indigo-600"
              }`}
            >
              {open ? <X size={22} /> : <Plus size={22} />}
            </span>
            <span className="text-[10px] text-gray-400 mt-1">Nuevo</span>
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
        active ? "text-indigo-600 font-semibold" : "text-gray-400"
      }`}
    >
      <item.icon size={20} className="mb-0.5" strokeWidth={active ? 2.5 : 2} />
      {item.label}
    </Link>
  );
}
