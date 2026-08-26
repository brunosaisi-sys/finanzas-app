"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createShareGroup(input: {
  name: string;
  icon: string | null;
  members: string[];
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const name = input.name.trim();
  if (!name) return { error: "Poné un nombre al grupo" };

  const members = input.members.map((m) => m.trim()).filter((m) => m.length > 0);
  if (members.length === 0) {
    return { error: "Agregá al menos una persona (además de vos)" };
  }

  const { data: group, error } = await supabase
    .from("share_groups")
    .insert({
      user_id: user.id,
      name,
      icon: input.icon,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("share_groups") || error.code === "42P01") {
      return {
        error:
          "Falta la migración 030 en Supabase. Pedile a quien administre la base que ejecute supabase/migrations/030_share_groups.sql",
      };
    }
    return { error: error.message };
  }

  const { error: memErr } = await supabase.from("share_group_members").insert(
    members.map((m) => ({ group_id: group.id, name: m }))
  );
  if (memErr) return { error: memErr.message };

  revalidatePath("/grupos");
  revalidatePath("/compartidos");
  revalidatePath("/gastos/nuevo");
  return { id: group.id };
}

export async function updateShareGroup(input: {
  groupId: string;
  name: string;
  icon: string | null;
  members: string[];
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const name = input.name.trim();
  if (!name) return { error: "Poné un nombre al grupo" };

  const members = input.members.map((m) => m.trim()).filter((m) => m.length > 0);
  if (members.length === 0) {
    return { error: "Agregá al menos una persona (además de vos)" };
  }

  const { error } = await supabase
    .from("share_groups")
    .update({ name, icon: input.icon })
    .eq("id", input.groupId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  // Reemplazo total de miembros (simple, single-user, sin concurrencia)
  const { error: delErr } = await supabase
    .from("share_group_members")
    .delete()
    .eq("group_id", input.groupId);
  if (delErr) return { error: delErr.message };

  const { error: insErr } = await supabase.from("share_group_members").insert(
    members.map((m) => ({ group_id: input.groupId, name: m }))
  );
  if (insErr) return { error: insErr.message };

  revalidatePath("/grupos");
  revalidatePath("/compartidos");
  revalidatePath("/gastos/nuevo");
  return {};
}

export async function deleteShareGroup(
  groupId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("share_groups")
    .delete()
    .eq("id", groupId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/grupos");
  revalidatePath("/compartidos");
  revalidatePath("/gastos/nuevo");
  return {};
}

/** Crea los 3 grupos tipicos si el usuario no tiene ninguno. */
export async function seedDefaultShareGroups(): Promise<
  { ok: true; count: number } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: existing, error: listErr } = await supabase
    .from("share_groups")
    .select("id")
    .limit(1);
  if (listErr) {
    if (listErr.message.includes("share_groups") || listErr.code === "42P01") {
      return {
        error:
          "Falta la migración 030 en Supabase. Ejecutá supabase/migrations/030_share_groups.sql en el SQL Editor.",
      };
    }
    return { error: listErr.message };
  }
  if ((existing ?? []).length > 0) {
    return { ok: true, count: 0 };
  }

  const defaults: { name: string; icon: string; members: string[] }[] = [
    {
      name: "Familiares",
      icon: "👨‍👩‍👧‍👦",
      members: ["Mamá", "Papá", "Hermana", "Cuñado"],
    },
    {
      name: "Amigos",
      icon: "🍻",
      members: ["Martín", "Lucía", "Sofía"],
    },
    {
      name: "Trabajo",
      icon: "💼",
      members: ["Ana", "Diego"],
    },
  ];

  for (const g of defaults) {
    const result = await createShareGroup(g);
    if ("error" in result) return { error: result.error };
  }

  return { ok: true, count: defaults.length };
}
