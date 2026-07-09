"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { INSTITUTIONS, INSTITUTION_GROUPS, type Institution } from "@/lib/institutions";
import type { AccountType, Currency } from "@/types";

const BOLSILLO_SUGERENCIAS = ["Pesos", "Dólares", "Fondos", "Rendimientos"];

interface ParentAccount {
  id: string;
  name: string;
  type: AccountType;
}

interface Props {
  parent: ParentAccount | null;
}

export default function NuevaCuentaForm({ parent }: Props) {
  if (parent) return <BolsilloForm parent={parent} />;
  return <InstitutionFlow />;
}

function BolsilloForm({ parent }: { parent: ParentAccount }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [balance, setBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesión expirada. Recargá la página.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("accounts").insert({
      user_id: user.id,
      name: label.trim(),
      type: parent.type,
      currency,
      balance: parseFloat(balance) || 0,
      parent_id: parent.id,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/cuentas");
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Link href="/cuentas" className="text-gray-400 hover:text-gray-900 transition-colors">
          ←
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">
          Nuevo bolsillo en {parent.name}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del bolsillo
          </label>
          <input
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej: Pesos, USD guardados, Rendimientos"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {BOLSILLO_SUGERENCIAS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setLabel(s)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
          <div className="flex gap-2">
            {(["ARS", "USD"] as Currency[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  currency === c
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Saldo actual{" "}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !label.trim()}
          className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {loading ? "Guardando..." : "Guardar bolsillo"}
        </button>
      </form>
    </div>
  );
}

type Step = "pick" | "mode" | "form" | "bolsillos";

interface BolsilloDraft {
  label: string;
  currency: Currency;
  balance: string;
}

function InstitutionFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pick");
  const [selected, setSelected] = useState<Institution | null>(null);
  const [isCustom, setIsCustom] = useState(false);

  // Cuenta simple
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [type, setType] = useState<AccountType>("banco");

  // Con bolsillos
  const [containerName, setContainerName] = useState("");
  const [bolsillos, setBolsillos] = useState<BolsilloDraft[]>([
    { label: "", currency: "ARS", balance: "" },
  ]);

  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickInstitution(inst: Institution) {
    setSelected(inst);
    setIsCustom(false);
    setName(inst.name);
    setContainerName(inst.name);
    setCurrency(inst.defaultCurrency);
    setType(inst.dbType);
    setBolsillos([{ label: "", currency: inst.defaultCurrency, balance: "" }]);
    setStep("mode");
  }

  function pickCustom() {
    setSelected(null);
    setIsCustom(true);
    setName("");
    setContainerName("");
    setCurrency("ARS");
    setType("banco");
    setBolsillos([{ label: "", currency: "ARS", balance: "" }]);
    setStep("mode");
  }

  function addBolsillo() {
    setBolsillos((prev) => [...prev, { label: "", currency, balance: "" }]);
  }

  function removeBolsillo(i: number) {
    setBolsillos((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateBolsillo(i: number, patch: Partial<BolsilloDraft>) {
    setBolsillos((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  async function handleSubmitSimple(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesión expirada. Recargá la página.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("accounts").insert({
      user_id: user.id,
      name: name.trim(),
      type,
      currency,
      balance: parseFloat(balance) || 0,
      ...(type === "credito" && closingDay ? { closing_day: parseInt(closingDay) } : {}),
      ...(type === "credito" && dueDay ? { due_day: parseInt(dueDay) } : {}),
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/cuentas");
  }

  async function handleSubmitBolsillos() {
    setError(null);
    const validBolsillos = bolsillos.filter((b) => b.label.trim());
    if (!containerName.trim()) {
      setError("Ingresá un nombre para la cuenta");
      return;
    }
    if (validBolsillos.length === 0) {
      setError("Agregá al menos un bolsillo");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesión expirada. Recargá la página.");
      setLoading(false);
      return;
    }

    const { data: parentRow, error: parentError } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        name: containerName.trim(),
        type,
        currency,
        balance: 0,
      })
      .select("id")
      .single();

    if (parentError || !parentRow) {
      setLoading(false);
      setError(parentError?.message ?? "No se pudo crear la cuenta");
      return;
    }

    const { error: childrenError } = await supabase.from("accounts").insert(
      validBolsillos.map((b) => ({
        user_id: user.id,
        name: b.label.trim(),
        type,
        currency: b.currency,
        balance: parseFloat(b.balance) || 0,
        parent_id: parentRow.id,
      }))
    );

    setLoading(false);
    if (childrenError) {
      setError(childrenError.message);
      return;
    }
    router.push("/cuentas");
  }

  if (step === "mode") {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 pt-2 mb-6">
          <button
            onClick={() => setStep("pick")}
            className="text-gray-400 hover:text-gray-900 transition-colors"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            {isCustom ? "Cuenta personalizada" : selected?.name}
          </h1>
        </div>

        <p className="text-sm text-gray-500 mb-4">¿Cómo querés llevar esta cuenta?</p>

        <div className="space-y-3">
          <button
            onClick={() => setStep("form")}
            className="w-full text-left px-4 py-4 rounded-xl border border-gray-200 bg-white hover:border-gray-900 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900">Cuenta simple</p>
            <p className="text-xs text-gray-400 mt-0.5">Un solo saldo en una moneda</p>
          </button>
          <button
            onClick={() => setStep("bolsillos")}
            className="w-full text-left px-4 py-4 rounded-xl border border-gray-200 bg-white hover:border-gray-900 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900">Con bolsillos</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Pesos, dólares, fondos, etc. por separado
            </p>
          </button>
        </div>
      </div>
    );
  }

  if (step === "bolsillos") {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 pt-2 mb-6">
          <button
            onClick={() => setStep("mode")}
            className="text-gray-400 hover:text-gray-900 transition-colors"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Bolsillos</h1>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la cuenta
            </label>
            <input
              type="text"
              required
              value={containerName}
              onChange={(e) => setContainerName(e.target.value)}
              placeholder="Ej: Cocos Capital"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div className="space-y-3">
            {bolsillos.map((b, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={b.label}
                    onChange={(e) => updateBolsillo(i, { label: e.target.value })}
                    placeholder="Ej: Pesos"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  {bolsillos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBolsillo(i)}
                      className="text-gray-400 hover:text-red-600 text-sm px-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BOLSILLO_SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateBolsillo(i, { label: s })}
                      className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="flex gap-1 shrink-0">
                    {(["ARS", "USD"] as Currency[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateBolsillo(i, { currency: c })}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          b.currency === c
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={b.balance}
                    onChange={(e) => updateBolsillo(i, { balance: e.target.value })}
                    placeholder="Saldo (opcional)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addBolsillo}
            className="w-full text-center px-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-600 hover:text-gray-700 transition-colors"
          >
            + Agregar otro bolsillo
          </button>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSubmitBolsillos}
            disabled={loading || !containerName.trim()}
            className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {loading ? "Guardando..." : "Guardar cuenta"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 pt-2 mb-6">
          <button
            onClick={() => setStep("mode")}
            className="text-gray-400 hover:text-gray-900 transition-colors"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            {isCustom ? "Cuenta personalizada" : selected?.name}
          </h1>
        </div>

        <form onSubmit={handleSubmitSimple} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la cuenta
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Banco Galicia"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {isCustom && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="banco">Banco / Billetera</option>
                <option value="efectivo">Efectivo</option>
                <option value="inversion">Inversión</option>
                <option value="usd_reserva">Reserva USD</option>
                <option value="credito">Tarjeta de crédito</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <div className="flex gap-2">
              {(["ARS", "USD"] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    currency === c
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Saldo actual{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {type === "credito" && (
            <div className="space-y-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700">Datos del resumen de tarjeta</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Día de cierre
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="28"
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    placeholder="Ej: 20"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Día de vencimiento
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="28"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    placeholder="Ej: 10"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-center"
                  />
                </div>
              </div>
              <p className="text-[11px] text-blue-600">
                Si el gasto es antes del día de cierre, la cuota 1 vence el mes siguiente al cierre.
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {loading ? "Guardando..." : "Guardar cuenta"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/cuentas" className="text-gray-400 hover:text-gray-900 transition-colors">
          ←
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Nueva cuenta</h1>
      </div>

      {INSTITUTION_GROUPS.map((group) => {
        const items = INSTITUTIONS.filter((i) => i.group === group.key);
        return (
          <section key={group.key}>
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              {group.label}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {items.map((inst) => (
                <button
                  key={inst.id}
                  onClick={() => pickInstitution(inst)}
                  className="text-left px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-gray-900 hover:bg-gray-50 transition-colors"
                >
                  {inst.name}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <section>
        <button
          onClick={pickCustom}
          className="w-full text-left px-4 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-600 hover:text-gray-700 transition-colors"
        >
          + Cuenta personalizada
        </button>
      </section>
    </div>
  );
}
