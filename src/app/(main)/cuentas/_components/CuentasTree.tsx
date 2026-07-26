"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import CuentaActions from "./CuentaActions";
import { convertAccountToParent, createChildAccount } from "../actions";
import type { AccountType, Currency } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccountNode {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: number;
  parent_id: string | null;
  earmarksTotal: number;
  earmarksCuotas: number;
  earmarksMetas: number;
  // true si tiene gastos o earmarks activos (bloquea cambio de tipo)
  hasExpenseDeps: boolean;
}

interface Props {
  accounts: AccountNode[];
}

// ─── Tree computation helpers ─────────────────────────────────────────────────

function buildChildrenMap(accounts: AccountNode[]): Map<string, AccountNode[]> {
  const map = new Map<string, AccountNode[]>();
  for (const a of accounts) {
    if (a.parent_id) {
      const arr = map.get(a.parent_id) ?? [];
      arr.push(a);
      map.set(a.parent_id, arr);
    }
  }
  return map;
}

// Suma todos los balances de descendientes hoja (excluyendo crédito de los totales).
function getConsolidatedTotals(
  nodeId: string,
  childrenMap: Map<string, AccountNode[]>,
  accountMap: Map<string, AccountNode>
): Map<string, number> {
  const children = childrenMap.get(nodeId) ?? [];
  if (children.length === 0) {
    const acct = accountMap.get(nodeId);
    if (!acct) return new Map();
    return new Map([[acct.currency, acct.balance]]);
  }
  const totals = new Map<string, number>();
  for (const child of children) {
    if (child.type === "credito") continue;
    const childTotals = getConsolidatedTotals(child.id, childrenMap, accountMap);
    for (const [cur, amt] of childTotals) {
      totals.set(cur, (totals.get(cur) ?? 0) + amt);
    }
  }
  return totals;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DiscriminatedBalance({
  balance,
  currency,
  earmarksTotal,
  earmarksCuotas,
  earmarksMetas,
}: {
  balance: number;
  currency: Currency;
  earmarksTotal: number;
  earmarksCuotas: number;
  earmarksMetas: number;
}) {
  if (earmarksTotal === 0) {
    return (
      <p className="text-sm text-gray-600 tabular-nums">
        {formatCurrency(balance, currency)}
      </p>
    );
  }
  const libre = balance - earmarksTotal;
  return (
    <div className="text-right space-y-0.5">
      <p className="text-xs text-gray-400 tabular-nums">
        Total: {formatCurrency(balance, currency)}
      </p>
      {earmarksCuotas > 0 && (
        <p className="text-[10px] text-amber-600 tabular-nums">
          Cuotas: −{formatCurrency(earmarksCuotas, currency)}
        </p>
      )}
      {earmarksMetas > 0 && (
        <p className="text-[10px] text-blue-600 tabular-nums">
          Metas: −{formatCurrency(earmarksMetas, currency)}
        </p>
      )}
      <p className="text-sm font-semibold text-gray-900 tabular-nums">
        Libre: {formatCurrency(libre, currency)}
      </p>
    </div>
  );
}

// ─── AddChildInline ───────────────────────────────────────────────────────────
// Patrón inline unificado para agregar subdivisiones a cualquier nivel.
// Si la cuenta aún no tiene hijos: llama a convertAccountToParent (RPC atómica).
// Si ya tiene hijos: llama a createChildAccount (INSERT directo).

function AddChildInline({
  parentId,
  parentCurrency,
  parentBalance,
  hasChildren,
  onSuccess,
}: {
  parentId: string;
  parentCurrency: Currency;
  parentBalance: number;
  hasChildren: boolean;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [childName, setChildName] = useState("");
  const [currency, setCurrency] = useState<Currency>(parentCurrency);
  const [balance, setBalance] = useState(
    !hasChildren && parentBalance > 0 ? String(parentBalance) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setChildName("");
    setCurrency(parentCurrency);
    setBalance(!hasChildren && parentBalance > 0 ? String(parentBalance) : "");
    setError(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-gray-500 hover:text-indigo-600 border border-dashed border-gray-200 rounded-lg px-2.5 py-1 transition-colors w-full text-center mt-2"
      >
        + Agregar subdivisión
      </button>
    );
  }

  return (
    <div className="mt-2 p-3 border border-indigo-100 bg-indigo-50 rounded-xl space-y-2">
      {!hasChildren && parentBalance > 0 && (
        <p className="text-[10px] text-indigo-700 leading-snug">
          ⚠ Tu saldo de {formatCurrency(parentBalance, parentCurrency)} se moverá
          a este bolsillo. Los gastos y reservas existentes también se reasignarán.
        </p>
      )}
      <input
        type="text"
        autoFocus
        value={childName}
        onChange={(e) => setChildName(e.target.value)}
        placeholder="Nombre del bolsillo"
        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
      />
      <div className="flex items-center gap-1.5">
        {(["ARS", "USD"] as Currency[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCurrency(c)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
              currency === c
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
            }`}
          >
            {c}
          </button>
        ))}
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="Saldo (opcional)"
          className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving || !childName.trim()}
          onClick={async () => {
            setSaving(true);
            setError(null);
            let result: { error?: string };
            if (!hasChildren) {
              result = await convertAccountToParent(parentId, childName.trim());
            } else {
              result = await createChildAccount(parentId, {
                name: childName.trim(),
                currency,
                balance: parseFloat(balance) || 0,
              });
            }
            if (result.error) {
              setError(result.error);
              setSaving(false);
            } else {
              reset();
              onSuccess();
            }
          }}
          className="text-[11px] font-medium text-indigo-600 disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="text-[11px] text-gray-400"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

// ─── TreeNode ─────────────────────────────────────────────────────────────────
// Renderiza un nodo del árbol y sus hijos de forma recursiva.

function TreeNode({
  account,
  depth,
  childrenMap,
  accountMap,
  expandedIds,
  onToggle,
  onRefresh,
}: {
  account: AccountNode;
  depth: number; // 0 = institución, 1 = cuenta, 2 = subcuenta
  childrenMap: Map<string, AccountNode[]>;
  accountMap: Map<string, AccountNode>;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const allChildren = childrenMap.get(account.id) ?? [];
  const bolsilloChildren = allChildren.filter((c) => c.type !== "credito");
  const creditChildren = allChildren.filter((c) => c.type === "credito");
  const hasChildren = allChildren.length > 0;
  const isExpanded = expandedIds.has(account.id);
  const isChild = account.parent_id !== null;
  const canChangeType = !account.hasExpenseDeps && !isChild;

  // Can this account have more subdivisions?
  // credito accounts can't have children; all others can
  const canHaveChildren = account.type !== "credito";

  if (hasChildren) {
    // Container node with children
    const consolidatedTotals = getConsolidatedTotals(
      account.id,
      childrenMap,
      accountMap
    );

    const indent = depth * 16;
    const headerBg =
      depth === 0 ? "bg-gray-50" : depth === 1 ? "bg-gray-50/60" : "bg-white";

    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Node header */}
        <div
          className={`flex items-start gap-3 px-4 py-3 ${headerBg}`}
          style={{ paddingLeft: `${16 + indent}px` }}
        >
          <button
            type="button"
            onClick={() => onToggle(account.id)}
            className="mt-0.5 text-gray-400 hover:text-gray-700 shrink-0 transition-colors"
            aria-label={isExpanded ? "Colapsar" : "Expandir"}
          >
            <span className="text-xs">{isExpanded ? "▾" : "▸"}</span>
          </button>
          <div className="flex-1 min-w-0">
            <p
              className={`font-semibold text-gray-900 ${
                depth === 0 ? "text-sm" : "text-xs"
              }`}
            >
              {account.name}
            </p>
            <CuentaActions
              accountId={account.id}
              accountName={account.name}
              accountType={account.type}
              currentBalance={account.balance}
              currency={account.currency}
              canChangeType={canChangeType}
              isChild={isChild}
            />
          </div>
          <div className="text-right shrink-0">
            {Array.from(consolidatedTotals.entries()).map(([cur, total]) => (
              <p
                key={cur}
                className="text-xs font-medium text-gray-600 tabular-nums"
              >
                {formatCurrency(total, cur as Currency)}
              </p>
            ))}
            {consolidatedTotals.size === 0 && (
              <p className="text-xs text-gray-400">—</p>
            )}
          </div>
        </div>

        {/* Children */}
        {isExpanded && (
          <>
            {bolsilloChildren.map((child) => (
              <div
                key={child.id}
                className="border-t border-gray-100"
                style={{ paddingLeft: `${indent}px` }}
              >
                <TreeNode
                  account={child}
                  depth={depth + 1}
                  childrenMap={childrenMap}
                  accountMap={accountMap}
                  expandedIds={expandedIds}
                  onToggle={onToggle}
                  onRefresh={onRefresh}
                />
              </div>
            ))}

            {/* Credit card children */}
            {creditChildren.length > 0 && (
              <>
                <div className="px-4 pt-2 pb-1 border-t border-gray-100">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                    Tarjetas de crédito
                  </p>
                </div>
                {creditChildren.map((card) => (
                  <div key={card.id} className="border-t border-gray-100">
                    <TreeNode
                      account={card}
                      depth={depth + 1}
                      childrenMap={childrenMap}
                      accountMap={accountMap}
                      expandedIds={expandedIds}
                      onToggle={onToggle}
                      onRefresh={onRefresh}
                    />
                  </div>
                ))}
              </>
            )}

            {/* Add subdivision inline */}
            {canHaveChildren && (
              <div className="px-4 pb-3 border-t border-gray-50">
                <AddChildInline
                  parentId={account.id}
                  parentCurrency={account.currency}
                  parentBalance={account.balance}
                  hasChildren={hasChildren}
                  onSuccess={() => {
                    onRefresh();
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Leaf node (no children)
  const indent = depth * 16;
  const isTopLevel = depth === 0;

  if (isTopLevel) {
    // Top-level leaf: rendered as a card
    return (
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-start justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">{account.name}</p>
            {account.type === "credito" && (
              <span className="text-[10px] text-gray-400">Deuda</span>
            )}
            <CuentaActions
              accountId={account.id}
              accountName={account.name}
              accountType={account.type}
              currentBalance={account.balance}
              currency={account.currency}
              canChangeType={canChangeType}
              isChild={isChild}
            />
          </div>
          <DiscriminatedBalance
            balance={account.balance}
            currency={account.currency}
            earmarksTotal={account.earmarksTotal}
            earmarksCuotas={account.earmarksCuotas}
            earmarksMetas={account.earmarksMetas}
          />
        </div>
        {canHaveChildren && (
          <div className="px-4 pb-3 border-t border-gray-50">
            <AddChildInline
              parentId={account.id}
              parentCurrency={account.currency}
              parentBalance={account.balance}
              hasChildren={false}
              onSuccess={() => onRefresh()}
            />
          </div>
        )}
      </div>
    );
  }

  // Non-top-level leaf: rendered as a row
  return (
    <div
      className="flex items-start justify-between py-2.5 px-4"
      style={{ paddingLeft: `${16 + indent}px` }}
    >
      <div className="min-w-0">
        <p
          className={`text-gray-700 ${
            depth === 1 ? "text-sm" : "text-xs"
          }`}
        >
          {account.name}
          {account.type === "credito" && (
            <span className="ml-1 text-[10px] text-gray-400">(Deuda)</span>
          )}
        </p>
        <CuentaActions
          accountId={account.id}
          accountName={account.name}
          accountType={account.type}
          currentBalance={account.balance}
          currency={account.currency}
          canChangeType={canChangeType}
          isChild={isChild}
        />
        {canHaveChildren && (
          <AddChildInline
            parentId={account.id}
            parentCurrency={account.currency}
            parentBalance={account.balance}
            hasChildren={false}
            onSuccess={() => onRefresh()}
          />
        )}
      </div>
      <DiscriminatedBalance
        balance={account.balance}
        currency={account.currency}
        earmarksTotal={account.earmarksTotal}
        earmarksCuotas={account.earmarksCuotas}
        earmarksMetas={account.earmarksMetas}
      />
    </div>
  );
}

// ─── CuentasTree (main export) ────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  banco: "Bancos y billeteras",
  efectivo: "Efectivo",
  inversion: "Inversiones",
  usd_reserva: "Dólares / Reservas USD",
};
const TYPE_ORDER = ["banco", "efectivo", "inversion", "usd_reserva"];

export default function CuentasTree({ accounts }: Props) {
  const router = useRouter();

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const childrenMap = buildChildrenMap(accounts);

  // All node IDs expanded by default
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(accounts.map((a) => a.id))
  );

  // When accounts prop changes (e.g. after router.refresh()), expand any newly added accounts.
  // This ensures containers created mid-session (convertAccountToParent) are visible immediately.
  useEffect(() => {
    setExpandedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const a of accounts) {
        if (!next.has(a.id)) {
          next.add(a.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [accounts]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleRefresh() {
    router.refresh();
  }

  // Root accounts (no parent_id)
  const roots = accounts.filter((a) => !a.parent_id);

  // Group roots by type; credit card roots (orphan) are in their own section
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: roots.filter((a) => a.type === type),
  })).filter((g) => g.items.length > 0);

  const orphanCreditCards = roots.filter((a) => a.type === "credito");

  return (
    <div className="space-y-6">
      {grouped.map(({ type, label, items }) => (
        <section key={type}>
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            {label}
          </h2>
          <div className="space-y-3">
            {items.map((account) => (
              <TreeNode
                key={account.id}
                account={account}
                depth={0}
                childrenMap={childrenMap}
                accountMap={accountMap}
                expandedIds={expandedIds}
                onToggle={toggleExpand}
                onRefresh={handleRefresh}
              />
            ))}
          </div>
        </section>
      ))}

      {orphanCreditCards.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Tarjetas de crédito
          </h2>
          <div className="space-y-3">
            {orphanCreditCards.map((card) => (
              <TreeNode
                key={card.id}
                account={card}
                depth={0}
                childrenMap={childrenMap}
                accountMap={accountMap}
                expandedIds={expandedIds}
                onToggle={toggleExpand}
                onRefresh={handleRefresh}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
