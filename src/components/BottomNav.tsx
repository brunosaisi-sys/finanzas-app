"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/movimientos", label: "Movimientos", icon: "📋" },
  { href: "/cuentas", label: "Cuentas", icon: "🏦" },
  { href: "/objetivos", label: "Metas", icon: "🎯" },
];

const QUICK_ACTIONS = [
  { href: "/gastos/nuevo", label: "Nuevo gasto", icon: "💸" },
  { href: "/ingresos/nuevo", label: "Nuevo ingreso", icon: "💰" },
  { href: "/cuentas/transferencia", label: "Transferencia", icon: "🔄" },
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
                <span className="text-2xl">{action.icon}</span>
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

          {/* Botón central + */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex-1 flex flex-col items-center justify-center py-2"
            aria-label="Acciones rápidas"
          >
            <span
              className={`w-11 h-11 flex items-center justify-center rounded-full text-white text-2xl font-light shadow-md -mt-4 transition-colors ${
                open ? "bg-gray-600" : "bg-gray-900"
              }`}
            >
              {open ? "✕" : "+"}
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
        active ? "text-gray-900 font-semibold" : "text-gray-400"
      }`}
    >
      <span className="text-xl mb-0.5">{item.icon}</span>
      {item.label}
    </Link>
  );
}
