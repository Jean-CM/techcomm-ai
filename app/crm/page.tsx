"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./crm.module.css";

type Customer = {
  id: string;
  full_name?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  sector?: string | null;
  source?: string | null;
};

type Product = {
  id: string;
  sku?: string | null;
  name: string;
  piece_name?: string | null;
  description?: string | null;
  item_type?: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  unit_cost?: number | null;
  sale_price?: number | null;
  price?: number | null;
  max_discount_pct?: number | null;
  minimum_authorized_price?: number | null;
  installation_price?: number | null;
  delivery_price?: number | null;
  installation_includes_delivery?: boolean | null;
  stock: number;
  reserved_stock: number;
  active?: boolean;
};

type Technician = {
  id: string;
  full_name: string;
  phone?: string | null;
  specialties?: string[] | null;
  zones?: string[] | null;
  status: string;
  whatsapp_enabled?: boolean;
};

type Appointment = {
  id: string;
  customer_id?: string | null;
  technician_id?: string | null;
  starts_at: string;
  status: string;
  technician_confirmation_status?: string | null;
  notes?: string | null;
};

type WorkOrder = {
  id: string;
  order_number: string;
  customer_id?: string | null;
  technician_id?: string | null;
  equipment?: string | null;
  issue?: string | null;
  status: string;
};

type Quote = {
  id: string;
  quote_number: string;
  customer_id?: string | null;
  status: string;
  total?: number | null;
};

type Sale = {
  id: string;
  customer_id?: string | null;
  quantity: number;
  unit_price: number;
  status: string;
};

type CallEvent = {
  id: string;
  conversation_id: string;
  customer_phone?: string | null;
  status?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type Overview = {
  ok: boolean;
  customers: Customer[];
  products: Product[];
  technicians: Technician[];
  appointments: Appointment[];
  work_orders: WorkOrder[];
  quotes: Quote[];
  sales: Sale[];
  call_events: CallEvent[];
};

type EditState =
  | { kind: "customer"; item: Customer }
  | { kind: "technician"; item: Technician }
  | { kind: "product"; item: Product }
  | null;

const emptyOverview: Overview = {
  ok: true,
  customers: [],
  products: [],
  technicians: [],
  appointments: [],
  work_orders: [],
  quotes: [],
  sales: [],
  call_events: [],
};

const menu = ["Dashboard", "Conversaciones", "Clientes", "Agenda", "Técnicos", "Órdenes", "Ventas", "Productos", "Cotizaciones"];

function money(value?: number | null) {
  return value == null
    ? "Por confirmar"
    : new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
        maximumFractionDigits: 2,
      }).format(value);
}

function cleanPhone(value?: string | null) {
  return (value || "").replace(/\D/g, "").replace(/^1(?=8(?:09|29|49))/, "");
}

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    available: "Disponible",
    busy: "Ocupado",
    unavailable: "No disponible",
    done: "Completada",
    scheduled: "Programada",
    confirmed: "Confirmada",
    pending: "Pendiente",
    new: "Nueva",
    sent: "Enviada",
    accepted: "Aceptada",
    draft: "Borrador",
  };
  return value ? labels[value] ?? value : "Pendiente";
}

function channelLabel(event: CallEvent) {
  const raw = String(event.metadata?.channel ?? event.metadata?.source ?? "").toLowerCase();
  return raw.includes("whatsapp") ? "WhatsApp" : "Llamada";
}

function itemTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    product: "Producto",
    equipment: "Equipo",
    part: "Pieza",
    accessory: "Accesorio",
  };
  return labels[value || ""] ?? "Producto";
}

export default function CrmPage() {
  const [active, setActive] = useState("Dashboard");
  const [data, setData] = useState<Overview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [edit, setEdit] = useState<EditState>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("all");
  const [productBrand, setProductBrand] = useState("all");
  const [productType, setProductType] = useState("all");
  const [productStock, setProductStock] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/crm/overview", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No fue posible cargar el CRM.");
      setData(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al cargar el CRM.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const customersById = useMemo(() => new Map(data.customers.map((item) => [item.id, item])), [data.customers]);
  const customersByPhone = useMemo(() => new Map(data.customers.map((item) => [cleanPhone(item.phone), item])), [data.customers]);
  const techniciansById = useMemo(() => new Map(data.technicians.map((item) => [item.id, item])), [data.technicians]);
  const today = new Date().toISOString().slice(0, 10);
  const appointmentsToday = data.appointments.filter((item) => item.starts_at?.startsWith(today)).length;
  const lowStock = data.products.filter((item) => Math.max(0, item.stock - item.reserved_stock) <= 2).length;

  const productCategories = useMemo(
    () => [...new Set(data.products.map((item) => item.category?.trim()).filter((value): value is string => Boolean(value)))].sort(),
    [data.products],
  );
  const productBrands = useMemo(
    () => [...new Set(data.products.map((item) => item.brand?.trim()).filter((value): value is string => Boolean(value)))].sort(),
    [data.products],
  );

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    return data.products.filter((item) => {
      const available = Math.max(0, Number(item.stock || 0) - Number(item.reserved_stock || 0));
      const haystack = [item.sku, item.name, item.piece_name, item.description, item.category, item.brand, item.model]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (search && !haystack.includes(search)) return false;
      if (productCategory !== "all" && item.category !== productCategory) return false;
      if (productBrand !== "all" && item.brand !== productBrand) return false;
      if (productType !== "all" && item.item_type !== productType) return false;
      if (productStock === "available" && available <= 0) return false;
      if (productStock === "low" && !(available > 0 && available <= 2)) return false;
      if (productStock === "out" && available > 0) return false;
      return true;
    });
  }, [data.products, productBrand, productCategory, productSearch, productStock, productType]);

  async function importCatalog(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(`Procesando ${file.name}...`);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/crm/import-file", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No fue posible importar.");
      setMessage(`Importación completada: ${payload.imported} registros; ${payload.rejected || 0} filas ignoradas.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al importar.");
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit) return;
    const form = new FormData(event.currentTarget);
    setMessage("Guardando cambios...");
    let url = "";
    let body: Record<string, unknown> = {};

    if (edit.kind === "customer") {
      url = "/api/crm/customers/update";
      body = {
        id: edit.item.id,
        full_name: form.get("full_name"),
        phone: form.get("phone"),
        email: form.get("email"),
        address: form.get("address"),
        sector: form.get("sector"),
      };
    }

    if (edit.kind === "technician") {
      url = "/api/crm/technicians/update";
      body = {
        id: edit.item.id,
        full_name: form.get("full_name"),
        phone: form.get("phone"),
        specialties: form.get("specialties"),
        zones: form.get("zones"),
        status: form.get("status"),
        whatsapp_enabled: form.get("whatsapp_enabled") === "on",
      };
    }

    if (edit.kind === "product") {
      url = "/api/crm/products/update";
      body = {
        id: edit.item.id,
        sku: form.get("sku"),
        name: form.get("name"),
        piece_name: form.get("piece_name"),
        description: form.get("description"),
        item_type: form.get("item_type"),
        category: form.get("category"),
        brand: form.get("brand"),
        model: form.get("model"),
        unit_cost: Number(form.get("unit_cost") || 0),
        sale_price: Number(form.get("sale_price") || 0),
        max_discount_pct: Number(form.get("max_discount_pct") || 0) / 100,
        stock: Number(form.get("stock") || 0),
        reserved_stock: Number(form.get("reserved_stock") || 0),
        installation_price: Number(form.get("installation_price") || 0),
        delivery_price: Number(form.get("delivery_price") || 0),
        installation_includes_delivery: form.get("installation_includes_delivery") === "on",
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "No fue posible guardar.");
      return;
    }
    setEdit(null);
    setMessage("Cambios guardados correctamente.");
    await load();
  }

  const empty = (text: string) => (
    <div className={styles.placeholder}>
      <p>{text}</p>
    </div>
  );

  const editButton = (onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{ border: "1px solid #315873", background: "#10283a", color: "#caeaff", borderRadius: 10, padding: "9px 13px", cursor: "pointer" }}
    >
      Editar
    </button>
  );

  const filterControlStyle = {
    minWidth: 150,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #2a5069",
    background: "#0f2a3e",
    color: "white",
  } as const;

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.identity}>
          <div>
            <h2>
              Techcomm <span>Operations</span>
            </h2>
            <p>Centro de operaciones</p>
          </div>
        </div>
        <nav>
          {menu.map((item) => (
            <button className={active === item ? styles.active : ""} key={item} onClick={() => setActive(item)}>
              {item}
            </button>
          ))}
        </nav>
        <div className={styles.channelStatus}>
          <span /> Supabase conectado
          <br />
          <span /> WhatsApp y voz activos
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}>
          <div>
            <small>OPERACIÓN EN TIEMPO REAL</small>
            <h1>{active}</h1>
          </div>
          <div className={styles.headerActions}>
            <button type="button" onClick={() => void load()}>Actualizar</button>
            <div className={styles.avatar}>JC</div>
          </div>
        </header>

        {message && <section className={styles.notice}>{message}</section>}
        {loading && empty("Cargando datos desde Supabase...")}

        {!loading && active === "Dashboard" && (
          <>
            <div className={styles.metrics}>
              <article>
                <small>Conversaciones</small>
                <strong>{data.call_events.length}</strong>
                <span>WhatsApp y llamadas</span>
              </article>
              <article>
                <small>Citas de hoy</small>
                <strong>{appointmentsToday}</strong>
                <span>{data.appointments.length} en agenda</span>
              </article>
              <article>
                <small>Órdenes activas</small>
                <strong>{data.work_orders.filter((item) => !["completed", "cancelled"].includes(item.status)).length}</strong>
                <span>{data.work_orders.length} totales</span>
              </article>
              <article>
                <small>Alertas</small>
                <strong>{lowStock}</strong>
                <span>Productos con stock bajo</span>
              </article>
            </div>
            <div className={styles.gridTwo}>
              <section className={styles.card}>
                <div className={styles.cardTitle}>
                  <div>
                    <small>ACTIVIDAD RECIENTE</small>
                    <h3>Conversaciones</h3>
                  </div>
                  <button onClick={() => setActive("Conversaciones")}>Ver todas</button>
                </div>
                {data.call_events.length
                  ? data.call_events.slice(0, 4).map((item) => {
                      const customer = customersByPhone.get(cleanPhone(item.customer_phone));
                      return (
                        <div className={styles.conversation} key={item.id}>
                          <div className={styles.channel}>{channelLabel(item) === "WhatsApp" ? "W" : "☎"}</div>
                          <div>
                            <strong>{customer?.full_name?.trim() || "Sin nombre registrado"}</strong>
                            <p>{item.summary || "Sin resumen"}</p>
                            <small>{channelLabel(item)} · {item.customer_phone || "Sin teléfono"}</small>
                          </div>
                          <div>
                            <span>{statusLabel(item.status)}</span>
                            <small>{new Date(item.created_at).toLocaleString("es-DO")}</small>
                          </div>
                        </div>
                      );
                    })
                  : empty("No hay conversaciones registradas.")}
              </section>

              <section className={styles.card}>
                <div className={styles.cardTitle}>
                  <div>
                    <small>PRÓXIMAS VISITAS</small>
                    <h3>Agenda</h3>
                  </div>
                  <button onClick={() => setActive("Agenda")}>Abrir</button>
                </div>
                {data.appointments.length
                  ? data.appointments.slice(0, 4).map((item) => (
                      <div className={styles.scheduleRow} key={item.id}>
                        <div>
                          <strong>{new Date(item.starts_at).toLocaleString("es-DO")}</strong>
                          <p>{customersById.get(item.customer_id || "")?.full_name || "Sin nombre registrado"} · {item.notes || "Servicio"}</p>
                        </div>
                        <span>{techniciansById.get(item.technician_id || "")?.full_name || "Sin técnico"}</span>
                        <span>{statusLabel(item.status)}</span>
                      </div>
                    ))
                  : empty("No hay citas registradas.")}
              </section>
            </div>
          </>
        )}

        {!loading && active === "Conversaciones" && (
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <div>
                <small>HISTORIAL</small>
                <h3>WhatsApp y llamadas registradas</h3>
              </div>
            </div>
            {data.call_events.length
              ? data.call_events.map((item, index) => {
                  const customer = customersByPhone.get(cleanPhone(item.customer_phone));
                  return (
                    <div className={styles.conversation} key={item.id}>
                      <div className={styles.channel}>{index + 1}</div>
                      <div>
                        <strong>{customer?.full_name?.trim() || "Sin nombre registrado"}</strong>
                        <p>{item.summary || "Sin resumen"}</p>
                        <small>{channelLabel(item)} · {item.customer_phone || "Sin teléfono"}</small>
                      </div>
                      <div>
                        <span>{statusLabel(item.status)}</span>
                        <small>{new Date(item.created_at).toLocaleString("es-DO")}</small>
                      </div>
                    </div>
                  );
                })
              : empty("No hay conversaciones registradas.")}
          </section>
        )}

        {!loading && active === "Clientes" && (
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <div>
                <small>BASE PROPIA</small>
                <h3>Clientes</h3>
              </div>
            </div>
            {data.customers.length
              ? data.customers.map((item, index) => (
                  <div className={styles.dataRow} key={item.id}>
                    <strong>#{index + 1}</strong>
                    <div>
                      <strong>{item.full_name?.trim() || "Sin nombre registrado"}</strong>
                      <p>{item.phone}</p>
                    </div>
                    <span>{item.address || "Sin dirección"}</span>
                    <span>{item.source || "crm"}</span>
                    {editButton(() => setEdit({ kind: "customer", item }))}
                  </div>
                ))
              : empty("La base se llenará con WhatsApp, llamadas y atención presencial.")}
          </section>
        )}

        {!loading && active === "Técnicos" && (
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <div>
                <small>EQUIPO DE CAMPO</small>
                <h3>Técnicos</h3>
              </div>
            </div>
            {data.technicians.length
              ? data.technicians.map((item) => (
                  <div className={styles.technicianRow} key={item.id}>
                    <div>
                      <strong>{item.full_name}</strong>
                      <p>{item.phone || "Sin WhatsApp"} · {(item.specialties || []).join(", ") || "Sin especialidad"}</p>
                    </div>
                    <span>{statusLabel(item.status)}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span>{item.whatsapp_enabled ? "WhatsApp activo" : "WhatsApp desactivado"}</span>
                      {editButton(() => setEdit({ kind: "technician", item }))}
                    </div>
                  </div>
                ))
              : empty("No hay técnicos registrados.")}
          </section>
        )}

        {!loading && active === "Productos" && (
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <div>
                <small>INVENTARIO</small>
                <h3>Productos, equipos y piezas</h3>
              </div>
              <div className={styles.actions}>
                <label className={styles.importButton}>
                  Importar XLSX/CSV
                  <input hidden type="file" accept=".xlsx,.xls,.csv" onChange={importCatalog} />
                </label>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "14px 0 18px", borderTop: "1px solid #19364b" }}>
              <input
                aria-label="Buscar producto"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Buscar por nombre, modelo, marca, SKU o pieza..."
                style={{ ...filterControlStyle, flex: "1 1 280px" }}
              />
              <select aria-label="Filtrar categoría" value={productCategory} onChange={(event) => setProductCategory(event.target.value)} style={filterControlStyle}>
                <option value="all">Todas las categorías</option>
                {productCategories.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select aria-label="Filtrar marca" value={productBrand} onChange={(event) => setProductBrand(event.target.value)} style={filterControlStyle}>
                <option value="all">Todas las marcas</option>
                {productBrands.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select aria-label="Filtrar tipo" value={productType} onChange={(event) => setProductType(event.target.value)} style={filterControlStyle}>
                <option value="all">Todos los tipos</option>
                <option value="equipment">Equipos</option>
                <option value="product">Productos</option>
                <option value="part">Piezas</option>
                <option value="accessory">Accesorios</option>
              </select>
              <select aria-label="Filtrar inventario" value={productStock} onChange={(event) => setProductStock(event.target.value)} style={filterControlStyle}>
                <option value="all">Todo el inventario</option>
                <option value="available">Disponible</option>
                <option value="low">Stock bajo</option>
                <option value="out">Agotado</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setProductSearch("");
                  setProductCategory("all");
                  setProductBrand("all");
                  setProductType("all");
                  setProductStock("all");
                }}
                style={{ ...filterControlStyle, cursor: "pointer" }}
              >
                Limpiar filtros
              </button>
            </div>

            <div style={{ color: "#9db4c5", paddingBottom: 12 }}>
              Mostrando <strong style={{ color: "white" }}>{filteredProducts.length}</strong> de {data.products.length} registros.
            </div>

            {filteredProducts.length ? (
              <div style={{ overflowX: "auto", border: "1px solid #19364b", borderRadius: 14 }}>
                <div style={{ minWidth: 1050 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "70px minmax(300px,1.8fr) 170px 180px 190px 100px", gap: 14, padding: "13px 16px", background: "#102b3f", color: "#8fdcff", fontWeight: 800 }}>
                    <span>N.º</span>
                    <span>Producto / pieza</span>
                    <span>Tipo</span>
                    <span>Precio</span>
                    <span>Inventario</span>
                    <span>Acción</span>
                  </div>
                  {filteredProducts.map((item, index) => {
                    const available = Math.max(0, item.stock - item.reserved_stock);
                    return (
                      <div key={item.id} style={{ display: "grid", gridTemplateColumns: "70px minmax(300px,1.8fr) 170px 180px 190px 100px", gap: 14, alignItems: "center", padding: "15px 16px", borderTop: "1px solid #19364b" }}>
                        <strong>#{index + 1}</strong>
                        <div>
                          <strong>{item.piece_name || item.name}</strong>
                          <p style={{ margin: "5px 0", color: "#9db4c5" }}>{item.brand || "Sin marca"} · {item.model || "Sin modelo"}</p>
                          <small style={{ color: "#7f9aad" }}>{item.sku || "Sin SKU"} · {item.category || "General"}</small>
                        </div>
                        <span>{itemTypeLabel(item.item_type)}</span>
                        <div>
                          <strong>{money(item.sale_price ?? item.price)}</strong>
                          <small style={{ display: "block", color: "#7f9aad", marginTop: 5 }}>Mínimo: {money(item.minimum_authorized_price)}</small>
                        </div>
                        <div>
                          <strong>{available > 0 ? `${available} disponible(s)` : "Agotado"}</strong>
                          <small style={{ display: "block", color: "#7f9aad", marginTop: 5 }}>{item.stock} total · {item.reserved_stock} reservado(s)</small>
                        </div>
                        {editButton(() => setEdit({ kind: "product", item }))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : empty("No hay productos que coincidan con los filtros.")}
          </section>
        )}

        {!loading && active === "Agenda" && (
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <div><small>AGENDA</small><h3>Visitas programadas</h3></div>
            </div>
            {data.appointments.length
              ? data.appointments.map((item) => (
                  <div className={styles.scheduleRow} key={item.id}>
                    <div>
                      <strong>{new Date(item.starts_at).toLocaleString("es-DO")}</strong>
                      <p>{customersById.get(item.customer_id || "")?.full_name || "Sin nombre registrado"} · {item.notes || "Servicio"}</p>
                    </div>
                    <span>{techniciansById.get(item.technician_id || "")?.full_name || "Sin técnico"}</span>
                    <span>{statusLabel(item.status)}</span>
                  </div>
                ))
              : empty("No hay citas registradas.")}
          </section>
        )}

        {!loading && active === "Órdenes" && (
          <section className={styles.card}>
            {data.work_orders.length
              ? data.work_orders.map((item, index) => (
                  <div className={styles.dataRow} key={item.id}>
                    <strong>#{index + 1}</strong>
                    <strong>{item.order_number}</strong>
                    <span>{customersById.get(item.customer_id || "")?.full_name || "Sin nombre registrado"}</span>
                    <span>{item.equipment || "Equipo"}</span>
                    <span>{techniciansById.get(item.technician_id || "")?.full_name || "Sin técnico"}</span>
                    <span>{statusLabel(item.status)}</span>
                  </div>
                ))
              : empty("No hay órdenes registradas.")}
          </section>
        )}

        {!loading && active === "Cotizaciones" && (
          <section className={styles.card}>
            {data.quotes.length
              ? data.quotes.map((item) => (
                  <div className={styles.dataRow} key={item.id}>
                    <strong>{item.quote_number}</strong>
                    <span>{customersById.get(item.customer_id || "")?.full_name || "Sin nombre registrado"}</span>
                    <span>{money(item.total)}</span>
                    <span>{statusLabel(item.status)}</span>
                  </div>
                ))
              : empty("No hay cotizaciones registradas.")}
          </section>
        )}

        {!loading && active === "Ventas" && (
          <section className={styles.card}>
            {data.sales.length
              ? data.sales.map((item) => (
                  <div className={styles.dataRow} key={item.id}>
                    <strong>{customersById.get(item.customer_id || "")?.full_name || "Sin nombre registrado"}</strong>
                    <span>{item.quantity} unidad(es)</span>
                    <span>{money(item.unit_price)}</span>
                    <span>{statusLabel(item.status)}</span>
                  </div>
                ))
              : empty("No hay ventas registradas.")}
          </section>
        )}
      </section>

      {edit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", display: "grid", placeItems: "center", padding: 20, zIndex: 100 }}>
          <form onSubmit={saveEdit} style={{ width: "min(680px,100%)", maxHeight: "90vh", overflow: "auto", background: "#0b1d2c", border: "1px solid #315873", borderRadius: 18, padding: 24, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center" }}>
              <div>
                <small style={{ color: "#27c4ff", fontWeight: 800 }}>TECHCOMM OPERATIONS</small>
                <h2 style={{ margin: "6px 0 0", fontSize: 28 }}>Editar {edit.kind === "customer" ? "cliente" : edit.kind === "technician" ? "técnico" : "producto"}</h2>
              </div>
              <button type="button" onClick={() => setEdit(null)} style={{ background: "transparent", border: 0, color: "white", fontSize: 24, cursor: "pointer" }}>×</button>
            </div>

            {edit.kind === "customer" && (
              <>
                <label>Nombre completo<input className="input" name="full_name" defaultValue={edit.item.full_name || ""} required /></label>
                <label>Teléfono<input className="input" name="phone" defaultValue={edit.item.phone} /></label>
                <label>Correo<input className="input" name="email" defaultValue={edit.item.email || ""} /></label>
                <label>Dirección<input className="input" name="address" defaultValue={edit.item.address || ""} /></label>
                <label>Sector<input className="input" name="sector" defaultValue={edit.item.sector || ""} /></label>
              </>
            )}

            {edit.kind === "technician" && (
              <>
                <label>Nombre completo<input className="input" name="full_name" defaultValue={edit.item.full_name} required /></label>
                <label>Número de WhatsApp<input className="input" name="phone" defaultValue={edit.item.phone || ""} required /></label>
                <label>Especialidades separadas por coma<input className="input" name="specialties" defaultValue={(edit.item.specialties || []).join(", ")} /></label>
                <label>Zonas separadas por coma<input className="input" name="zones" defaultValue={(edit.item.zones || []).join(", ")} /></label>
                <label>Disponibilidad<select className="input" name="status" defaultValue={edit.item.status}><option value="available">Disponible</option><option value="busy">Ocupado</option><option value="unavailable">No disponible</option></select></label>
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" name="whatsapp_enabled" defaultChecked={edit.item.whatsapp_enabled !== false} /> Recibir notificaciones por WhatsApp</label>
              </>
            )}

            {edit.kind === "product" && (
              <>
                <label>SKU<input className="input" name="sku" defaultValue={edit.item.sku || ""} /></label>
                <label>Nombre del producto<input className="input" name="name" defaultValue={edit.item.name || ""} required /></label>
                <label>Nombre de la pieza<input className="input" name="piece_name" defaultValue={edit.item.piece_name || ""} /></label>
                <label>Descripción<textarea className="input" name="description" defaultValue={edit.item.description || ""} rows={3} /></label>
                <label>Tipo<select className="input" name="item_type" defaultValue={edit.item.item_type || "product"}><option value="equipment">Equipo</option><option value="product">Producto</option><option value="part">Pieza</option><option value="accessory">Accesorio</option></select></label>
                <label>Categoría<input className="input" name="category" defaultValue={edit.item.category || ""} /></label>
                <label>Marca<input className="input" name="brand" defaultValue={edit.item.brand || ""} /></label>
                <label>Modelo<input className="input" name="model" defaultValue={edit.item.model || ""} /></label>
                <label>Costo unitario<input className="input" type="number" step="0.01" name="unit_cost" defaultValue={edit.item.unit_cost || 0} /></label>
                <label>Precio de venta<input className="input" type="number" step="0.01" name="sale_price" defaultValue={edit.item.sale_price ?? edit.item.price ?? 0} /></label>
                <label>Descuento máximo (%)<input className="input" type="number" step="0.01" min="0" max="100" name="max_discount_pct" defaultValue={(edit.item.max_discount_pct || 0) * 100} /></label>
                <label>Stock total<input className="input" type="number" name="stock" defaultValue={edit.item.stock} /></label>
                <label>Stock reservado<input className="input" type="number" name="reserved_stock" defaultValue={edit.item.reserved_stock} /></label>
                <label>Costo de instalación<input className="input" type="number" step="0.01" name="installation_price" defaultValue={edit.item.installation_price || 0} /></label>
                <label>Costo de envío<input className="input" type="number" step="0.01" name="delivery_price" defaultValue={edit.item.delivery_price || 0} /></label>
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" name="installation_includes_delivery" defaultChecked={Boolean(edit.item.installation_includes_delivery)} /> La instalación incluye envío gratis</label>
              </>
            )}

            <button className="button" type="submit">Guardar cambios</button>
          </form>
        </div>
      )}
    </main>
  );
}
