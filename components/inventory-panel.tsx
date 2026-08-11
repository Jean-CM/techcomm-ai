"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  Package,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import { EmptyState, Kpi, Modal, StatusBadge, TableSkeleton, type Tone } from "@/components/tc-ui";

type InventoryProduct = {
  id: string;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  piece_name?: string | null;
  description?: string | null;
  item_type?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  model?: string | null;
  supplier?: string | null;
  warehouse_location?: string | null;
  unit_cost?: number | null;
  sale_price?: number | null;
  price?: number | null;
  max_discount_pct?: number | null;
  stock: number;
  reserved_stock: number;
  pending_stock: number;
  min_stock: number;
  available_stock: number;
  inventory_status: "available" | "low" | "out" | "inactive";
  serial_tracking?: boolean;
  lot_tracking?: boolean;
  warranty_days?: number | null;
  last_inventory_at?: string | null;
  updated_at?: string | null;
};

type InventorySummary = {
  total_items: number;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  total_pending: number;
  out_of_stock_items: number;
  low_stock_items: number;
  inventory_cost_value: number;
  inventory_sale_value: number;
};

type InventoryPayload = {
  ok: boolean;
  products: InventoryProduct[];
  summary: InventorySummary;
  facets: { categories: string[]; brands: string[] };
  pagination: { page: number; pageSize: number; total: number; pages: number };
};

type Source = {
  id: string;
  name: string;
  source_type: string;
  connection_mode: string;
  status: string;
  description?: string | null;
  config?: Record<string, unknown> | null;
  last_sync_at?: string | null;
  credential_reference_set?: boolean;
  secret_configured?: boolean;
  location_configured?: boolean;
  configuration_ready?: boolean;
};

const EMPTY_SUMMARY: InventorySummary = {
  total_items: 0,
  total_on_hand: 0,
  total_reserved: 0,
  total_available: 0,
  total_pending: 0,
  out_of_stock_items: 0,
  low_stock_items: 0,
  inventory_cost_value: 0,
  inventory_sale_value: 0,
};

function money(value?: number | null) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 2 }).format(Number(value || 0));
}
function localDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" }) : "—";
}
function typeLabel(value?: string | null) {
  return value === "equipment" ? "Equipo" : value === "part" ? "Pieza" : value === "accessory" ? "Accesorio" : "Producto";
}
function stockLabel(value: InventoryProduct["inventory_status"]) {
  return value === "out" ? "Agotado" : value === "low" ? "Stock bajo" : value === "inactive" ? "Inactivo" : "Disponible";
}
function stockTone(value: InventoryProduct["inventory_status"]): Tone {
  return value === "out" ? "bad" : value === "low" ? "warning" : value === "inactive" ? "neutral" : "good";
}
function sourceStatusLabel(value: string) {
  return value === "active" ? "Activa" : value === "paused" ? "Pausada" : value === "error" ? "Error" : value === "disabled" ? "Deshabilitada" : "Borrador";
}
function sourceStatusTone(value: string): Tone {
  return value === "active" ? "good" : value === "error" ? "bad" : value === "paused" ? "warning" : "neutral";
}
function sourceTypeLabel(value: string) {
  return value === "sql_server" ? "SQL Server" : value === "postgresql" ? "PostgreSQL" : value === "mysql" ? "MySQL" : value === "oracle" ? "Oracle" : value === "api" ? "API" : value === "sftp" ? "SFTP" : value === "sharepoint" ? "SharePoint" : value === "onedrive" ? "OneDrive" : value === "excel_csv" ? "Excel/CSV" : value === "power_bi" ? "Power BI" : "Otro";
}

export default function InventoryPanel({ canEdit = false }: { canEdit?: boolean }) {
  const [payload, setPayload] = useState<InventoryPayload>({ ok: true, products: [], summary: EMPTY_SUMMARY, facets: { categories: [], brands: [] }, pagination: { page: 1, pageSize: 50, total: 0, pages: 1 } });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [query, setQuery] = useState("");
  const [queryDebounced, setQueryDebounced] = useState("");
  const [itemType, setItemType] = useState("all");
  const [stockStatus, setStockStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [sort, setSort] = useState("updated_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [editProduct, setEditProduct] = useState<InventoryProduct | null>(null);
  const [movementProduct, setMovementProduct] = useState<InventoryProduct | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourceActionId, setSourceActionId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setQueryDebounced(query), 280);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => { setPage(1); }, [queryDebounced, itemType, stockStatus, category, brand, sort, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize), q: queryDebounced, type: itemType,
        stockStatus, category, brand, sort,
      });
      const response = await fetch(`/api/crm/inventory?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar inventario.");
      setPayload(data);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No fue posible cargar inventario.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, queryDebounced, itemType, stockStatus, category, brand, sort]);

  useEffect(() => { void load(); }, [load]);

  const firstRow = payload.pagination.total ? (payload.pagination.page - 1) * payload.pagination.pageSize + 1 : 0;
  const lastRow = Math.min(payload.pagination.total, payload.pagination.page * payload.pagination.pageSize);

  const activeFilterLabel = useMemo(() => {
    if (stockStatus === "available") return "Disponibles";
    if (stockStatus === "reserved") return "Con reserva";
    if (stockStatus === "pending") return "Pendientes";
    if (stockStatus === "out") return "Agotados";
    if (stockStatus === "low") return "Stock bajo";
    return "Todo el inventario";
  }, [stockStatus]);

  async function importFile(file: File) {
    setFeedback("Importando catálogo...");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/crm/import-file", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setFeedback(data.error || "No fue posible importar el archivo."); return; }
    setFeedback(`Importación completada: ${data.imported || 0} filas procesadas.`);
    await load();
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editProduct) return;
    const form = new FormData(event.currentTarget);
    setFeedback("Guardando producto...");
    const body = {
      id: editProduct.id,
      sku: form.get("sku"), barcode: form.get("barcode"), name: form.get("name"), piece_name: form.get("piece_name"),
      item_type: form.get("item_type"), category: form.get("category"), subcategory: form.get("subcategory"), brand: form.get("brand"), model: form.get("model"),
      supplier: form.get("supplier"), warehouse_location: form.get("warehouse_location"), unit_cost: Number(form.get("unit_cost") || 0), sale_price: Number(form.get("sale_price") || 0),
      max_discount_pct: Number(form.get("max_discount_pct") || 0) / 100, stock: Number(form.get("stock") || 0), reserved_stock: Number(form.get("reserved_stock") || 0),
      pending_stock: Number(form.get("pending_stock") || 0), min_stock: Number(form.get("min_stock") || 0), warranty_days: Number(form.get("warranty_days") || 0),
      serial_tracking: form.get("serial_tracking") === "on", lot_tracking: form.get("lot_tracking") === "on", description: form.get("description"),
    };
    const response = await fetch("/api/crm/products/update", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setFeedback(data.error || "No fue posible guardar el producto."); return; }
    setEditProduct(null);
    setFeedback("Producto actualizado.");
    await load();
  }

  async function postMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movementProduct) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/crm/inventory/movements", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ product_id: movementProduct.id, movement_type: form.get("movement_type"), quantity: Number(form.get("quantity") || 0), reference_type: form.get("reference_type"), reference_id: form.get("reference_id"), note: form.get("note") }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setFeedback(data.error || "No fue posible registrar el movimiento."); return; }
    setMovementProduct(null);
    setFeedback("Movimiento de inventario registrado y auditado.");
    await load();
  }

  async function refreshSources() {
    setSourcesLoading(true);
    try {
      const response = await fetch("/api/crm/inventory/connections", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No fue posible cargar fuentes.");
      setSources(data.sources || []);
    } catch (error) { setFeedback(error instanceof Error ? error.message : "No fue posible cargar fuentes."); }
    finally { setSourcesLoading(false); }
  }

  async function openSources() {
    setSourcesOpen(true);
    await refreshSources();
  }

  async function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const config = {
      host: String(form.get("host") || ""),
      port: String(form.get("port") || ""),
      database: String(form.get("database") || ""),
      schema: String(form.get("schema") || ""),
      table_or_view: String(form.get("table_or_view") || ""),
    };
    const response = await fetch("/api/crm/inventory/connections", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), source_type: form.get("source_type"), connection_mode: form.get("connection_mode"), schedule: form.get("schedule"), description: form.get("description"), secret_ref: form.get("secret_ref"), config }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setFeedback(data.error || "No fue posible registrar la fuente."); return; }
    event.currentTarget.reset();
    setFeedback("Fuente registrada como borrador. Valídala y actívala solo después de configurar el secreto fuera del CRM.");
    await refreshSources();
  }

  async function sourceAction(source: Source, action: "validate" | "activate" | "pause" | "disable") {
    setSourceActionId(source.id);
    try {
      const response = await fetch("/api/crm/inventory/connections", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: source.id, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No fue posible actualizar la fuente.");
      setFeedback(data.message || (action === "validate" ? "Validación completada." : `Fuente ${action === "activate" ? "activada" : action === "pause" ? "pausada" : "deshabilitada"}.`));
      await refreshSources();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No fue posible actualizar la fuente.");
    } finally {
      setSourceActionId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {feedback && <div className="tc-notice"><AlertTriangle size={16}/><span>{feedback}</span><button type="button" className="tc-linkbtn" style={{ marginLeft: "auto" }} onClick={() => setFeedback("")}>Cerrar</button></div>}

      <div className="tc-inventory-kpis">
        <button className={`tc-kpi-action ${stockStatus === "all" ? "is-active" : ""}`} onClick={() => setStockStatus("all")}><Kpi label="Ítems activos" value={payload.summary.total_items} icon={<Boxes/>} tone="accent" sub={<>Catálogo maestro</>} /></button>
        <button className={`tc-kpi-action ${stockStatus === "available" ? "is-active" : ""}`} onClick={() => setStockStatus("available")}><Kpi label="Disponible" value={payload.summary.total_available} icon={<PackageCheck/>} tone="good" sub={<>{payload.summary.total_on_hand} unidades físicas</>} /></button>
        <button className={`tc-kpi-action ${stockStatus === "reserved" ? "is-active" : ""}`} onClick={() => setStockStatus("reserved")}><Kpi label="Reservado" value={payload.summary.total_reserved} icon={<PackageMinus/>} tone="warning" sub={<>Comprometido</>} /></button>
        <button className={`tc-kpi-action ${stockStatus === "pending" ? "is-active" : ""}`} onClick={() => setStockStatus("pending")}><Kpi label="Pendiente" value={payload.summary.total_pending} icon={<PackagePlus/>} tone="info" sub={<>Por recibir</>} /></button>
        <button className={`tc-kpi-action ${stockStatus === "out" ? "is-active" : ""}`} onClick={() => setStockStatus("out")}><Kpi label="Agotados" value={payload.summary.out_of_stock_items} icon={<AlertTriangle/>} tone={payload.summary.out_of_stock_items ? "bad" : "good"} sub={<>Ítems sin disponible</>} /></button>
        <button className={`tc-kpi-action ${stockStatus === "low" ? "is-active" : ""}`} onClick={() => setStockStatus("low")}><Kpi label="Stock bajo" value={payload.summary.low_stock_items} icon={<Warehouse/>} tone={payload.summary.low_stock_items ? "warning" : "good"} sub={<>En mínimo o debajo</>} /></button>
      </div>

      <section className="tc-card">
        <div className="tc-card-head">
          <div><span className="tc-card-title-eyebrow">Inventario empresarial</span><h3>Productos, equipos, piezas y componentes</h3><p>{activeFilterLabel} · diseñado para catálogos de miles de registros.</p></div>
          <div className="tc-rowactions">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ""; }} />
            <button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" onClick={() => fileRef.current?.click()}><FileSpreadsheet/>Importar Excel/CSV</button>
            <button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" onClick={() => void openSources()}><Database/>Fuentes de datos</button>
            <button type="button" className="tc-iconbtn" onClick={() => void load()} title="Actualizar"><RefreshCw/></button>
          </div>
        </div>

        <div className="tc-filterbar">
          <div className="tc-search"><Search/><input className="tc-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="SKU, código, pieza, equipo, marca, modelo, categoría, proveedor..." /></div>
          <select className="tc-select" value={itemType} onChange={(e) => setItemType(e.target.value)}><option value="all">Todos los tipos</option><option value="equipment">Equipos</option><option value="product">Productos</option><option value="part">Piezas / componentes</option><option value="accessory">Accesorios</option></select>
          <select className="tc-select" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Todas las categorías</option>{payload.facets.categories.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select className="tc-select" value={brand} onChange={(e) => setBrand(e.target.value)}><option value="all">Todas las marcas</option>{payload.facets.brands.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select className="tc-select" value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}><option value="all">Todos los estados</option><option value="available">Disponible</option><option value="reserved">Con reserva</option><option value="pending">Pendiente</option><option value="low">Stock bajo</option><option value="out">Agotado</option></select>
          <select className="tc-select" value={sort} onChange={(e) => setSort(e.target.value)}><option value="updated_desc">Actualizados recientemente</option><option value="name_asc">Nombre A–Z</option><option value="stock_desc">Mayor disponible</option><option value="stock_asc">Menor disponible</option></select>
        </div>

        {loading ? <TableSkeleton rows={10} cols={9}/> : <div className="tc-tablewrap tc-scroll">
          <table className="tc-table tc-inventory-table">
            <thead><tr><th>SKU / Ítem</th><th>Tipo</th><th>Categoría</th><th>Marca / Modelo</th><th>Ubicación</th><th className="tc-num">Disponible</th><th className="tc-num">Reservado</th><th className="tc-num">Pendiente</th><th className="tc-num">Precio</th><th>Estado</th><th>Actualizado</th><th style={{ textAlign: "right" }}>Acción</th></tr></thead>
            <tbody>{payload.products.map((item) => (
              <tr key={item.id}>
                <td><div className="tc-strong">{item.piece_name || item.name}</div><div className="tc-cell-sub tc-mono">{item.sku || "Sin SKU"}{item.barcode ? ` · ${item.barcode}` : ""}</div></td>
                <td>{typeLabel(item.item_type)}</td>
                <td><div>{item.category || "General"}</div><div className="tc-cell-sub">{item.subcategory || "—"}</div></td>
                <td><div>{item.brand || "Sin marca"}</div><div className="tc-cell-sub">{item.model || "Sin modelo"}</div></td>
                <td><div className="tc-truncate">{item.warehouse_location || "Sin ubicación"}</div><div className="tc-cell-sub">{item.supplier || "Sin proveedor"}</div></td>
                <td className="tc-num tc-strong">{item.available_stock}</td>
                <td className="tc-num">{item.reserved_stock}</td>
                <td className="tc-num">{item.pending_stock}</td>
                <td className="tc-num tc-strong">{money(item.sale_price ?? item.price)}</td>
                <td><StatusBadge tone={stockTone(item.inventory_status)}>{stockLabel(item.inventory_status)}</StatusBadge>{item.min_stock > 0 && <div className="tc-cell-sub">Mín. {item.min_stock}</div>}</td>
                <td>{localDate(item.updated_at)}</td>
                <td><div className="tc-rowactions">{canEdit && <><button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" onClick={() => setMovementProduct(item)}>Movimiento</button><button type="button" className="tc-btn tc-btn-ghost tc-btn-sm" onClick={() => setEditProduct(item)}>Editar</button></>}</div></td>
              </tr>
            ))}</tbody>
          </table>
          {!payload.products.length && <EmptyState title="Sin resultados" message="No encontramos ítems con los filtros actuales." icon={<Package size={20}/>} />}
        </div>}

        <div className="tc-pagination">
          <span>{firstRow}–{lastRow} de {payload.pagination.total.toLocaleString("es-DO")} registros</span>
          <div className="tc-rowactions"><select className="tc-select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option value={25}>25 por página</option><option value={50}>50 por página</option><option value={100}>100 por página</option><option value={200}>200 por página</option></select><button className="tc-iconbtn" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft/></button><span className="tc-page-indicator">Página {payload.pagination.page} / {payload.pagination.pages}</span><button className="tc-iconbtn" disabled={page >= payload.pagination.pages} onClick={() => setPage((value) => Math.min(payload.pagination.pages, value + 1))}><ChevronRight/></button></div>
        </div>
      </section>

      <Modal open={Boolean(editProduct)} onClose={() => setEditProduct(null)} title="Ficha de inventario" eyebrow="Catálogo maestro">
        {editProduct && <form className="tc-form" onSubmit={saveProduct}>
          <div className="tc-form-grid">
            <label>SKU<input className="tc-input" name="sku" defaultValue={editProduct.sku || ""}/></label><label>Código / barcode<input className="tc-input" name="barcode" defaultValue={editProduct.barcode || ""}/></label>
            <label>Nombre<input className="tc-input" name="name" defaultValue={editProduct.name} required/></label><label>Pieza / componente<input className="tc-input" name="piece_name" defaultValue={editProduct.piece_name || ""}/></label>
            <label>Tipo<select className="tc-select" name="item_type" defaultValue={editProduct.item_type || "product"}><option value="equipment">Equipo</option><option value="product">Producto</option><option value="part">Pieza / componente</option><option value="accessory">Accesorio</option></select></label><label>Categoría<input className="tc-input" name="category" defaultValue={editProduct.category || ""}/></label>
            <label>Subcategoría<input className="tc-input" name="subcategory" defaultValue={editProduct.subcategory || ""}/></label><label>Marca<input className="tc-input" name="brand" defaultValue={editProduct.brand || ""}/></label>
            <label>Modelo<input className="tc-input" name="model" defaultValue={editProduct.model || ""}/></label><label>Proveedor<input className="tc-input" name="supplier" defaultValue={editProduct.supplier || ""}/></label>
            <label>Ubicación / almacén<input className="tc-input" name="warehouse_location" defaultValue={editProduct.warehouse_location || ""}/></label><label>Garantía (días)<input className="tc-input" type="number" min="0" name="warranty_days" defaultValue={editProduct.warranty_days || 0}/></label>
            <label>Costo unitario<input className="tc-input" type="number" min="0" step="0.01" name="unit_cost" defaultValue={editProduct.unit_cost || 0}/></label><label>Precio venta<input className="tc-input" type="number" min="0" step="0.01" name="sale_price" defaultValue={editProduct.sale_price ?? editProduct.price ?? 0}/></label>
            <label>Descuento máximo (%)<input className="tc-input" type="number" min="0" max="100" step="0.01" name="max_discount_pct" defaultValue={(editProduct.max_discount_pct || 0) * 100}/></label><label>Stock mínimo<input className="tc-input" type="number" min="0" name="min_stock" defaultValue={editProduct.min_stock}/></label>
            <label>Stock físico<input className="tc-input" type="number" min="0" name="stock" defaultValue={editProduct.stock}/></label><label>Reservado<input className="tc-input" type="number" min="0" name="reserved_stock" defaultValue={editProduct.reserved_stock}/></label>
            <label>Pendiente por recibir<input className="tc-input" type="number" min="0" name="pending_stock" defaultValue={editProduct.pending_stock}/></label><span/>
            <label><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><input type="checkbox" name="serial_tracking" defaultChecked={editProduct.serial_tracking}/> Controlar serial / IMEI</span></label><label><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><input type="checkbox" name="lot_tracking" defaultChecked={editProduct.lot_tracking}/> Controlar lote</span></label>
            <label className="tc-full">Descripción<textarea className="tc-input tc-textarea" name="description" defaultValue={editProduct.description || ""}/></label>
          </div>
          <div className="tc-form-actions"><button type="button" className="tc-btn tc-btn-ghost" onClick={() => setEditProduct(null)}>Cancelar</button><button className="tc-btn" type="submit">Guardar ficha</button></div>
        </form>}
      </Modal>

      <Modal open={Boolean(movementProduct)} onClose={() => setMovementProduct(null)} title="Movimiento de inventario" eyebrow="Trazabilidad">
        {movementProduct && <form className="tc-form" onSubmit={postMovement}>
          <div className="tc-notice"><Package size={16}/><span><strong>{movementProduct.piece_name || movementProduct.name}</strong> · {movementProduct.available_stock} disponibles · {movementProduct.reserved_stock} reservados · {movementProduct.pending_stock} pendientes.</span></div>
          <div className="tc-form-grid">
            <label>Movimiento<select className="tc-select" name="movement_type" required><option value="receipt">Entrada / recepción</option><option value="issue">Salida / consumo</option><option value="reserve">Reservar</option><option value="release">Liberar reserva</option><option value="pending_add">Agregar pendiente por recibir</option><option value="pending_receive">Recibir pendiente</option><option value="pending_cancel">Cancelar pendiente</option><option value="return">Devolución al inventario</option><option value="transfer_in">Transferencia entrada</option><option value="transfer_out">Transferencia salida</option></select></label>
            <label>Cantidad<input className="tc-input" type="number" min="1" name="quantity" defaultValue="1" required/></label>
            <label>Referencia<select className="tc-select" name="reference_type"><option value="manual">Manual</option><option value="purchase_order">Orden de compra</option><option value="work_order">Orden de trabajo</option><option value="sale">Venta</option><option value="transfer">Transferencia</option></select></label>
            <label>ID / documento<input className="tc-input" name="reference_id" placeholder="OC-001, OT-00032..."/></label>
            <label className="tc-full">Nota<textarea className="tc-input tc-textarea" name="note" placeholder="Motivo o detalle del movimiento"/></label>
          </div>
          <div className="tc-form-actions"><button type="button" className="tc-btn tc-btn-ghost" onClick={() => setMovementProduct(null)}>Cancelar</button><button className="tc-btn" type="submit">Registrar movimiento</button></div>
        </form>}
      </Modal>

      <Modal open={sourcesOpen} onClose={() => setSourcesOpen(false)} title="Fuentes de inventario" eyebrow="Integraciones">
        <div className="tc-notice"><ShieldCheck size={16}/><span><strong>Integración protegida:</strong> las credenciales reales no se almacenan en la tabla de configuración. Las sincronizaciones por agente/API se autentican con HMAC SHA-256, timestamp y una ventana máxima de 5 minutos para reducir replay attacks.</span></div>
        <div className="tc-metagrid">
          <div className="tc-metabox"><small>Credenciales</small><strong><KeyRound size={14}/> Fuera del CRM</strong><div className="tc-cell-sub">Solo se guarda una referencia de secreto.</div></div>
          <div className="tc-metabox"><small>Transporte</small><strong><ShieldCheck size={14}/> HTTPS + HMAC</strong><div className="tc-cell-sub">Firma del cuerpo antes de aceptar datos.</div></div>
          <div className="tc-metabox"><small>Sincronización</small><strong><Clock3 size={14}/> Auditable</strong><div className="tc-cell-sub">Cada ejecución puede registrar filas leídas/escritas.</div></div>
        </div>

        {sourcesLoading ? <div style={{ display: "grid", placeItems: "center", minHeight: 90 }}><Loader2 className="tc-spin"/></div> : <div style={{ display: "grid", gap: 8 }}>
          {sources.map((source) => <div className="tc-metabox" key={source.id}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div><small>{sourceTypeLabel(source.source_type)} · {source.connection_mode}</small><strong>{source.name}</strong></div>
              <StatusBadge tone={sourceStatusTone(source.status)}>{sourceStatusLabel(source.status)}</StatusBadge>
            </div>
            <div className="tc-cell-sub" style={{ marginTop: 6 }}>Última sync: {localDate(source.last_sync_at)} · Ubicación: {source.location_configured ? "configurada" : "pendiente"} · Secreto: {source.secret_configured ? "configurado" : source.credential_reference_set ? "referenciado, falta entorno" : "pendiente"}</div>
            <div className="tc-rowactions" style={{ marginTop: 9, justifyContent: "flex-start" }}>
              <button type="button" className="tc-btn tc-btn-ghost tc-btn-sm" disabled={sourceActionId === source.id} onClick={() => void sourceAction(source, "validate")}>{sourceActionId === source.id ? <Loader2 className="tc-spin"/> : <ShieldCheck/>}Validar</button>
              {source.status === "active" ? <button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" disabled={sourceActionId === source.id} onClick={() => void sourceAction(source, "pause")}><PauseCircle/>Pausar</button> : <button type="button" className="tc-btn tc-btn-secondary tc-btn-sm" disabled={sourceActionId === source.id} onClick={() => void sourceAction(source, "activate")}><PlayCircle/>Activar</button>}
            </div>
          </div>)}
          {!sources.length && <EmptyState title="Sin fuentes configuradas" message="Puedes registrar la primera conexión debajo. Se creará como borrador y no recibirá datos hasta que pase validación y sea activada." icon={<Database size={20}/>} />}
        </div>}

        <form className="tc-form" onSubmit={createSource}>
          <div className="tc-form-grid">
            <label>Nombre<input className="tc-input" name="name" placeholder="ERP / Inventario central" required/></label>
            <label>Motor<select className="tc-select" name="source_type" defaultValue="sql_server"><option value="sql_server">SQL Server</option><option value="postgresql">PostgreSQL</option><option value="mysql">MySQL</option><option value="oracle">Oracle</option><option value="api">API</option><option value="sftp">SFTP</option><option value="sharepoint">SharePoint</option><option value="onedrive">OneDrive</option><option value="excel_csv">Excel / CSV</option><option value="power_bi">Power BI</option><option value="other">Otro</option></select></label>
            <label>Modo<select className="tc-select" name="connection_mode" defaultValue="push_agent"><option value="push_agent">Agente dentro de red (recomendado)</option><option value="api_pull">API pull</option><option value="file_drop">Carpeta / file drop</option><option value="private_network">Red privada</option><option value="manual_upload">Carga manual</option></select></label>
            <label>Frecuencia<select className="tc-select" name="schedule" defaultValue="manual"><option value="manual">Manual / controlada por agente</option><option value="every_5_minutes">Cada 5 minutos</option><option value="every_15_minutes">Cada 15 minutos</option><option value="hourly">Cada hora</option><option value="daily">Diaria</option></select></label>
            <label>Host<input className="tc-input" name="host" placeholder="servidor-interno"/></label>
            <label>Puerto<input className="tc-input" name="port" placeholder="1433 / 5432 / 3306"/></label><label>Base de datos<input className="tc-input" name="database"/></label>
            <label>Schema<input className="tc-input" name="schema" placeholder="dbo / public"/></label><label className="tc-full">Tabla, vista o recurso<input className="tc-input" name="table_or_view" placeholder="vw_inventario / endpoint de catálogo"/></label>
            <label className="tc-full">Referencia de secreto<input className="tc-input" name="secret_ref" placeholder="TECHCOMM_INV_ERP_PROD_SECRET"/><span className="tc-cell-sub">Nunca pegues usuario, contraseña, token ni connection string. Este valor debe ser solo el nombre de una variable segura configurada fuera del CRM.</span></label>
            <label className="tc-full">Descripción<textarea className="tc-input tc-textarea" name="description" placeholder="Qué datos alimentará, sistema de origen y observaciones operativas"/></label>
          </div>
          <div className="tc-form-actions"><button type="submit" className="tc-btn"><Settings2/>Registrar fuente segura</button></div>
        </form>
      </Modal>
    </div>
  );
}
