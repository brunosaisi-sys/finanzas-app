"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Receipt,
  Landmark,
  TrendingUp,
  Plus,
  X,
  ArrowLeftRight,
  Wallet,
  CreditCard,
  Target,
  Users,
  HandCoins,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/movimientos", label: "Movs", icon: Receipt },
  { href: "/cuentas", label: "Cuentas", icon: Landmark },
  { href: "/inversiones", label: "Invertir", icon: TrendingUp },
];

const PRIMARY_ACTIONS: {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: "accent" | "neutral";
}[] = [
  {
    href: "/gastos/nuevo",
    label: "Nuevo gasto",
    hint: "Efectivo, débito o cuotas",
    icon: Receipt,
    tone: "accent",
  },
  {
    href: "/ingresos/nuevo",
    label: "Nuevo ingreso",
    hint: "Sueldo, freelance u otro",
    icon: Wallet,
    tone: "neutral",
  },
  {
    href: "/cuentas/transferencia",
    label: "Transferencia",
    hint: "Mover plata entre cuentas",
    icon: ArrowLeftRight,
    tone: "neutral",
  },
];

const SECONDARY_ACTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/cuotas", label: "Cuotas", icon: CreditCard },
  { href: "/objetivos", label: "Metas", icon: Target },
  { href: "/grupos", label: "Grupos", icon: Users },
  { href: "/compartidos", label: "Deudas", icon: HandCoins },
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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 mx-auto w-full max-w-lg rounded-t-[28px] bg-fz-surface px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.18)]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-fz-border" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-display text-xl font-extrabold uppercase tracking-wide text-fz-text">
                  Nuevo
                </p>
                <p className="text-xs text-fz-text-tertiary">Elegí qué querés cargar</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-fz-surface-high text-fz-text-secondary"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              {PRIMARY_ACTIONS.map((action) => (
                <button
                  key={action.href}
                  type="button"
                  onClick={() => handleAction(action.href)}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-fz-surface-high px-4 py-3 text-left"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      action.tone === "accent"
                        ? "bg-fz-accent text-fz-accent-text"
                        : "bg-fz-surface text-fz-accent"
                    }`}
                  >
                    <action.icon size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-fz-text">
                      {action.label}
                    </span>
                    <span className="block text-xs text-fz-text-tertiary">{action.hint}</span>
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-5 mb-2 text-[11px] font-semibold uppercase tracking-wide text-fz-text-tertiary">
              Ir a
            </p>
            <div className="grid grid-cols-4 gap-2">
              {SECONDARY_ACTIONS.map((action) => (
                <button
                  key={action.href}
                  type="button"
                  onClick={() => handleAction(action.href)}
                  className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-fz-surface-high px-1 py-3"
                >
                  <action.icon size={18} className="text-fz-accent" />
                  <span className="text-[11px] font-medium text-fz-text">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-end gap-2">
          <div className="flex min-h-[64px] flex-1 items-stretch rounded-[22px] border border-fz-border bg-fz-nav-bg shadow-[0_8px_28px_rgba(0,0,0,0.12)]">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`mb-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-lg transition-colors ${
              open ? "bg-fz-text text-fz-bg" : "bg-fz-accent text-fz-accent-text"
            }`}
            aria-label={open ? "Cerrar acciones rápidas" : "Acciones rápidas"}
            aria-expanded={open}
          >
            {open ? <X size={24} /> : <Plus size={26} strokeWidth={2.25} />}
          </button>
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
      className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] transition-colors ${
        active ? "font-semibold text-fz-accent" : "text-fz-text-tertiary"
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-xl ${
          active ? "bg-fz-accent-soft" : ""
        }`}
      >
        <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
      </span>
      {item.label}
    </Link>
  );
}
