"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Result = {
  id: string;
  conversation_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  national_id: string | null;
  status: string | null;
  summary: string | null;
  order_number: string | null;
  duration_seconds: number;
  termination_reason: string | null;
  call_successful: boolean | null;
  call_success_score: number | null;
  sentiment: string | null;
  has_audio: boolean;
  audio_captured_at: string | null;
  created_at: string;
};

function durationLabel(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function resultLabel(result: Result) {
  if (result.call_successful === true) return "Exitosa";
  if (result.call_successful === false) return "No exitosa";
  return result.status || "Sin clasificar";
}

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

  const loadResults = useCallback(async (params?: URLSearchParams) => {
    setLoading(true);
    setError(null);
    try {
      const query = params?.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/admin/audit/search${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Error al buscar");
      setResults(payload.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (phone) params.set("phone", phone);
    if (nationalId) params.set("national_id", nationalId);
    if (customerName) params.set("customer_name", customerName);
    await loadResults(params);
  }

  async function playAudio(id: string) {
    setPlayingId(id);
    setAudioUrl(null);
    try {
      const response = await fetch(`/api/admin/audit/${id}/audio`, { cache: "no-store" });
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
      const remainingText = typeof payload.remaining === "number" ? ` Pendientes: ${payload.remaining}.` : "";
      setBackfillStatus(`Recuperados: ${payload.recovered}. Fallidos: ${payload.failed}.${remainingText}`);
      await loadResults();
    } catch (err) {
      setBackfillStatus(err instanceof Error ? err.message : "Error al recuperar audios");
    } finally {
      setBackfillLoading(false);
    }
  }

  const stats = useMemo(() => {
    const rows = results || [];
    const withAudio = rows.filter((row) => row.has_audio).length;
    const successful = rows.filter((row) => row.call_successful === true).length;
    const totalSeconds = rows.reduce((sum, row) => sum + (Number.isFinite(row.duration_seconds) ? row.duration_seconds : 0), 0);
    const avgSeconds = rows.length ? Math.round(totalSeconds / rows.length) : 0;
    return { total: rows.length, withAudio, successful, avgSeconds };
  }, [results]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="grid grid-4" style={{ gap: 14 }}>
        {[
          ["Llamadas auditables", String(stats.total), "Historial cargado automáticamente"],
          ["Con audio", String(stats.withAudio), "Grabaciones disponibles"],
          ["Exitosas", String(stats.successful), "Según análisis de la llamada"],
          ["Duración promedio", durationLabel(stats.avgSeconds), "Promedio del resultado actual"],
        ].map(([label, value, detail]) => (
          <article className="card" key={label} style={{ minHeight: 126, borderTop: "2px solid var(--accent)" }}>
            <p className="muted" style={{ margin: 0, fontSize: 13, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</p>
            <strong style={{ display: "block", marginTop: 10, fontSize: 30 }}>{value}</strong>
            <span className="muted" style={{ fontSize: 13 }}>{detail}</span>
          </article>
        ))}
      </section>

      <section className="card" style={{ border: "1px solid rgba(255,106,57,.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 760 }}>
            <span className="badge">Super Admin / Admin</span>
            <h2 style={{ margin: "10px 0 6px" }}>Centro de auditoría de llamadas</h2>
            <p className="muted" style={{ margin: 0 }}>
              Las llamadas históricas aparecen aquí sin cargar transcripciones completas. El audio se obtiene únicamente al pulsar Escuchar mediante un enlace firmado temporal.
            </p>
          </div>
          <button className="button" onClick={runBackfill} disabled={backfillLoading}>
            {backfillLoading ? "Recuperando audios..." : "Recuperar audios históricos"}
          </button>
        </div>
        {backfillStatus && <p style={{ margin: "14px 0 0", padding: 12, borderRadius: 8, background: "rgba(255,255,255,.04)" }}>{backfillStatus}</p>}
      </section>

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <span className="badge">Filtros</span>
            <h3 style={{ margin: "8px 0 0" }}>Localizar una llamada</h3>
          </div>
          <button className="button" type="button" onClick={() => void loadResults()} disabled={loading}>Ver historial reciente</button>
        </div>
        <form onSubmit={search} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, alignItems: "end" }}>
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
          <button className="button" type="submit" disabled={loading}>{loading ? "Buscando..." : "Aplicar filtros"}</button>
        </form>
      </section>

      {error && <section className="card" style={{ borderColor: "crimson" }}><strong>Error</strong><p>{error}</p></section>}

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div>
            <span className="badge">Registro</span>
            <h3 style={{ margin: "8px 0 0" }}>{results ? `${results.length} llamada${results.length === 1 ? "" : "s"}` : "Cargando historial..."}</h3>
          </div>
        </div>
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
          <table style={{ width: "100%", minWidth: 1180, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "rgba(255,255,255,.035)" }}>
                <th style={{ padding: 12 }}>Fecha</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Cédula</th>
                <th>Orden</th>
                <th>Duración</th>
                <th>Resultado</th>
                <th>Resumen</th>
                <th>Audio</th>
              </tr>
            </thead>
            <tbody>
              {(results || []).map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: 12, whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleString("es-DO")}</td>
                  <td><strong>{r.customer_name || "Sin nombre"}</strong></td>
                  <td>{r.customer_phone || "—"}</td>
                  <td>{r.national_id || "—"}</td>
                  <td>{r.order_number || "—"}</td>
                  <td>{durationLabel(r.duration_seconds)}</td>
                  <td>
                    <strong>{resultLabel(r)}</strong>
                    {r.sentiment && <div className="muted" style={{ fontSize: 12 }}>{r.sentiment}</div>}
                    {r.termination_reason && <div className="muted" style={{ fontSize: 12 }}>{r.termination_reason}</div>}
                  </td>
                  <td style={{ maxWidth: 360, padding: "10px 8px" }}>{r.summary || "Sin resumen"}</td>
                  <td>
                    {r.has_audio ? (
                      playingId === r.id ? (
                        audioUrl ? <audio controls autoPlay style={{ width: 220 }} src={audioUrl} /> : <span className="muted">Cargando...</span>
                      ) : (
                        <button className="button" style={{ padding: "7px 12px" }} onClick={() => void playAudio(r.id)}>Escuchar</button>
                      )
                    ) : (
                      <span className="muted">Sin audio histórico</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && results?.length === 0 && (
                <tr><td colSpan={9} className="muted" style={{ padding: 24, textAlign: "center" }}>Sin resultados para estos filtros.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={9} className="muted" style={{ padding: 24, textAlign: "center" }}>Cargando llamadas...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
