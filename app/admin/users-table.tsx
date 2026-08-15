"use client";

import { useState } from "react";

const ROLES = ["owner", "admin", "manager", "analyst", "agent", "viewer", "technician"];
const STATUSES = ["active", "suspended", "invited"];

type Member = { user_id: string; email: string; role: string; status: string };

export default function UsersTable({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateMember(userId: string, patch: { role?: string; status?: string }) {
    setSavingId(userId);
    setError(null);
    try {
      const response = await fetch("/api/admin/users/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, ...patch }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo actualizar");
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, ...patch } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteUser(userId: string, email: string) {
    const confirmed = confirm(`¿Eliminar definitivamente a ${email}?\n\nSe eliminará su acceso, cuenta de autenticación y perfil técnico vinculado. Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    setSavingId(userId);
    setError(null);
    try {
      const response = await fetch("/api/admin/users/manage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo eliminar el usuario");
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar usuario");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      {error && <div style={{ marginBottom: 12, padding: 10, border: "1px solid #7a2734", borderRadius: 10, color: "#ff9aa8", background: "#2a1419" }}>{error}</div>}
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        {members.map((m) => (
          <article key={m.user_id} style={{ border: "1px solid #303640", borderRadius: 12, padding: 14, background: "rgba(255,255,255,.015)" }}>
            <div style={{ fontWeight: 700, overflowWrap: "anywhere", marginBottom: 12 }}>{m.email}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, alignItems: "end" }}>
              <label>
                <span className="muted" style={{ display: "block", fontSize: 12, marginBottom: 5 }}>Rol</span>
                <select className="input" style={{ width: "100%" }} value={m.role} disabled={savingId === m.user_id} onChange={(e) => updateMember(m.user_id, { role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label>
                <span className="muted" style={{ display: "block", fontSize: 12, marginBottom: 5 }}>Estado</span>
                <select className="input" style={{ width: "100%" }} value={m.status} disabled={savingId === m.user_id} onChange={(e) => updateMember(m.user_id, { status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <button className="button" style={{ width: "100%", background: "transparent", border: "1px solid #e43d55", color: "#ff5c73" }} disabled={savingId === m.user_id} onClick={() => deleteUser(m.user_id, m.email)}>
                {savingId === m.user_id ? "Procesando..." : "Eliminar usuario"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
