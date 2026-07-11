"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteGoal } from "../actions";

export default function DeleteGoalButton({ goalId, goalName }: { goalId: string; goalName: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirming" | "deleting">("idle");

  async function handleDelete() {
    setState("deleting");
    const result = await deleteGoal(goalId);
    if (result.error) {
      setState("idle");
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  if (state === "idle") {
    return (
      <button
        onClick={() => setState("confirming")}
        className="text-[11px] text-red-500"
      >
        Eliminar
      </button>
    );
  }

  if (state === "confirming") {
    return (
      <span className="flex items-center gap-2 text-[11px]">
        <span className="text-gray-500">¿Eliminar "{goalName}"?</span>
        <button onClick={handleDelete} className="text-red-600 font-medium">Sí</button>
        <button onClick={() => setState("idle")} className="text-gray-400">No</button>
      </span>
    );
  }

  return <span className="text-[11px] text-gray-400">Eliminando…</span>;
}
