"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Headphones,
  History,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { AudioPlayer, Drawer, EmptyState, Kpi, StatusBadge, TableSkeleton } from "@/components/tc-ui";

type Result = {
  id: string;
  conversation_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  national_id: string | null;
  status: string | null;
  motive: string | null;
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

type AuditDetail = {
  id: string;
  conversation_id: string | null;
  status: string | null;
  summary: string | null;
  transcript: unknown[];
  analysis: Record<string, unknown>;
  metadata: Record<string, unknown>;
  has_audio: boolean;
  audio_captured_at: string | null;
  created_at: string;
  customer: { full_name?: string | null; phone?: string | null; email?: string | null; address?: string | null; sector?: string | null } | null;
  order: { order_number?: string | null; equipment?: string | null; brand?: string | null; model?: string | null; issue?: string | null; status?: string | null; priority?: string | null } | null;
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

function resultTone(result: Result): "good" | "bad" | "warning" | "neutral" {
  if (result.call_successful === true) return "good";
  if (result.call_successful === false) return "bad";
  if (["failed", "error", "cancelled"].includes(String(result.status))) return "bad";
  if (["pending", "unreachable"].includes(String(result.status))) return "warning";
  return "neutral";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function transcriptRows(detail: AuditDetail | null) {
  if (!detail) return [];
  return detail.transcript.map((item, index) => {
    const row = asRecord(item);
    return {
      id: `${index}-${String(row.role ?? "turn")}`,
      role: String(row.role ?? "turn"),
      content: textValue(row.message) ?? textValue(row.text) ?? textValue(row.content) ?? "",
    };
  }).filter((row) => row.content);
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
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [selected, setSelected] = useState<Result | null>(null);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);

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

  async function openDetail(row: Result) {
    setSelected(row);
    setDetail(null);
    setAudioUrl(null);
    setDetailLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/audit/${row.id}/detail`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar el detalle");
      setDetail(payload.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el detalle");
    } finally {
      setDetailLoading(false);
    }
  }

  async function requestAudio(row: Result) {
    if (selected?.id !== row.id) await openDetail(row);
    setAudioLoading(true);
    setAudioUrl(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/audit/${row.id}/audio`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar el audio");
      setAudioUrl(payload.audio_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el audio");
    } finally {
      setAudioLoading(false);
    }
  }

  function closeDetail() {
    setSelected(null);
    setDetail(null);
    setAudioUrl(null);
    setAudioLoading(false);
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
    const successRate = rows.length ? Math.round((successful / rows.length) * 100) : 0;
    return { total: rows.length, withAudio, successful, avgSeconds, successRate };
  }, [results]);

  const transcript = transcriptRows(detail);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="tc-kpi-grid">
        <Kpi label="Llamadas auditables" value={stats.total} icon={<BarChart3 />} tone="accent" sub={<>Historial disponible</>} />
        <Kpi label="Grabaciones" value={`${stats.withAudio}/${stats.total}`} icon={<Headphones />} tone="info" sub={<>Audio privado disponible</>} />
        <Kpi label="Exitosas" value={stats.successful} icon={<CheckCircle2 />} tone="good" sub={<>{stats.successRate}% del resultado actual</>} />
        <Kpi label="Duración promedio" value={durationLabel(stats.avgSeconds)} icon={<Clock3 />} tone="info" sub={<>Promedio de llamadas filtradas</>} />
      </div>

      <section className="tc-card">
        <div className="tc-card-head">
          <div>
            <span className="tc-card-title-eyebrow">Control de calidad</span>
            <h3>Auditoría de llamadas</h3>
            <p>Consulta por fecha, teléfono, cédula o cliente. El audio y la transcripción se cargan únicamente bajo demanda.</p>
          </div>
          <button className="tc-btn tc-btn-secondary" onClick={runBackfill} disabled={backfillLoading}>
            {backfillLoading ? <Loader2 className="tc-spin" /> : <History />}
            {backfillLoading ? "Recuperando..." : "Recuperar audios históricos"}
          </button>
        </div>
        {backfillStatus && <div className="tc-notice" style={{ margin: 16 }}><RefreshCw /><span>{backfillStatus}</span></div>}
      </section>

      <section className="tc-card">
        <div className="tc-card-head">
          <div><span className="tc-card-title-eyebrow">Filtros</span><h3>Localizar una llamada</h3></div>
          <button className="tc-btn tc-btn-ghost tc-btn-sm" type="button" onClick={() => void loadResults()} disabled={loading}><RefreshCw />Historial reciente</button>
        </div>
        <form onSubmit={search} className="tc-filterbar">
          <div className="tc-search" style={{ minWidth: 220 }}><Search /><input className="tc-input" type="text" placeholder="Cliente" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
          <div className="tc-search" style={{ minWidth: 190 }}><Phone /><input className="tc-input" type="text" placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <input className="tc-input" style={{ width: 170 }} type="text" placeholder="Cédula" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          <input className="tc-input" style={{ width: 160 }} type="date" aria-label="Desde" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input className="tc-input" style={{ width: 160 }} type="date" aria-label="Hasta" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <button className="tc-btn tc-btn-sm" type="submit" disabled={loading}><Search />{loading ? "Buscando..." : "Aplicar"}</button>
        </form>
      </section>

      {error && <div className="tc-notice" style={{ borderColor: "var(--bad)" }}><ShieldCheck /><span>{error}</span></div>}

      <section className="tc-card">
        <div className="tc-card-head">
          <div><span className="tc-card-title-eyebrow">Registro</span><h3>{results ? `${results.length} llamada${results.length === 1 ? "" : "s"}` : "Historial"}</h3></div>
          <StatusBadge tone="accent" plain>Super Admin / Admin</StatusBadge>
        </div>
        {loading && !results ? <TableSkeleton rows={8} cols={8} /> : (
          <div className="tc-tablewrap tc-scroll">
            <table className="tc-table" style={{ minWidth: 1120 }}>
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Motivo</th>
                  <th>Orden</th>
                  <th>Duración</th>
                  <th>Resultado</th>
                  <th>Audio</th>
                  <th style={{ textAlign: "right" }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {(results || []).map((row) => (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(row.created_at).toLocaleString("es-DO")}</td>
                    <td><div className="tc-strong">{row.customer_name || "Sin nombre"}</div></td>
                    <td>{row.customer_phone || "—"}</td>
                    <td><div className="tc-truncate" title={row.motive || "Sin motivo clasificado"}>{row.motive || "Sin motivo clasificado"}</div></td>
                    <td className="tc-mono">{row.order_number || "—"}</td>
                    <td>{durationLabel(row.duration_seconds)}</td>
                    <td><StatusBadge tone={resultTone(row)}>{resultLabel(row)}</StatusBadge></td>
                    <td>
                      {row.has_audio ? (
                        <button className="tc-btn tc-btn-secondary tc-btn-sm" type="button" onClick={() => void requestAudio(row)}><Headphones />Escuchar</button>
                      ) : <StatusBadge tone="neutral" plain>Sin audio</StatusBadge>}
                    </td>
                    <td><div className="tc-rowactions"><button className="tc-btn tc-btn-ghost tc-btn-sm" type="button" onClick={() => void openDetail(row)}>Ver detalle</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && results?.length === 0 && <EmptyState title="Sin resultados" message="No encontramos llamadas con los filtros seleccionados." icon={<Phone />} />}
          </div>
        )}
      </section>

      <Drawer
        open={Boolean(selected)}
        onClose={closeDetail}
        title={selected?.customer_name || "Detalle de llamada"}
        eyebrow="Auditoría protegida"
        wide
        headerExtra={selected ? <StatusBadge tone={resultTone(selected)}>{resultLabel(selected)}</StatusBadge> : undefined}
      >
        {selected && (
          <>
            <div className="tc-metagrid">
              <div className="tc-metabox"><small>Fecha</small><strong>{new Date(selected.created_at).toLocaleString("es-DO")}</strong></div>
              <div className="tc-metabox"><small>Duración</small><strong>{durationLabel(selected.duration_seconds)}</strong></div>
              <div className="tc-metabox"><small>Teléfono</small><strong>{selected.customer_phone || "—"}</strong></div>
              <div className="tc-metabox"><small>Motivo</small><strong>{selected.motive || "Sin motivo clasificado"}</strong></div>
              <div className="tc-metabox"><small>Orden</small><strong>{selected.order_number || "—"}</strong></div>
              <div className="tc-metabox"><small>Sentimiento</small><strong>{selected.sentiment || "No clasificado"}</strong></div>
            </div>

            {selected.has_audio && (
              <section className="tc-card tc-card-pad">
                <span className="tc-card-title-eyebrow">Grabación</span>
                <h3 style={{ margin: "7px 0 12px" }}>Audio de la llamada</h3>
                {audioUrl ? (
                  <AudioPlayer src={audioUrl} context={`${selected.customer_name || "Cliente"} · ${selected.motive || "Llamada"}`} />
                ) : (
                  <button className="tc-btn" type="button" disabled={audioLoading} onClick={() => void requestAudio(selected)}>
                    {audioLoading ? <Loader2 className="tc-spin" /> : <Headphones />}
                    {audioLoading ? "Generando acceso..." : "Escuchar grabación"}
                  </button>
                )}
              </section>
            )}

            {detailLoading ? <div className="tc-card"><TableSkeleton rows={5} cols={2} /></div> : detail && (
              <>
                <section className="tc-card tc-card-pad">
                  <span className="tc-card-title-eyebrow">Resumen IA</span>
                  <h3 style={{ margin: "7px 0 10px" }}>Resumen de la interacción</h3>
                  <p style={{ margin: 0, color: "var(--text-soft)", lineHeight: 1.65 }}>{detail.summary || "No existe resumen para esta llamada."}</p>
                  {selected.termination_reason && <div className="tc-cell-sub" style={{ marginTop: 10 }}>Terminación: {selected.termination_reason}</div>}
                </section>

                {detail.order && (
                  <section className="tc-card tc-card-pad">
                    <span className="tc-card-title-eyebrow">Orden relacionada</span>
                    <h3 style={{ margin: "7px 0 10px" }}>{detail.order.order_number || selected.order_number}</h3>
                    <div className="tc-metagrid">
                      <div className="tc-metabox"><small>Equipo</small><strong>{[detail.order.brand, detail.order.model].filter(Boolean).join(" · ") || detail.order.equipment || "—"}</strong></div>
                      <div className="tc-metabox"><small>Estado</small><strong>{detail.order.status || "—"}</strong></div>
                    </div>
                    {detail.order.issue && <p style={{ margin: "12px 0 0", color: "var(--muted)" }}>{detail.order.issue}</p>}
                  </section>
                )}

                <section className="tc-card tc-card-pad">
                  <span className="tc-card-title-eyebrow">Transcripción</span>
                  <h3 style={{ margin: "7px 0 14px" }}>Conversación completa</h3>
                  {transcript.length ? (
                    <div style={{ display: "grid", gap: 9 }}>
                      {transcript.map((turn) => (
                        <div key={turn.id} style={{ padding: "11px 13px", borderRadius: 10, border: "1px solid var(--border)", background: turn.role === "user" ? "var(--accent-soft)" : "var(--panel-2)" }}>
                          <small style={{ display: "block", color: "var(--muted)", marginBottom: 5, fontWeight: 700 }}>{turn.role === "user" ? "Cliente" : "Asistente"}</small>
                          <div style={{ color: "var(--text-soft)", lineHeight: 1.55 }}>{turn.content}</div>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState title="Sin transcripción" message="Esta llamada no tiene transcripción disponible." />}
                </section>
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
