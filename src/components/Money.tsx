"use client";

import { useSyncExternalStore, type ReactNode } from "react";

// TAREA 1d (Sesión J.1.16): "ocultar saldos" global, persistido en
// localStorage (preferencia de UI, no dato de negocio — mismo criterio ya
// usado para el tema). No requiere un Context Provider: cualquier componente
// cliente en cualquier pantalla puede usar `<Money>` o `useHideBalances()`
// directamente y quedan sincronizados entre sí vía un evento custom (mismo
// tab) + el evento `storage` (otras tabs/pestañas). `useSyncExternalStore`
// evita mismatches de hidratación: el snapshot de servidor siempre es
// `false` (nunca se ocultan saldos en el HTML inicial), y el valor real de
// localStorage se aplica recién en el cliente tras montar.
const KEY = "finanzas:hideBalances";
const EVENT = "finanzas:hideBalances:change";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot() {
  return localStorage.getItem(KEY) === "1";
}

function getServerSnapshot() {
  return false;
}

export function useHideBalances(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setHideBalances(hide: boolean) {
  localStorage.setItem(KEY, hide ? "1" : "0");
  window.dispatchEvent(new Event(EVENT));
}

/** Envuelve un monto ya formateado — lo reemplaza por "••••" si el usuario activó "ocultar saldos". */
export function Money({ children }: { children: ReactNode }) {
  const hide = useHideBalances();
  return <>{hide ? "••••" : children}</>;
}
