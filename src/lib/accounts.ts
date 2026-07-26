interface AccountLike {
  id: string;
  name: string;
  parent_id: string | null;
}

// Las cuentas "contenedor" (con bolsillos) no guardan saldo propio; no deben
// aparecer como destino de un gasto o inversión, solo sus bolsillos (hojas).
// Correcto para árbol de N niveles: un nodo es hoja si ningún otro lo usa como parent_id.
export function getLeafAccounts<T extends AccountLike>(accounts: T[]): T[] {
  const parentIds = new Set(
    accounts.filter((a) => a.parent_id).map((a) => a.parent_id as string)
  );
  return accounts.filter((a) => !parentIds.has(a.id));
}

// Construye el nombre completo caminando la cadena de ancestros hacia la raíz.
// Para un nodo sin padres: "Nombre". Para un bolsillo: "Institución — Cuenta — Subcuenta".
export function accountDisplayName<T extends AccountLike>(
  account: T,
  accounts: T[]
): string {
  const parts: string[] = [account.name];
  let current: T = account;
  while (current.parent_id) {
    const parent = accounts.find((a) => a.id === current.parent_id);
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  if (parts.length === 1) return parts[0];
  return parts.join(" — ");
}
