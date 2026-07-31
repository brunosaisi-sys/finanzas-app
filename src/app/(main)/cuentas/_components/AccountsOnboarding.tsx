"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { INSTITUTIONS, INSTITUTION_GROUPS, CREDIT_CARDS } from "@/lib/institutions";

type BankSub = { pesos: boolean; dolares: boolean; cards: Set<string> };

function emptyBankSub(): BankSub {
  return { pesos: false, dolares: false, cards: new Set() };
}

export default function AccountsOnboarding() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Sub-selección opcional para cada banco seleccionado
  const [bankSubs, setBankSubs] = useState<Map<string, BankSub>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string, group: string) {
    const isRemoving = selected.has(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (isRemoving) next.delete(id);
      else next.add(id);
      return next;
    });
    if (group === "banco") {
      if (isRemoving) {
        setBankSubs((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      } else {
        setBankSubs((prev) => {
          if (!prev.has(id)) {
            const next = new Map(prev);
            next.set(id, emptyBankSub());
            return next;
          }
          return prev;
        });
      }
    }
  }

  function toggleBankSub(bankId: string, field: "pesos" | "dolares" | "card", cardId?: string) {
    setBankSubs((prev) => {
      const next = new Map(prev);
      const sub = next.get(bankId) ?? emptyBankSub();
      if (field === "pesos") {
        next.set(bankId, { ...sub, pesos: !sub.pesos });
      } else if (field === "dolares") {
        next.set(bankId, { ...sub, dolares: !sub.dolares });
      } else if (field === "card" && cardId) {
        const cards = new Set(sub.cards);
        if (cards.has(cardId)) cards.delete(cardId);
        else cards.add(cardId);
        next.set(bankId, { ...sub, cards });
      }
      return next;
    });
  }

  async function handleCreate() {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sesión expirada. Recargá la página."); setLoading(false); return; }

    const selectedInsts = INSTITUTIONS.filter((i) => selected.has(i.id));

    const nonBanks = selectedInsts.filter((i) => i.group !== "banco");
    const simpleBanks = selectedInsts.filter((i) => {
      if (i.group !== "banco") return false;
      const sub = bankSubs.get(i.id);
      return !sub || (!sub.pesos && !sub.dolares && sub.cards.size === 0);
    });
    const configuredBanks = selectedInsts.filter((i) => {
      if (i.group !== "banco") return false;
      const sub = bankSubs.get(i.id);
      return sub && (sub.pesos || sub.dolares || sub.cards.size > 0);
    });

    // 1. Insertar cuentas planas (no-bancos + bancos simples sin sub-cuentas)
    const flatToInsert = [...nonBanks, ...simpleBanks];
    if (flatToInsert.length > 0) {
      const { error: flatError } = await supabase.from("accounts").insert(
        flatToInsert.map((inst) => ({
          user_id: user.id,
          name: inst.name,
          type: inst.dbType,
          currency: inst.defaultCurrency,
          balance: 0,
        }))
      );
      if (flatError) { setError(flatError.message); setLoading(false); return; }
    }

    // 2. Bancos configurados: crear padre primero, luego hijos
    for (const bank of configuredBanks) {
      const { data: parentRow, error: parentError } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          name: bank.name,
          type: bank.dbType,
          currency: bank.defaultCurrency,
          balance: 0,
        })
        .select("id")
        .single();

      if (parentError || !parentRow) {
        setError(parentError?.message ?? "No se pudo crear el banco");
        setLoading(false);
        return;
      }

      const sub = bankSubs.get(bank.id)!;
      const children: Array<{ name: string; type: string; currency: string; balance: number }> = [];
      if (sub.pesos) children.push({ name: "Pesos", type: "banco", currency: "ARS", balance: 0 });
      if (sub.dolares) children.push({ name: "Dólares", type: "banco", currency: "USD", balance: 0 });
      for (const cardId of sub.cards) {
        const card = CREDIT_CARDS.find((c) => c.id === cardId);
        if (card) children.push({ name: card.name, type: "credito", currency: "ARS", balance: 0 });
      }

      const { error: childError } = await supabase.from("accounts").insert(
        children.map((c) => ({ ...c, user_id: user.id, parent_id: parentRow.id }))
      );
      if (childError) { setError(childError.message); setLoading(false); return; }
    }

    setLoading(false);
    router.push("/cuentas");
  }

  const selectedBanks = INSTITUTIONS.filter(
    (i) => i.group === "banco" && selected.has(i.id)
  );

  const totalCount = selected.size;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Seleccioná las cuentas y billeteras que usás. Podés agregar más en cualquier momento.
      </p>

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
                  onClick={() => toggle(inst.id, inst.group)}
                  className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    selected.has(inst.id)
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {inst.name}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {/* Sub-panel por banco seleccionado: sub-cuentas y tarjetas opcionales */}
      {selectedBanks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Configurar bancos <span className="normal-case font-normal">(opcional)</span>
          </h2>
          {selectedBanks.map((bank) => {
            const sub = bankSubs.get(bank.id) ?? emptyBankSub();
            return (
              <div key={bank.id} className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-blue-800">
                  ¿Qué tenés en {bank.name}?
                </p>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[11px] text-blue-700 mb-1.5">Sub-cuentas</p>
                    <div className="flex gap-2">
                      {(["pesos", "dolares"] as const).map((field) => (
                        <button
                          key={field}
                          type="button"
                          onClick={() => toggleBankSub(bank.id, field)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            sub[field]
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
                          }`}
                        >
                          {field === "pesos" ? "Pesos" : "Dólares"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-blue-700 mb-1.5">Tarjetas de crédito</p>
                    <div className="flex gap-2 flex-wrap">
                      {CREDIT_CARDS.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => toggleBankSub(bank.id, "card", card.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            sub.cards.has(card.id)
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
                          }`}
                        >
                          {card.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="space-y-3 pt-2">
        <button
          onClick={handleCreate}
          disabled={totalCount === 0 || loading}
          className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {loading
            ? "Creando..."
            : totalCount > 0
            ? `Agregar ${totalCount} cuenta${totalCount !== 1 ? "s" : ""}`
            : "Seleccioná al menos una"}
        </button>
        <Link
          href="/cuentas/nueva"
          className="block w-full text-center text-sm text-gray-500 hover:text-gray-900 transition-colors py-2"
        >
          O agregar cuenta personalizada →
        </Link>
      </div>
    </div>
  );
}
