import { createClient } from "@/lib/supabase/server";
import type { ShareGroup, ShareGroupMember, ShareGroupWithMembers } from "@/types";

/** Best-effort: si la migración 030 no está, devuelve []. */
export async function fetchShareGroupsWithMembers(): Promise<ShareGroupWithMembers[]> {
  const supabase = await createClient();
  const { data: groupsData, error } = await supabase
    .from("share_groups")
    .select("*")
    .order("created_at");
  if (error || !groupsData) return [];

  const list = groupsData as ShareGroup[];
  if (list.length === 0) return [];

  const { data: membersData } = await supabase
    .from("share_group_members")
    .select("*")
    .in(
      "group_id",
      list.map((g) => g.id)
    )
    .order("created_at");

  const members = (membersData ?? []) as ShareGroupMember[];
  return list.map((g) => ({
    ...g,
    members: members.filter((m) => m.group_id === g.id),
  }));
}
