"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { seedDemoData } from "./actions";

export default function SeedDemoPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSeed() {
    setStatus("loading");
    setMessage(null);
    const result = await seedDemoData();
    if ("error" in result) {
      setStatus("error");
      setMessage(result.error);
      return;
    }
    setStatus("ok");
    setMessage(result.summary);
    router.refresh();
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-28 bg-fz-bg min-h-screen">
      <div className="pt-2">
        <h1 className="font-display font-extrabold text-2xl text-fz-text uppercase tracking-wide">
          Datos de demo
        </h1>
        <p className="text-sm text-fz-text-secondary mt-2">
          Carga en <strong>tu cuenta</strong> un set completo para explorar la app:
          bancos, tarjetas, cuotas, gastos, ingresos, inversiones, bienes, metas y
          gastos compartidos.
        </p>
      </div>

      <div className="bg-fz-surface border border-fz-border rounded-2xl p-4 space-y-3 text-sm text-fz-text-secondary">
        <p>Incluye, entre otras cosas:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>BBVA, Galicia, Cocos Capital, Mercado Pago, efectivo y USD</li>
          <li>Visa y Mastercard con varias compras en cuotas</li>
          <li>CEDEARs (AAPL, SPY, MELI, KO), bono AL30 y un FCI</li>
          <li>Auto, celular, heladera y notebook</li>
          <li>4 metas de ahorro con aportes</li>
          <li>Un gasto compartido pendiente de cobro</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={handleSeed}
        disabled={status === "loading" || status === "ok"}
        className="w-full min-h-[48px] rounded-2xl bg-fz-accent text-fz-accent-text font-semibold disabled:opacity-60"
      >
        {status === "loading"
          ? "Cargando…"
          : status === "ok"
            ? "Listo"
            : "Cargar datos de demo"}
      </button>

      {status === "ok" && (
        <div className="bg-fz-accent-soft rounded-xl px-4 py-3 text-sm text-fz-text space-y-2">
          <p className="font-medium">Listo. Ya podés recorrer la app.</p>
          <p className="text-xs text-fz-text-secondary">{message}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/" className="text-fz-accent font-medium">
              Inicio →
            </Link>
            <Link href="/inversiones" className="text-fz-accent font-medium">
              Inversiones →
            </Link>
            <Link href="/cuotas" className="text-fz-accent font-medium">
              Cuotas →
            </Link>
            <Link href="/objetivos" className="text-fz-accent font-medium">
              Metas →
            </Link>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="bg-fz-negative-soft rounded-xl px-4 py-3 text-sm text-fz-negative">
          {message}
        </div>
      )}

      <p className="text-xs text-fz-text-tertiary">
        Pantalla temporal solo para probar. Podés volver a apretar el botón y se
        sumarán más gastos/ingresos encima de lo que ya haya.
      </p>
    </div>
  );
}
