"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/gastos", label: "Gastos", icon: "💸" },
  { href: "/cuentas", label: "Cuentas", icon: "🏦" },
  { href: "/bienes", label: "Bienes", icon: "🏡" },
];

export default function BottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb">
      <div className="flex items-stretch max-w-lg mx-auto">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <NavItem key={item.href} item={item} active={isActive(item.href)} />
        ))}

        {/* Botón central + */}
        <Link
          href="/nuevo-gasto"
          className="flex-1 flex flex-col items-center justify-center py-2"
          aria-label="Nuevo gasto"
        >
          <span className="w-11 h-11 flex items-center justify-center bg-gray-900 rounded-full text-white text-2xl font-light shadow-md -mt-4">
            +
          </span>
          <span className="text-[10px] text-gray-400 mt-1">Nuevo</span>
        </Link>

        {NAV_ITEMS.slice(2).map((item) => (
          <NavItem key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>
    </nav>
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
