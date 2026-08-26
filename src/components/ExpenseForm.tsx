"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getLeafAccounts } from "@/lib/accounts";
import { formatInputAmount } from "@/lib/format";
import AmountInput from "@/components/AmountInput";
import { createExpense } from "@/app/(main)/gastos/actions";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category, Currency, PaymentMethod, ShareGroupWithMembers } from "@/types";

const NEW_CATEGORY_ICONS = ["🏷️", "🛒", "🚌", "🏠", "💊", "⛽", "🍕", "💡", "🎬", "📱", "💼", "🎁"];
const NEW_CATEGORY_VALUE = "__new__";

interface Props {
  accounts: Account[];
  categories: Category[];
  merchants?: string[];
  redirectTo?: string;
  shareGroups?: ShareGroupWithMembers[];
}

// Agrupa cuentas hoja por la institución raíz (camina parent_id hasta el tope).
function groupByInstitution(
  leafAccounts: Account[],
  allAccounts: Account[]
): { rootId: string; rootName: string; accounts: Account[] }[] {
  const rootOf = (acc: Account): Account => {
    let cur = acc;
    for (let i = 0; i < 10; i++) {
      if (!cur.parent_id) return cur;
      const parent = allAccounts.find((a) => a.id === cur.parent_id);
      if (!parent) return cur;
      cur = parent;
    }
    return cur;
  };

  const groups = new Map<string, { rootId: string; rootName: string; accounts: Account[] }>();
  for (const acc of leafAccounts) {
    const root = rootOf(acc);
    if (!groups.has(root.id)) {
      groups.set(root.id, { rootId: root.id, rootName: root.name, accounts: [] });
    }
    groups.get(root.id)!.accounts.push(acc);
  }
  return Array.from(groups.values()).sort((a, b) =>
    a.rootName.localeCompare(b.rootName)
  );
}

// Deriva el medio de pago a partir del tipo de cuenta.
// type='efectivo' → efectivo, type='credito' → credito, resto → debito.
function derivePaymentMethod(account: Account | undefined): PaymentMethod {
  if (!account) return "efectivo";
  if (account.type === "efectivo") return "efectivo";
  if (account.type === "credito") return "credito";
  return "debito";
}

export default function ExpenseForm({
  accounts,
  categories,
  merchants = [],
  redirectTo = "/gastos",
  shareGroups = [],
}: Props) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [categoryId, setCategoryId] = useState("");
  // Sesión J.1.14, TAREA 7: antes la única forma de agregar una categoría era
  // navegar a /categorias/nueva, perdiendo todo lo ya cargado en este formulario
  // (monto, cuenta, comercio...). Crear la categoría inline, sin salir de acá.
  const [categoriesList, setCategoriesList] = useState<Category[]>(categories);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState(NEW_CATEGORY_ICONS[0]);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);
  const leafAccounts = getLeafAccounts(accounts);
  const [accountId, setAccountId] = useState(leafAccounts[0]?.id ?? "");
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [installmentsTotal, setInstallmentsTotal] = useState(1);
  const [coveringAccountId, setCoveringAccountId] = useState("");
  const [fundingAccountId, setFundingAccountId] = useState("");
  // "now" muestra el selector de cuenta origen; "later" deja funding vacío
  const [fundingTiming, setFundingTiming] = useState<"now" | "later">("later");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TAREA 8 (Sesión J.1.15): gastos compartidos — diseño decidido en Sesión
  // J.1.14. "¿Entre cuántas personas?" cuenta el TOTAL incluyendo al usuario:
  // N personas → N−1 filas de participantes, cada una debe amount/N por
  // default (editable a un monto custom). La parte del usuario nunca se
  // guarda como fila — es implícita (amount del gasto − Σ participantes).
  const [isShared, setIsShared] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [participants, setParticipants] = useState<{ name: string; amount: string }[]>([
    { name: "", amount: "" },
  ]);

  function equalShare(count: number): string {
    const totalNum = parseFloat(amount.replace(",", ".")) || 0;
    if (count <= 0) return "";
    return (Math.round((totalNum / count) * 100) / 100).toString();
  }

  function applyGroup(groupId: string) {
    setSelectedGroupId(groupId);
    if (!groupId) return;
    const group = shareGroups.find((g) => g.id === groupId);
    if (!group || group.members.length === 0) return;
    const n = group.members.length + 1; // + vos
    const share = equalShare(n);
    setSplitCount(n);
    setParticipants(group.members.map((m) => ({ name: m.name, amount: share })));
  }

  function handleSplitCountChange(raw: string) {
    const n = Math.max(2, parseInt(raw) || 2);
    setSplitCount(n);
    setSelectedGroupId("");
    const share = equalShare(n);
    setParticipants((prev) =>
      Array.from({ length: n - 1 }, (_, i) => prev[i] ?? { name: "", amount: share })
    );
  }

  function updateParticipant(i: number, field: "name" | "amount", value: string) {
    setParticipants((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  const selectedAccount = leafAccounts.find((a) => a.id === accountId);
  const paymentMethod = derivePaymentMethod(selectedAccount);
  const isCredito = paymentMethod === "credito";

  // Solo cuentas con earns_yield=true pueden ser destino de cobertura
  const coveringLeafs = leafAccounts.filter((a) => a.earns_yield === true);

  // Cuentas de origen para funding: misma moneda, excluye la cuenta de cobertura
  const fundingLeafs = leafAccounts.filter(
    (a) => a.currency === currency && a.id !== coveringAccountId && a.id !== accountId
  );

  const groups = groupByInstitution(leafAccounts, accounts);

  async function handleCreateCategory() {
    setNewCategoryError(null);
    const name = newCategoryName.trim();
    if (!name) {
      setNewCategoryError("Ingresá un nombre");
      return;
    }
    setCreatingCategory(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setNewCategoryError("Sesión expirada. Recargá la página.");
      setCreatingCategory(false);
      return;
    }
    const { data, error: insertError } = await supabase
      .from("categories")
      .insert({ user_id: user.id, name, icon: newCategoryIcon })
      .select()
      .single();
    setCreatingCategory(false);
    if (insertError || !data) {
      setNewCategoryError(insertError?.message ?? "No se pudo crear la categoría");
      return;
    }
    const newCat = data as Category;
    setCategoriesList((prev) => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryId(newCat.id);
    setShowNewCategory(false);
    setNewCategoryName("");
    setNewCategoryIcon(NEW_CATEGORY_ICONS[0]);
  }

  function handleAccountChange(id: string) {
    setAccountId(id);
    // Al cambiar la cuenta pagadora, resetear cobertura y funding
    setCoveringAccountId("");
    setFundingAccountId("");
    setFundingTiming("later");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(amount.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      setError("Ingresá un monto válido mayor a 0");
      return;
    }

    const selectedAccountObj = accounts.find((a) => a.id === accountId);
    const coveringAccount = accounts.find((a) => a.id === coveringAccountId);

    let sharedParticipants: { name: string; amount: number }[] | undefined;
    if (isShared) {
      const parsedParticipants = participants.map((p) => ({
        name: p.name.trim(),
        amount: parseFloat(p.amount.replace(",", ".")),
      }));
      if (parsedParticipants.some((p) => !p.name || isNaN(p.amount) || p.amount <= 0)) {
        setError("Completá nombre y monto de cada persona (o desmarcá \"¿Es compartido?\").");
        return;
      }
      const sumParticipants = parsedParticipants.reduce((s, p) => s + p.amount, 0);
      if (sumParticipants >= parsed) {
        setError("La suma de lo que deben las otras personas no puede ser mayor o igual al monto total del gasto.");
        return;
      }
      sharedParticipants = parsedParticipants;
    }

    setLoading(true);
    const result = await createExpense({
      amount: parsed,
      currency,
      categoryId: categoryId || null,
      accountId: accountId || null,
      merchant: merchant.trim() || null,
      description: description.trim() || null,
      date,
      paymentMethod,
      installmentsTotal,
      coveringAccountId: coveringAccountId || null,
      fundingAccountId: (isCredito && coveringAccountId && fundingTiming === "now")
        ? fundingAccountId || null
        : null,
      closingDay: selectedAccountObj?.closing_day,
      dueDay: selectedAccountObj?.due_day,
      coveringAccountCurrency: coveringAccount?.currency ?? null,
      participants: sharedParticipants,
    });

    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.push(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Monto + moneda */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
        <div className="flex gap-2">
          <div className="flex gap-1 shrink-0">
            {(["ARS", "USD"] as Currency[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  currency === c
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {c === "ARS" ? "$" : "US$"}
              </button>
            ))}
          </div>
          <div className="flex-1">
            {currency === "ARS" ? (
              <AmountInput
                required
                value={amount}
                onChange={setAmount}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right text-lg font-semibold"
              />
            ) : (
              <input
                type="number"
                inputMode="decimal"
                required
                min="0.01"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right text-lg font-semibold"
              />
            )}
            {amount && currency === "ARS" && (
              <p className="text-[11px] text-gray-400 text-right mt-0.5">
                {formatInputAmount(amount, "ARS")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Cuenta pagadora — interacción primaria */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ¿Con qué cuenta pagás?
        </label>
        <select
          value={accountId}
          onChange={(e) => handleAccountChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        >
          <option value="">Sin cuenta</option>
          {groups.map((group) => {
            // Cuenta raíz que es hoja por sí misma: plain option
            if (group.accounts.length === 1 && !group.accounts[0].parent_id) {
              const acc = group.accounts[0];
              return (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                  {acc.type === "credito" ? " (Crédito)" : ""}
                </option>
              );
            }
            // Institución con bolsillos: optgroup
            return (
              <optgroup key={group.rootId} label={group.rootName}>
                {group.accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                    {acc.type === "credito" ? " (Crédito)" : ""}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {selectedAccount && (
          <p className="text-[11px] text-gray-400 mt-0.5">
            {paymentMethod === "credito"
              ? "Tarjeta de crédito — podés elegir cuotas y cuenta de cobertura."
              : paymentMethod === "efectivo"
              ? "Pago en efectivo — el saldo se descuenta ahora."
              : "Débito / Transferencia — el saldo se descuenta ahora."}
          </p>
        )}
      </div>

      {/* Sección crédito */}
      {isCredito && (
        <div className="space-y-3 bg-gray-50 rounded-xl p-3">
          {/* Cuotas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ¿En cuántas cuotas?
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="48"
              step="1"
              value={installmentsTotal}
              onChange={(e) => setInstallmentsTotal(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-center font-semibold"
            />
            {amount && installmentsTotal > 1 && (
              <p className="text-xs text-gray-400 mt-1 text-center">
                {installmentsTotal} cuotas de{" "}
                {(parseFloat(amount.replace(",", ".")) / installmentsTotal).toLocaleString("es-AR", {
                  style: "currency",
                  currency: currency === "USD" ? "USD" : "ARS",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            )}
          </div>

          {/* Cuenta de cobertura — solo earns_yield=true */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ¿Qué cuenta cubre este pago?{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            {coveringLeafs.length === 0 ? (
              <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Ninguna cuenta está marcada como generadora de rendimiento.{" "}
                <Link href="/cuentas" className="underline">
                  Configuralo en /cuentas
                </Link>{" "}
                para poder destinar plata a una cuenta de cobertura.
              </p>
            ) : (
              <select
                value={coveringAccountId}
                onChange={(e) => {
                  setCoveringAccountId(e.target.value);
                  setFundingAccountId("");
                  setFundingTiming("later");
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">No destinar a ningún fondo</option>
                {coveringLeafs.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Timing de la transferencia — solo cuando hay cobertura */}
          {coveringAccountId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ¿Transferís la plata ahora o después?
              </label>
              <div className="flex gap-2">
                {(["later", "now"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setFundingTiming(t);
                      if (t === "later") setFundingAccountId("");
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      fundingTiming === t
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {t === "now" ? "Ahora" : "Después"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {fundingTiming === "now"
                  ? "La plata se mueve hoy a la cuenta de cobertura."
                  : "Podés confirmarlo más tarde desde Cuotas."}
              </p>

              {/* Selector de cuenta origen — solo cuando "Ahora" */}
              {fundingTiming === "now" && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ¿De qué cuenta sale la plata?
                  </label>
                  {fundingLeafs.length === 0 ? (
                    <p className="text-[11px] text-gray-400">
                      Sin cuentas disponibles en {currency}.
                    </p>
                  ) : (
                    <select
                      value={fundingAccountId}
                      onChange={(e) => setFundingAccountId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    >
                      <option value="">Seleccioná una cuenta</option>
                      {fundingLeafs.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Info cierre/vencimiento */}
          {selectedAccount?.closing_day && selectedAccount?.due_day && (
            <p className="text-[11px] text-indigo-600">
              Cierre día {selectedAccount.closing_day} · Vencimiento día {selectedAccount.due_day} — fechas de cuotas calculadas automáticamente
            </p>
          )}
        </div>
      )}

      {/* Comercio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Comercio{" "}
          <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          list="merchant-list"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="Ej: Carrefour, YPF, Rappi, Farmacity"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900"
        />
        {merchants.length > 0 && (
          <datalist id="merchant-list">
            {merchants.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        )}
      </div>

      {/* Categoría */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
        <select
          value={categoryId}
          onChange={(e) => {
            if (e.target.value === NEW_CATEGORY_VALUE) {
              setShowNewCategory(true);
              return;
            }
            setCategoryId(e.target.value);
          }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900"
        >
          <option value="">Sin categoría</option>
          {categoriesList.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
          <option value={NEW_CATEGORY_VALUE}>+ Crear categoría nueva…</option>
        </select>

        {showNewCategory && (
          <div className="mt-2 border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50">
            <input
              type="text"
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nombre de la categoría"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900"
            />
            <div className="grid grid-cols-8 gap-1">
              {NEW_CATEGORY_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewCategoryIcon(emoji)}
                  className={`text-lg aspect-square flex items-center justify-center rounded-lg transition-colors ${
                    newCategoryIcon === emoji ? "bg-gray-900" : "hover:bg-gray-200"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {newCategoryError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{newCategoryError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowNewCategory(false); setNewCategoryError(null); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-xs text-gray-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={creatingCategory || !newCategoryName.trim()}
                className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium disabled:opacity-40"
              >
                {creatingCategory ? "Creando..." : "Crear y usar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fecha */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900"
        />
      </div>

      {/* Nota */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nota{" "}
          <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Compra semanal"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900"
        />
      </div>

      {/* TAREA 8: gastos compartidos (+ grupos Sesión grupos familiares) */}
      <div className="border-t border-gray-100 pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={isShared}
            onChange={(e) => {
              setIsShared(e.target.checked);
              if (e.target.checked) {
                setSplitCount(2);
                setSelectedGroupId("");
                setParticipants([{ name: "", amount: equalShare(2) }]);
              }
            }}
            className="w-4 h-4"
          />
          ¿Es compartido?
        </label>

        {isShared && (
          <div className="mt-2 space-y-3 bg-gray-50 rounded-xl p-3">
            {shareGroups.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usar un grupo
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => applyGroup(e.target.value)}
                  className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Elegir grupo o cargar a mano…</option>
                  {shareGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {(g.icon ? `${g.icon} ` : "") + g.name} ({g.members.length + 1}{" "}
                      personas c/vos)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Gestioná grupos en{" "}
                  <Link href="/grupos" className="underline text-gray-600">
                    /grupos
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">
                Tip: creá &quot;Familiares&quot; o &quot;Amigos&quot; en{" "}
                <Link href="/grupos" className="underline text-gray-600">
                  Grupos
                </Link>{" "}
                para no tipear nombres cada vez.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ¿Entre cuántas personas? (incluyéndote)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="2"
                step="1"
                value={splitCount}
                onChange={(e) => handleSplitCountChange(e.target.value)}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => updateParticipant(i, "name", e.target.value)}
                    placeholder={`Persona ${i + 1}`}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={p.amount}
                    onChange={(e) => updateParticipant(i, "amount", e.target.value)}
                    placeholder="Monto"
                    className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">
              Vos pagás el total ahora (también si es en cuotas); acá registrás cuánto te
              debe cada persona. Podés cambiar los montos si no fue un reparto igual.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !amount}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {loading ? "Guardando..." : "Guardar gasto"}
      </button>
    </form>
  );
}
