"use client";

import { useState } from "react";

const ROLES = ["owner", "admin", "manager", "analyst", "agent", "viewer", "technician"];

export default function InviteUserForm() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("agent");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ email: string; temp_password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, full_name: fullName || undefined, phone: role === "technician" ? phone : undefined })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo crear el usuario");
      setResult({ email: payload.user.email, temp_password: payload.temp_password });
      setEmail("");
      setFullName("");
      setPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el usuario");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3>Crear nuevo usuario</h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label>
          <div className="muted">Correo</div>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          <div className="muted">Nombre {role === "technician" ? "" : "(opcional)"}</div>
          <input className="input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required={role === "technician"} />
        </label>
        <label>
          <div className="muted">Rol</div>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        {role === "technician" && (
          <label>
            <div className="muted">Teléfono (WhatsApp)</div>
            <input className="input" type="text" placeholder="8095551234" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
        )}
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Creando..." : "Crear usuario"}
        </button>
      </form>
      {role === "technician" && (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Se crea automáticamente su perfil de técnico vinculado — al iniciar sesión entra directo a su portal de órdenes, no al CRM.
        </p>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {result && (
        <div className="card" style={{ marginTop: 12 }}>
          <p><strong>{result.email}</strong> creado.</p>
          <p>Contraseña temporal: <code>{result.temp_password}</code></p>
          <p className="muted">Compártela de forma segura. El usuario debe cambiarla al entrar.</p>
        </div>
      )}
    </div>
  );
}
