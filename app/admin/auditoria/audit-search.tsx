"use client";

import { useState } from "react";

type Result = {
  id: string;
  conversation_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  national_id: string | null;
  status: string | null;
  summary: string | null;
  has_audio: boolean;
  audio_captured_at: string | null;
  created_at: string;
};

export default function AuditSearch() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (phone) params.set("phone", phone);
      if (nationalId) params.set("national_id", nationalId);
      if (customerName) params.set("customer_name", customerName);

      const response = await fetch(`/api/admin/audit/search?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Error al buscar");
      setResults(payload.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  }

  async function playAudio(id: string) {
    setPlayingId(id);
    setAudioUrl(null);
    try {
      const response = await fetch(`/api/admin/audit/${id}/audio`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar el audio");
      setAudioUrl(payload.audio_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el audio");
      setPlayingId(null);
    }
  }

  async function runBackfill() {
    setBackfillLoading(true);
    setBackfillStatus(null);
    try {
      const response = await fetch("/api/admin/audit/backfill-audio", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Error al recuperar audios");
      setBackfillStatus(`Recuperados: ${payload.recovered}. Fallidos: ${payload.failed} (probablemente ya no disponibles en ElevenLabs).`);
    } catch (err) {
      setBackfillStatus(err instanceof Error ? err.message : "Error al recuperar audios");
    } finally {
      setBackfillLoading(false);
    }
  }

  return (
    <div>
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>Recuperar grabaciones anteriores</h3>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Llamadas de antes de hoy no tienen audio guardado — intenta recuperarlas desde ElevenLabs (puede fallar en llamadas muy antiguas).
            </p>
          </div>
          <button className="button" onClick={runBackfill} disabled={backfillLoading}>
            {backfillLoading ? "Recuperando..." : "Recuperar audios existentes"}
          </button>
        </div>
        {backfillStatus && <p style={{ marginTop: 12 }}>{backfillStatus}</p>}
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Buscar</h3>
        <form onSubmit={search} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label>
            <div className="muted">Desde</div>
            <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            <div className="muted">Hasta</div>
            <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label>
            <div className="muted">Teléfono</div>
            <input className="input" type="text" placeholder="809..." value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            <div className="muted">Cédula</div>
            <input className="input" type="text" placeholder="000-0000000-0" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          </label>
          <label>
            <div className="muted">Cliente</div>
            <input className="input" type="text" placeholder="Nombre" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </label>
          <button className="button" type="submit" disabled={loading}>{loading ? "Buscando..." : "Buscar"}</button>
        </form>
      </section>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {results && (
        <section className="card">
          <h3 style={{ marginTop: 0 }}>{results.length} resultado{results.length === 1 ? "" : "s"}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Cédula</th>
                <th>Resumen</th>
                <th>Audio</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString("es-DO")}</td>
                  <td>{r.customer_name || "—"}</td>
                  <td>{r.customer_phone || "—"}</td>
                  <td>{r.national_id || "—"}</td>
                  <td style={{ maxWidth: 320 }}>{r.summary || "Sin resumen"}</td>
                  <td>
                    {r.has_audio ? (
                      playingId === r.id ? (
                        audioUrl ? <audio controls autoPlay style={{ width: 220 }} src={audioUrl} /> : <span className="muted">Cargando...</span>
                      ) : (
                        <button className="button" style={{ padding: "6px 12px" }} onClick={() => playAudio(r.id)}>Escuchar</button>
                      )
                    ) : (
                      <span className="muted">Sin audio</span>
                    )}
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr><td colSpan={6} className="muted">Sin resultados para estos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
