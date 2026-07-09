interface AccountLike {
  id: string;
  name: string;
  parent_id: string | null;
}

// Las cuentas "contenedor" (con bolsillos) no guardan saldo propio; no deben
// aparecer como destino de un gasto o inversión, solo sus bolsillos (hojas).
export function getLeafAccounts<T extends AccountLike>(accounts: T[]): T[] {
  const parentIds = new Set(
    accounts.filter((a) => a.parent_id).map((a) => a.parent_id as string)
  );
  return accounts.filter((a) => !parentIds.has(a.id));
}

export function accountDisplayName<T extends AccountLike>(
  account: T,
  accounts: T[]
): string {
  if (!account.parent_id) return account.name;
  const parent = accounts.find((a) => a.id === account.parent_id);
  return parent ? `${parent.name} — ${account.name}` : account.name;
}
