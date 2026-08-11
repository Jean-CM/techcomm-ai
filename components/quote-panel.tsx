"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  PackagePlus,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { Drawer, EmptyState, Kpi, Modal, StatusBadge, TableSkeleton, type Tone } from "@/components/tc-ui";

export type QuoteCustomer = {
  id: string;
  full_name?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  sector?: string | null;
};

type QuoteRow = {
  id: string;
  quote_number: string;
  customer_id?: string | null;
  work_order_id?: string | null;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  discount_amount: number;
  discount_pct: number;
  installation_included: boolean;
  installation_amount: number;
  delivery_included: boolean;
  delivery_amount: number;
  approval_required: boolean;
  approved_at?: string | null;
  accepted_by_customer: boolean;
  accepted_at?: string | null;
  customer_name_snapshot?: string | null;
  customer_phone_snapshot?: string | null;
  customer_email_snapshot?: string | null;
  customer_address_snapshot?: string | null;
  notes?: string | null;
  sent_at?: string | null;
  sent_channel?: string | null;
  customer_response?: string | null;
  customer_responded_at?: string | null;
  cancel_reason_code?: string | null;
  cancel_reason_note?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  expires_at?: string | null;
};

type QuoteSummary = {
  total: number;
  draft: number;
  pending_approval: number;
  sent: number;
  accepted: number;
  rejected: number;
  active_value: number;
  accepted_value: number;
};

type QuotePayload = {
  ok: boolean;
  quotes: QuoteRow[];
  summary: QuoteSummary;
  pagination: { page: number; pageSize: number; total: number; pages: number };
};

type ProductResult = {
  id: string;
  sku?: string | null;
  name: string;
  piece_name?: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  sale_price?: number | null;
  price?: number | null;
  stock: number;
  reserved_stock: number;
  available_stock: number;
  inventory_status: string;
};

type DraftLine = {
  product: ProductResult;
  quantity: number;
  discountPct: number;
};

type QuoteItem = {
  id: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  discount_amount: number;
  line_total: number;
};

type QuoteEvent = {
  id: string;
  event_type: string;
  actor_type: string;
  actor_user_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type QuoteDetail = QuoteRow & {
  public_token: string;
  warranty_note?: string | null;
  internal_notes?: string | null;
  quote_items: QuoteItem[];
};

const EMPTY_SUMMARY: QuoteSummary = {
  total: 0,
  draft: 0,
  pending_approval: 0,
  sent: 0,
  accepted: 0,
  rejected: 0,
  active_value: 0,
  accepted_value: 0,
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  pending_approval: "Pendiente aprobación",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  review_requested: "Revisión solicitada",
  cancelled: "Cancelada",
  expired: "Vencida",
};

const CANCEL_REASONS = [
  ["cliente_desistio", "Cliente desistió"],
  ["duplicada", "Cotización duplicada"],
  ["sin_stock", "Sin disponibilidad / stock"],
  ["precio_no_aprobado", "Precio o descuento no aprobado"],
  ["cambio_alcance", "Cambio de alcance"],
  ["error_datos", "Error en datos de la cotización"],
  ["reemplazada", "Reemplazada por una nueva cotización"],
  ["otro", "Otro motivo"],
] as const;

function money(value?: number | null) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function localDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function statusLabel(value?: string | null) {
  return value ? STATUS_LABELS[value] || value : "Sin estado";
}

function cancelReasonLabel(value?: string | null) {
  if (!value) return "—";
  return CANCEL_REASONS.find(([key]) => key === value)?.[1] || value.replace(/_/g, " ");
}

function statusTone(value?: string | null): Tone {
  if (["accepted"].includes(String(value))) return "good";
  if (["rejected", "cancelled", "expired"].includes(String(value))) return "bad";
  if (["pending_approval", "review_requested"].includes(String(value))) return "warning";
  if (["sent"].includes(String(value))) return "info";
  return "neutral";
}

function eventLabel(value: string) {
  const labels: Record<string, string> = {
    created: "Cotización creada",
    sent: "Enviada al cliente",
    send_failed: "Fallo de envío",
    customer_response: "Respuesta del cliente",
    approve_discount: "Descuento aprobado",
    cancel: "Cotización cancelada",
    internal_notes_updated: "Notas internas actualizadas",
  };
  return labels[value] || value.replace(/_/g, " ");
}

function eventDetail(event: QuoteEvent) {
  const metadata = event.metadata || {};
  if (event.event_type === "sent" && metadata.channel) return `Canal: ${String(metadata.channel)}`;
  if (event.event_type === "send_failed" && metadata.channel) return `Canal: ${String(metadata.channel)} · envío fallido`;
  if (event.event_type === "cancel" && metadata.reason_code) {
    const reason = cancelReasonLabel(String(metadata.reason_code));
    const note = metadata.reason_note ? ` · ${String(metadata.reason_note)}` : "";
    return `${reason}${note}`;
  }
  if (event.event_type === "customer_response" && metadata.action) return `Respuesta: ${String(metadata.action)}`;
  return "";
}

export default function QuotePanel({
  customers,
  canManage = false,
  canApprove = false,
}: {
  customers: QuoteCustomer[];
  canManage?: boolean;
  canApprove?: boolean;
}) {
  const [payload, setPayload] = useState<QuotePayload>({ ok: true, quotes: [], summary: EMPTY_SUMMARY, pagination: { page: 1, pageSize: 50, total: 0, pages: 1 } });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [query, setQuery] = useState("");
  const [queryDebounced, setQueryDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [selected, setSelected] = useState<QuoteRow | null>(null);
  const [detail, setDetail] = useState<QuoteDetail | null>(null);
  const [events, setEvents] = useState<QuoteEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [includeInstallation, setIncludeInstallation] = useState(false);
  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQueryDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => { setPage(1); }, [queryDebounced, status]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "50", q: queryDebounced, status });
      const response = await fetch(`/api/crm/quotes?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar cotizaciones.");
      setPayload(data);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No fue posible cargar cotizaciones.");
    } finally {
      setLoading(false);
    }
  }, [page, queryDebounced, status]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!createOpen || productQuery.trim().length < 2) {
      setProductResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setProductLoading(true);
      try {
        const params = new URLSearchParams({ q: productQuery.trim(), page: "1", pageSize: "20", stockStatus: "available" });
        const response = await fetch(`/api/crm/inventory?${params}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No fue posible buscar inventario.");
        setProductResults(data.products || []);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "No fue posible buscar inventario.");
      } finally {
        setProductLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [createOpen, productQuery]);

  const draftEstimate = useMemo(() => lines.reduce((sum, line) => {
    const unit = Number(line.product.sale_price ?? line.product.price ?? 0);
    const discount = Math.max(0, Math.min(100, line.discountPct)) / 100;
    return sum + unit * line.quantity * (1 - discount);
  }, 0), [lines]);

  function resetCreate() {
    setCustomerId("");
    setProductQuery("");
    setProductResults([]);
    setLines([]);
    setIncludeInstallation(false);
    setIncludeDelivery(false);
    setNotes("");
  }

  function addProduct(product: ProductResult) {
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) return current.map((line) => line.product.id === product.id ? { ...line, quantity: Math.min(product.available_stock, line.quantity + 1) } : line);
      return [...current, { product, quantity: 1, discountPct: 0 }];
    });
  }

  async function createQuote(event: FormEvent) {
    event.preventDefault();
    if (!customerId || !lines.length) {
      setFeedback("Selecciona cliente y al menos un producto.");
      return;
    }
    setActionLoading(true);
    setFeedback("Creando cotización...");
    try {
      const response = await fetch("/api/crm/quotes/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          items: lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity, requested_discount_pct: line.discountPct })),
          include_installation: includeInstallation,
          include_delivery: includeDelivery,
          notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible crear la cotización.");
      setCreateOpen(false);
      resetCreate();
      setFeedback(data.approval_required ? `${data.quote.quote_number} creada y pendiente de aprobación.` : `${data.quote.quote_number} creada como borrador.`);
      await load();
      await openDetail({ ...data.quote, created_at: new Date().toISOString() } as QuoteRow);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No fue posible crear la cotización.");
    } finally {
      setActionLoading(false);
    }
  }

  async function openDetail(row: QuoteRow) {
    setSelected(row);
    setDetail(null);
    setEvents([]);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/crm/quotes/${row.id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible abrir la cotización.");
      setDetail(data.quote);
      setEvents(data.events || []);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No fue posible abrir la cotización.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function approveDiscount() {
    if (!detail) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/crm/quotes/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve_discount" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible aprobar la cotización.");
      setFeedback("Aprobación interna registrada.");
      await load();
      await openDetail({ ...detail, ...data.quote });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No fue posible aprobar la cotización.");
    } finally {
      setActionLoading(false);
    }
  }

  async function submitCancel(event: FormEvent) {
    event.preventDefault();
    if (!detail || !cancelReason) return;
    if (cancelReason === "otro" && cancelNote.trim().length < 5) {
      setFeedback("Describe brevemente el motivo de cancelación.");
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch(`/api/crm/quotes/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel", cancel_reason_code: cancelReason, cancel_reason_note: cancelNote }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cancelar la cotización.");
      setCancelOpen(false);
      setCancelReason("");
      setCancelNote("");
      setFeedback("Cotización cancelada con motivo registrado para auditoría.");
      await load();
      await openDetail({ ...detail, ...data.quote });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No fue posible cancelar la cotización.");
    } finally {
      setActionLoading(false);
    }
  }

  async function sendQuote(channel: "whatsapp" | "email") {
    if (!detail) return;
    setActionLoading(true);
    setFeedback(channel === "email" ? "Enviando cotización por correo..." : "Enviando cotización por WhatsApp...");
    try {
      const response = await fetch(channel === "email" ? "/api/crm/quotes/send-email" : "/api/crm/quotes/send-whatsapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quote_id: detail.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible enviar la cotización.");
      setFeedback(channel === "email" ? "Cotización enviada por correo." : "Cotización enviada por WhatsApp.");
      await load();
      await openDetail({ ...detail, status: "sent", sent_at: new Date().toISOString() });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No fue posible enviar la cotización.");
    } finally {
      setActionLoading(false);
    }
  }

  const firstRow = payload.pagination.total ? (payload.pagination.page - 1) * payload.pagination.pageSize + 1 : 0;
  const lastRow = Math.min(payload.pagination.total, payload.pagination.page * payload.pagination.pageSize);
  const previewUrl = detail ? `/cotizacion/${detail.public_token}` : "";
  const canDeliver = detail ? ["draft", "sent"].includes(detail.status) : false;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {feedback && <div className="tc-notice"><AlertTriangle size={16}/><span>{feedback}</span><button className="tc-linkbtn" style={{ marginLeft: "auto" }} onClick={() => setFeedback("")}>Cerrar</button></div>}

      <div className="tc-kpi-grid">
        <Kpi label="Cotizaciones" value={payload.summary.total} icon={<FileText/>} tone="accent" sub={<>Histórico comercial</>} />
        <Kpi label="Pendientes aprobación" value={payload.summary.pending_approval} icon={<ShieldCheck/>} tone={payload.summary.pending_approval ? "warning" : "good"} sub={<>Descuentos fuera de rango</>} />
        <Kpi label="Enviadas" value={payload.summary.sent} icon={<Send/>} tone="info" sub={<>Esperando respuesta</>} />
        <Kpi label="Aceptadas" value={payload.summary.accepted} icon={<CheckCircle2/>} tone="good" sub={<>{money(payload.summary.accepted_value)}</>} />
        <Kpi label="Valor activo" value={money(payload.summary.active_value)} icon={<Clock3/>} tone="accent" sub={<>Pipeline abierto</>} />
      </div>

      <section className="tc-card">
        <div className="tc-card-head">
          <div><span className="tc-card-title-eyebrow">Comercial</span><h3>Centro de cotizaciones</h3><p>Crear, aprobar, enviar y seguir la respuesta del cliente desde una sola vista.</p></div>
          {canManage && <button type="button" className="tc-btn tc-btn-sm" onClick={() => setCreateOpen(true)}><Plus/>Nueva cotización</button>}
        </div>
        <div className="tc-filterbar">
          <div className="tc-search"><Search/><input className="tc-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar número, cliente o teléfono..." /></div>
          <select className="tc-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        {loading ? <TableSkeleton rows={8} cols={7}/> : <>
          <div className="tc-tablewrap tc-scroll">
            <table className="tc-table tc-quote-table">
              <thead><tr><th>Cotización</th><th>Cliente</th><th>Estado</th><th className="tc-num">Total</th><th>Creada</th><th>Vence</th><th style={{ textAlign: "right" }}>Acción</th></tr></thead>
              <tbody>{payload.quotes.map((row) => <tr key={row.id}>
                <td><div className="tc-strong tc-mono">{row.quote_number}</div>{row.approval_required && !row.approved_at && <div className="tc-cell-sub">Requiere aprobación</div>}</td>
                <td><div className="tc-strong">{row.customer_name_snapshot || "Sin nombre"}</div><div className="tc-cell-sub">{row.customer_phone_snapshot || "Sin teléfono"}</div></td>
                <td><StatusBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge></td>
                <td className="tc-num tc-strong">{money(row.total)}</td>
                <td>{localDate(row.created_at)}</td>
                <td>{row.expires_at ? new Date(row.expires_at).toLocaleDateString("es-DO") : "—"}</td>
                <td><div className="tc-rowactions"><button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" onClick={() => void openDetail(row)}>Ver detalle</button></div></td>
              </tr>)}</tbody>
            </table>
            {!payload.quotes.length && <EmptyState title="Sin cotizaciones" message="No hay cotizaciones que coincidan con el filtro." icon={<FileText size={20}/>} />}
          </div>
          <div className="tc-pagination">
            <span>{firstRow}-{lastRow} de {payload.pagination.total}</span>
            <div className="tc-rowactions">
              <button className="tc-btn tc-btn-ghost tc-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
              <span className="tc-page-indicator">Página {payload.pagination.page} de {payload.pagination.pages}</span>
              <button className="tc-btn tc-btn-ghost tc-btn-sm" disabled={page >= payload.pagination.pages} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
            </div>
          </div>
        </>}
      </section>

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetCreate(); }} title="Nueva cotización" eyebrow="Techcomm Operations">
        <form className="tc-form" onSubmit={createQuote}>
          <label>Cliente
            <select className="tc-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Seleccionar cliente</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name || "Sin nombre"} · {customer.phone}</option>)}
            </select>
          </label>

          <div className="tc-card" style={{ padding: 12 }}>
            <div className="tc-search"><Search/><input className="tc-input" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Buscar SKU, producto, marca o modelo..." /></div>
            {productLoading && <div style={{ padding: 12, color: "var(--muted)" }}><Loader2 className="tc-spin" size={16}/> Buscando inventario...</div>}
            {!!productResults.length && <div className="tc-quote-search-results tc-scroll">{productResults.map((product) => <button key={product.id} type="button" className="tc-quote-search-row" onClick={() => addProduct(product)}>
              <span><strong>{product.piece_name || product.name}</strong><small>{[product.sku, product.brand, product.model].filter(Boolean).join(" · ")}</small></span>
              <span><b>{money(product.sale_price ?? product.price)}</b><small>{product.available_stock} disp.</small></span>
              <PackagePlus size={17}/>
            </button>)}</div>}
          </div>

          <div className="tc-quote-lines">
            {lines.map((line) => <div className="tc-quote-line" key={line.product.id}>
              <div><strong>{line.product.piece_name || line.product.name}</strong><small>{[line.product.sku, line.product.brand, line.product.model].filter(Boolean).join(" · ")}</small></div>
              <label>Cant.<input className="tc-input" type="number" min={1} max={Math.max(1, line.product.available_stock)} value={line.quantity} onChange={(e) => setLines((current) => current.map((item) => item.product.id === line.product.id ? { ...item, quantity: Math.max(1, Math.min(line.product.available_stock, Number(e.target.value) || 1)) } : item))}/></label>
              <label>Desc. %<input className="tc-input" type="number" min={0} max={100} step="0.5" value={line.discountPct} onChange={(e) => setLines((current) => current.map((item) => item.product.id === line.product.id ? { ...item, discountPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : item))}/></label>
              <div className="tc-num"><strong>{money(Number(line.product.sale_price ?? line.product.price ?? 0) * line.quantity)}</strong><small>{line.product.available_stock} disponibles</small></div>
              <button type="button" className="tc-iconbtn" onClick={() => setLines((current) => current.filter((item) => item.product.id !== line.product.id))} aria-label="Quitar"><Trash2/></button>
            </div>)}
            {!lines.length && <EmptyState title="Sin artículos" message="Busca inventario y agrega los productos o piezas que deseas cotizar." icon={<PackagePlus size={20}/>} />}
          </div>

          <div className="tc-form-grid">
            <label style={{ alignSelf: "end" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={includeInstallation} onChange={(e) => setIncludeInstallation(e.target.checked)}/> Incluir instalación</span></label>
            <label style={{ alignSelf: "end" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={includeDelivery} onChange={(e) => setIncludeDelivery(e.target.checked)}/> Incluir entrega</span></label>
            <label className="tc-full">Notas<textarea className="tc-input tc-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones para esta cotización..." /></label>
          </div>
          <div className="tc-notice"><FileText size={16}/><span>Estimado de artículos antes de reglas de aprobación/servicios: <strong>{money(draftEstimate)}</strong>. Las tarifas actuales de instalación/entrega siguen marcadas como provisionales hasta recibir la política oficial.</span></div>
          <div className="tc-form-actions">
            <button type="button" className="tc-btn tc-btn-ghost" onClick={() => { setCreateOpen(false); resetCreate(); }}>Cancelar</button>
            <button type="submit" className="tc-btn" disabled={actionLoading || !lines.length || !customerId}>{actionLoading ? <Loader2 className="tc-spin"/> : <Plus/>}Crear cotización</button>
          </div>
        </form>
      </Modal>

      <Modal open={cancelOpen} onClose={() => { setCancelOpen(false); setCancelReason(""); setCancelNote(""); }} title="Cancelar cotización" eyebrow="Auditoría comercial">
        <form className="tc-form" onSubmit={submitCancel}>
          <div className="tc-notice"><AlertTriangle size={16}/><span>La cancelación quedará registrada en el historial con usuario, fecha y motivo para análisis posterior.</span></div>
          <label>Motivo de cancelación
            <select className="tc-select" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required>
              <option value="">Seleccionar motivo</option>
              {CANCEL_REASONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label>Detalle / observación
            <textarea className="tc-input tc-textarea" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} placeholder="Qué ocurrió, referencia o acción tomada..." maxLength={1000}/>
          </label>
          <div className="tc-form-actions">
            <button type="button" className="tc-btn tc-btn-ghost" onClick={() => { setCancelOpen(false); setCancelReason(""); setCancelNote(""); }}>Volver</button>
            <button type="submit" className="tc-btn" disabled={actionLoading || !cancelReason}>{actionLoading ? <Loader2 className="tc-spin"/> : <XCircle/>}Confirmar cancelación</button>
          </div>
        </form>
      </Modal>

      <Drawer open={Boolean(selected)} onClose={() => { setSelected(null); setDetail(null); setEvents([]); }} title={detail?.quote_number || selected?.quote_number || "Cotización"} eyebrow="Detalle comercial" wide>
        {detailLoading || !detail ? <TableSkeleton rows={7} cols={2}/> : <div style={{ display: "grid", gap: 14 }}>
          <div className="tc-metagrid">
            <div className="tc-metabox"><small>Cliente</small><strong>{detail.customer_name_snapshot || "Sin nombre"}</strong></div>
            <div className="tc-metabox"><small>Estado</small><StatusBadge tone={statusTone(detail.status)}>{statusLabel(detail.status)}</StatusBadge></div>
            <div className="tc-metabox"><small>Total</small><strong>{money(detail.total)}</strong></div>
            <div className="tc-metabox"><small>Vence</small><strong>{detail.expires_at ? new Date(detail.expires_at).toLocaleDateString("es-DO") : "—"}</strong></div>
          </div>

          <div className="tc-metagrid">
            <div className="tc-metabox"><small>Teléfono</small><strong>{detail.customer_phone_snapshot || "—"}</strong></div>
            <div className="tc-metabox"><small>Correo</small><strong>{detail.customer_email_snapshot || "No registrado"}</strong></div>
            <div className="tc-metabox"><small>Último envío</small><strong>{detail.sent_channel || "No enviada"}</strong></div>
            <div className="tc-metabox"><small>Fecha de envío</small><strong>{localDate(detail.sent_at)}</strong></div>
          </div>

          <div className="tc-card">
            <div className="tc-card-head"><div><span className="tc-card-title-eyebrow">Artículos</span><h3>{detail.quote_items.length} línea(s)</h3></div></div>
            <div className="tc-tablewrap tc-scroll"><table className="tc-table"><thead><tr><th>Descripción</th><th className="tc-num">Cantidad</th><th className="tc-num">Precio</th><th className="tc-num">Descuento</th><th className="tc-num">Total</th></tr></thead><tbody>{detail.quote_items.map((item) => <tr key={item.id}><td className="tc-strong">{item.description}</td><td className="tc-num">{item.quantity}</td><td className="tc-num">{money(item.unit_price)}</td><td className="tc-num">{item.discount_amount > 0 ? `-${money(item.discount_amount)}` : "—"}</td><td className="tc-num tc-strong">{money(item.line_total)}</td></tr>)}</tbody></table></div>
          </div>

          <div className="tc-metagrid">
            <div className="tc-metabox"><small>Subtotal</small><strong>{money(detail.subtotal)}</strong></div>
            <div className="tc-metabox"><small>Descuento</small><strong>{detail.discount_amount > 0 ? `-${money(detail.discount_amount)}` : money(0)}</strong></div>
            <div className="tc-metabox"><small>Instalación</small><strong>{detail.installation_included ? money(detail.installation_amount) : "No incluida"}</strong></div>
            <div className="tc-metabox"><small>Entrega</small><strong>{detail.delivery_included ? (detail.delivery_amount > 0 ? money(detail.delivery_amount) : "Incluida") : "No incluida"}</strong></div>
          </div>

          {detail.status === "cancelled" && <div className="tc-notice"><XCircle size={16}/><span><strong>Motivo:</strong> {cancelReasonLabel(detail.cancel_reason_code)}{detail.cancel_reason_note ? ` · ${detail.cancel_reason_note}` : ""}{detail.cancelled_at ? ` · ${localDate(detail.cancelled_at)}` : ""}</span></div>}
          {detail.warranty_note && <div className="tc-notice"><ShieldCheck size={16}/><span>{detail.warranty_note}</span></div>}
          {detail.notes && <div className="tc-notice"><FileText size={16}/><span>{detail.notes}</span></div>}

          <div className="tc-rowactions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            <a className="tc-btn tc-btn-secondary tc-btn-sm" href={previewUrl} target="_blank" rel="noreferrer"><ExternalLink/>Vista cliente</a>
            {canApprove && detail.status === "pending_approval" && <button type="button" className="tc-btn tc-btn-sm" onClick={() => void approveDiscount()} disabled={actionLoading}><ShieldCheck/>Aprobar descuento</button>}
            {canManage && canDeliver && <button type="button" className="tc-btn tc-btn-sm" onClick={() => void sendQuote("whatsapp")} disabled={actionLoading}><Send/>Enviar WhatsApp</button>}
            {canManage && canDeliver && <button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" onClick={() => void sendQuote("email")} disabled={actionLoading || !detail.customer_email_snapshot} title={detail.customer_email_snapshot ? "Enviar cotización por correo" : "El cliente no tiene correo registrado"}><Mail/>{detail.customer_email_snapshot ? "Enviar correo" : "Sin correo"}</button>}
            {canManage && !["accepted", "rejected", "cancelled", "expired"].includes(detail.status) && <button type="button" className="tc-btn tc-btn-ghost tc-btn-sm" onClick={() => setCancelOpen(true)} disabled={actionLoading}><XCircle/>Cancelar</button>}
          </div>

          <div className="tc-card">
            <div className="tc-card-head"><div><span className="tc-card-title-eyebrow">Trazabilidad</span><h3>Historial de la cotización</h3></div></div>
            <div>{events.length ? events.map((event) => <div className="tc-quote-event" key={event.id}><span className="tc-dot"/><div><strong>{eventLabel(event.event_type)}</strong><small>{event.actor_type} · {localDate(event.created_at)}{eventDetail(event) ? ` · ${eventDetail(event)}` : ""}</small></div></div>) : <EmptyState title="Sin eventos" message="La trazabilidad aparecerá aquí a medida que avance la cotización." icon={<Clock3 size={20}/>} />}</div>
          </div>
        </div>}
      </Drawer>
    </div>
  );
}
