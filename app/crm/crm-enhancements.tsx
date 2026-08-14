"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./crm-enhancements.module.css";

type Customer = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  sector?: string | null;
  province?: string | null;
  municipality?: string | null;
  address_reference_1?: string | null;
  address_reference_2?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_precision?: string | null;
};

type WorkOrder = {
  id: string;
  order_number: string;
  customer_id?: string | null;
  technician_id?: string | null;
  service_category?: string | null;
  status: string;
  issue?: string | null;
};

type Technician = { id: string; full_name: string };

type Overview = {
  customers?: Customer[];
  work_orders?: WorkOrder[];
  technicians?: Technician[];
};

const CLOSED = new Set(["completed", "cancelled", "devuelto_cliente"]);

function findProfileSelect() {
  return document.querySelector('select[aria-label="Perfil de presentación"]') as HTMLSelectElement | null;
}

function ensurePartnerOption(select: HTMLSelectElement) {
  if ([...select.options].some((option) => option.value === "partner")) return;
  const option = document.createElement("option");
  option.value = "partner";
  option.textContent = "Socio · Vista Ejecutiva";
  select.appendChild(option);
}

function findDashboardInsertionPoint() {
  const headings = [...document.querySelectorAll("h2,h3")];
  const capacity = headings.find((node) => node.textContent?.trim() === "Capacidad de hoy");
  if (!capacity) return null;
  return capacity.closest(".tc-card") as HTMLElement | null;
}

export default function CrmEnhancements() {
  const [role, setRole] = useState<string>("");
  const [overview, setOverview] = useState<Overview>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("crm-refined");
    const style = document.createElement("style");
    style.dataset.crmRefinement = "true";
    style.textContent = `
      .crm-refined .tc-kpi-grid{gap:10px!important}
      .crm-refined .tc-card{border-radius:12px!important}
      .crm-refined .tc-card-head{padding-top:14px!important;padding-bottom:12px!important}
      .crm-refined .tc-filterbar{gap:8px!important}
      .crm-refined table th,.crm-refined table td{padding-top:10px!important;padding-bottom:10px!important}
      [data-supervisor-map-anchor]{margin:14px 0 16px 0}
    `;
    document.head.appendChild(style);

    let cleanup: (() => void) | undefined;
    const sync = () => {
      cleanup?.();
      const select = findProfileSelect();
      if (!select) return;
      ensurePartnerOption(select);
      setRole(select.value);

      const onChange = (event: Event) => {
        if (select.value === "partner") {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.location.assign("/crm/ejecutiva");
          return;
        }
        setRole(select.value);
      };
      select.addEventListener("change", onChange, true);
      cleanup = () => select.removeEventListener("change", onChange, true);
    };

    const ensureAnchor = () => {
      let target = document.querySelector('[data-supervisor-map-anchor]') as HTMLElement | null;
      if (!target) {
        const point = findDashboardInsertionPoint();
        if (!point) return;
        target = document.createElement("div");
        target.dataset.supervisorMapAnchor = "true";
        point.insertAdjacentElement("afterend", target);
      }
      setAnchor(target);
    };

    sync();
    ensureAnchor();
    const observer = new MutationObserver(() => {
      sync();
      ensureAnchor();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanup?.();
      style.remove();
      document.documentElement.classList.remove("crm-refined");
    };
  }, []);

  useEffect(() => {
    if (role !== "supervisor" && role !== "super_admin" && role !== "admin") return;
    fetch("/api/crm/overview", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setOverview(payload || {}))
      .catch(() => setOverview({}));
  }, [role]);

  const activeCustomers = useMemo(() => {
    const customers = new Map((overview.customers || []).map((customer) => [customer.id, customer]));
    const techs = new Map((overview.technicians || []).map((technician) => [technician.id, technician]));
    return (overview.work_orders || [])
      .filter((order) => !CLOSED.has(order.status) && order.customer_id)
      .map((order) => ({ order, customer: customers.get(order.customer_id || ""), technician: techs.get(order.technician_id || "") }))
      .filter((row) => row.customer)
      .slice(0, 40);
  }, [overview]);

  useEffect(() => {
    if (!selectedId && activeCustomers.length) setSelectedId(activeCustomers[0].order.id);
  }, [activeCustomers, selectedId]);

  if (!anchor || !["supervisor", "super_admin", "admin"].includes(role)) return null;

  const selected = activeCustomers.find((row) => row.order.id === selectedId) || activeCustomers[0];
  const customer = selected?.customer;
  const query = customer
    ? customer.latitude != null && customer.longitude != null
      ? `${customer.latitude},${customer.longitude}`
      : [customer.address, customer.sector, customer.municipality, customer.province, "República Dominicana"].filter(Boolean).join(", ")
    : "República Dominicana";
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed&z=16`;

  return (
    <div className={styles.portal} ref={(node) => {
      if (node && node.parentElement !== anchor) anchor.appendChild(node);
    }}>
      <section className={styles.card}>
        <div className={styles.head}>
          <div>
            <span>SUPERVISIÓN TERRITORIAL</span>
            <h2>Mapa operativo</h2>
            <p>Clientes y órdenes activas por provincia, municipio y sector.</p>
          </div>
          <div className={styles.count}>{activeCustomers.length} activas</div>
        </div>

        <div className={styles.layout}>
          <div className={styles.list}>
            {activeCustomers.length ? activeCustomers.map(({ order, customer: item, technician }) => (
              <button key={order.id} type="button" className={`${styles.customerButton} ${selectedId === order.id ? styles.selected : ""}`} onClick={() => setSelectedId(order.id)}>
                <strong>{item?.full_name || "Cliente sin nombre"}</strong>
                <span>{order.order_number} · {order.service_category || "Servicio"}</span>
                <small>{[item?.sector, item?.municipality, item?.province].filter(Boolean).join(" · ") || "Ubicación por completar"}</small>
                <em>{technician?.full_name || "Sin técnico asignado"}</em>
              </button>
            )) : <div className={styles.empty}>No hay órdenes activas con cliente asociado.</div>}
          </div>

          <div className={styles.mapArea}>
            <iframe title="Mapa operativo de clientes" src={mapUrl} className={styles.map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            {customer && <div className={styles.detail}>
              <div><span>Cliente</span><strong>{customer.full_name || "Sin nombre"}</strong></div>
              <div><span>Ubicación</span><strong>{[customer.province, customer.municipality, customer.sector].filter(Boolean).join(" · ") || "Por completar"}</strong></div>
              <div className={styles.wide}><span>Dirección</span><strong>{customer.address || "Dirección completa pendiente"}</strong></div>
              <div><span>Referencia 1</span><strong>{customer.address_reference_1 || "Pendiente"}</strong></div>
              <div><span>Referencia 2</span><strong>{customer.address_reference_2 || "Opcional"}</strong></div>
              <div><span>Técnico</span><strong>{selected?.technician?.full_name || "Sin asignar"}</strong></div>
              <div><span>Precisión</span><strong>{customer.location_precision || (customer.latitude != null ? "exacta" : "dirección/sector")}</strong></div>
            </div>}
          </div>
        </div>
      </section>
    </div>
  );
}
