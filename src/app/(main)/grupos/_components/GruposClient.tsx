"use client";

import { useState } from "react";
import {
  createShareGroup,
  updateShareGroup,
  deleteShareGroup,
  seedDefaultShareGroups,
} from "../actions";
import type { ShareGroupWithMembers } from "@/types";

const ICONS = ["👨‍👩‍👧‍👦", "🍻", "💼", "🏠", "⚽", "🎓", "✈️", "🎉"];

export default function GruposClient({
  initialGroups,
}: {
  initialGroups: ShareGroupWithMembers[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [membersText, setMembersText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function openCreate() {
    setCreating(true);
    setEditingId(null);
    setName("");
    setIcon(ICONS[0]);
    setMembersText("");
    setError(null);
  }

  function openEdit(g: ShareGroupWithMembers) {
    setCreating(false);
    setEditingId(g.id);
    setName(g.name);
    setIcon(g.icon ?? ICONS[0]);
    setMembersText(g.members.map((m) => m.name).join("\n"));
    setError(null);
  }

  function cancelForm() {
    setCreating(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    const members = membersText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingId) {
      const result = await updateShareGroup({
        groupId: editingId,
        name,
        icon,
        members,
      });
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
    } else {
      const result = await createShareGroup({ name, icon, members });
      setLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
    }

    // Refresco simple: recargar la página
    window.location.reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este grupo? No borra gastos ya cargados.")) return;
    setLoading(true);
    const result = await deleteShareGroup(id);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setGroups((prev) => prev.filter((g) => g.id !== id));
    cancelForm();
  }

  async function handleSeedDefaults() {
    setLoading(true);
    setError(null);
    setInfo(null);
    const result = await seedDefaultShareGroups();
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (result.count === 0) {
      setInfo("Ya tenías grupos; no se creó nada nuevo.");
      return;
    }
    window.location.reload();
  }

  const showForm = creating || editingId != null;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={openCreate}
          className="flex-1 min-h-[44px] rounded-xl bg-fz-accent text-fz-accent-text text-sm font-semibold"
        >
          + Nuevo grupo
        </button>
        {groups.length === 0 && (
          <button
            type="button"
            onClick={handleSeedDefaults}
            disabled={loading}
            className="flex-1 min-h-[44px] rounded-xl border border-fz-border bg-fz-surface text-sm font-medium text-fz-text"
          >
            Crear Familiares / Amigos / Trabajo
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-fz-negative bg-fz-negative-soft rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {info && (
        <p className="text-sm text-fz-text bg-fz-accent-soft rounded-lg px-3 py-2">{info}</p>
      )}

      {showForm && (
        <div className="bg-fz-surface border border-fz-border rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-fz-text">
            {editingId ? "Editar grupo" : "Nuevo grupo"}
          </p>
          <div>
            <label className="block text-sm font-medium text-fz-text-secondary mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Familiares"
              className="w-full min-h-[44px] border border-fz-border rounded-lg px-3 py-2 text-sm bg-fz-bg text-fz-text"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fz-text-secondary mb-1">
              Ícono
            </label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`w-11 h-11 rounded-xl text-xl ${
                    icon === ic
                      ? "bg-fz-accent-soft ring-2 ring-fz-accent"
                      : "bg-fz-surface-high"
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-fz-text-secondary mb-1">
              Personas (una por línea — sin incluirte)
            </label>
            <textarea
              value={membersText}
              onChange={(e) => setMembersText(e.target.value)}
              rows={4}
              placeholder={"Mamá\nPapá\nHermana"}
              className="w-full border border-fz-border rounded-lg px-3 py-2 text-sm bg-fz-bg text-fz-text"
            />
            <p className="text-[11px] text-fz-text-tertiary mt-1">
              Al usar el grupo en un gasto, el reparto es entre estas personas + vos.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="flex-1 min-h-[44px] rounded-xl bg-fz-text text-fz-bg text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="min-h-[44px] px-4 rounded-xl border border-fz-border text-sm text-fz-text-secondary"
            >
              Cancelar
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => handleDelete(editingId)}
                disabled={loading}
                className="min-h-[44px] px-4 rounded-xl bg-fz-negative-soft text-fz-negative text-sm font-medium"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      )}

      {groups.length === 0 && !showForm ? (
        <div className="bg-fz-surface border border-fz-border rounded-2xl p-6 text-center space-y-2">
          <p className="text-sm font-medium text-fz-text">Todavía no tenés grupos</p>
          <p className="text-sm text-fz-text-tertiary">
            Creá &quot;Familiares&quot;, &quot;Amigos&quot; o el que uses seguido, y al
            cargar un gasto compartido los elegís en un toque.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => openEdit(g)}
              className="w-full text-left bg-fz-surface border border-fz-border rounded-2xl px-4 py-3 hover:bg-fz-surface-high transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">{g.icon ?? "👥"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fz-text">{g.name}</p>
                  <p className="text-xs text-fz-text-tertiary truncate">
                    {g.members.length === 0
                      ? "Sin personas"
                      : g.members.map((m) => m.name).join(" · ")}
                  </p>
                </div>
                <span className="text-xs text-fz-text-tertiary shrink-0">
                  {g.members.length + 1} c/vos
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
