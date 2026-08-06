"use client";

import { useState } from "react";

const ROLES = ["owner", "admin", "manager", "analyst", "agent", "viewer"];
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

  async function removeMember(userId: string, email: string) {
    if (!confirm(`¿Quitar el acceso de ${email}? Podrás volver a crearlo después si te equivocas.`)) return;
    setSavingId(userId);
    setError(null);
    try {
      const response = await fetch("/api/admin/users/manage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo quitar el acceso");
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al quitar acceso");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th>Correo</th>
            <th>Rol</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.user_id}>
              <td>{m.email}</td>
              <td>
                <select
                  className="input"
                  value={m.role}
                  disabled={savingId === m.user_id}
                  onChange={(e) => updateMember(m.user_id, { role: e.target.value })}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td>
                <select
                  className="input"
                  value={m.status}
                  disabled={savingId === m.user_id}
                  onChange={(e) => updateMember(m.user_id, { status: e.target.value })}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td>
                <button
                  className="button"
                  style={{ background: "transparent", border: "1px solid crimson", color: "crimson" }}
                  disabled={savingId === m.user_id}
                  onClick={() => removeMember(m.user_id, m.email)}
                >
                  Quitar acceso
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
