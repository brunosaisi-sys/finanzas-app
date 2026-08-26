import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import GruposClient from "./_components/GruposClient";
import type { ShareGroup, ShareGroupMember, ShareGroupWithMembers } from "@/types";

export default async function GruposPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let groups: ShareGroupWithMembers[] = [];
  let migrationMissing = false;

  const { data: groupsData, error: groupsError } = await supabase
    .from("share_groups")
    .select("*")
    .order("created_at");

  if (groupsError) {
    migrationMissing =
      groupsError.message.includes("share_groups") || groupsError.code === "42P01";
  } else {
    const list = (groupsData ?? []) as ShareGroup[];
    const ids = list.map((g) => g.id);
    let members: ShareGroupMember[] = [];
    if (ids.length > 0) {
      const { data: membersData } = await supabase
        .from("share_group_members")
        .select("*")
        .in("group_id", ids)
        .order("created_at");
      members = (membersData ?? []) as ShareGroupMember[];
    }
    groups = list.map((g) => ({
      ...g,
      members: members.filter((m) => m.group_id === g.id),
    }));
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-28 bg-fz-bg min-h-screen">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/compartidos" className="text-fz-text" aria-label="Volver">
          <ChevronLeft size={24} />
        </Link>
        <div>
          <h1 className="font-display font-extrabold text-2xl text-fz-text uppercase tracking-wide">
            Grupos
          </h1>
          <p className="text-sm text-fz-text-tertiary mt-0.5">
            Familiares, amigos y otros para gastos compartidos
          </p>
        </div>
      </div>

      {migrationMissing ? (
        <div className="bg-fz-negative-soft rounded-2xl px-4 py-3 text-sm text-fz-text space-y-2">
          <p className="font-medium">Falta crear las tablas en Supabase</p>
          <p className="text-fz-text-secondary">
            Pedile a quien administre el proyecto que ejecute en el SQL Editor el
            archivo{" "}
            <code className="text-xs">supabase/migrations/030_share_groups.sql</code>
            . Después volvé a esta pantalla.
          </p>
        </div>
      ) : (
        <GruposClient initialGroups={groups} />
      )}
    </div>
  );
}
