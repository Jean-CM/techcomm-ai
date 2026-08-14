"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
const MAP_ROLES = new Set(["super_admin", "secretary", "technician"]);
const MAP_SECTIONS = new Set(["Clientes", "Agenda y Órdenes", "Técnicos"]);

function profileSelect() {
  return document.querySelector('select[aria-label="Perfil de presentación"]') as HTMLSelectElement | null;
}

function currentSection() {
  const title = document.querySelector('[class*="topTitle"] strong');
  return title?.textContent?.trim() || "";
}

function renameTechnicianProfile(select: HTMLSelectElement) {
  const technician = [...select.options].find((option) => option.value === "technician");
  if (technician && technician.textContent !== "Gestión técnicos") technician.textContent = "Gestión técnicos";
}

function removeExecutiveControlLink() {
  const link = document.querySelector('a[href="/crm/ejecutiva"]');
  if (link) link.remove();
}

function ensureExecutiveProfileButton(select: HTMLSelectElement) {
  const profile = select.parentElement;
  if (!profile || profile.querySelector('[data-partner-view-button]')) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.partnerViewButton = "true";
  button.className = "tc-btn tc-btn-ghost tc-btn-sm";
  button.textContent = "Socio · Vista Ejecutiva";
  button.style.width = "100%";
  button.style.marginTop = "8px";
  button.addEventListener("click", () => window.location.assign("/crm/ejecutiva"));
  profile.appendChild(button);
}

function findActiveCard(section: string) {
  const headings = [...document.querySelectorAll("h2,h3")];
  const expected = section === "Clientes" ? "Clientes" : section === "Agenda y Órdenes" ? "Agenda y órdenes" : "Técnicos y disponibilidad";
  const heading = headings.find((node) => node.textContent?.trim() === expected);
  return heading?.closest(".tc-card") as HTMLElement | null;
}

function makeConversationRowsDrillDown(section: string) {
  const rows = document.querySelectorAll("tbody tr");
  rows.forEach((row) => row.classList.remove("crm-drill-row"));
  if (section !== "Conversaciones") return;

  rows.forEach((row) => {
    const button = [...row.querySelectorAll("button")].find((item) => item.textContent?.includes("Ver detalle")) as HTMLButtonElement | undefined;
    if (!button) return;
    row.classList.add("crm-drill-row");
    (row as HTMLElement).tabIndex = 0;
    (row as HTMLElement).title = "Abrir detalle de la conversación";
    const open = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.closest("button,a,input,select,textarea")) return;
      button.click();
    };
    if (!(row as HTMLElement).dataset.drillBound) {
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        const keyboard = event as KeyboardEvent;
        if (keyboard.key === "Enter" || keyboard.key === " ") button.click();
      });
      (row as HTMLElement).dataset.drillBound = "true";
    }
  });
}

export default function CrmEnhancements() {
  const [role, setRole] = useState("");
  const [section, setSection] = useState("");
  const [overview, setOverview] = useState<Overview>({});
  const [selectedId, setSelectedId] = useState("");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("crm-refined");
    const style = document.createElement("style");
    style.dataset.crmRefinement = "true";
    style.textContent = `
      .crm-refined .tc-kpi-grid{gap:10px!important}
      .crm-refined .tc-card{border-radius:14px!important;box-shadow:0 1px 0 rgba(255,255,255,.025),0 8px 28px rgba(0,0,0,.08)!important}
      .crm-refined .tc-card-head{padding-top:14px!important;padding-bottom:12px!important}
      .crm-refined .tc-filterbar{gap:8px!important;flex-wrap:wrap!important}
      .crm-refined .tc-tablewrap{border-radius:0 0 12px 12px!important}
      .crm-refined table th{font-size:11px!important;letter-spacing:.025em!important;text-transform:uppercase!important}
      .crm-refined table th,.crm-refined table td{padding-top:10px!important;padding-bottom:10px!important}
      .crm-refined .tc-rowactions{gap:5px!important}
      .crm-drill-row{cursor:pointer;transition:background .15s ease,transform .15s ease}
      .crm-drill-row:hover{background:rgba(21,151,255,.055)!important}
      .crm-drill-row:focus{outline:1px solid rgba(21,151,255,.48);outline-offset:-1px}
      [data-operational-map-anchor]{margin:0 0 14px 0}
      [data-partner-view-button]{justify-content:center!important}
    `;
    document.head.appendChild(style);

    let select: HTMLSelectElement | null = null;
    let onRoleChange: (() => void) | null = null;

    const sync = () => {
      const nextSelect = profileSelect();
      if (nextSelect && nextSelect !== select) {
        if (select && onRoleChange) select.removeEventListener("change", onRoleChange);
        select = nextSelect;
        renameTechnicianProfile(select);
        ensureExecutiveProfileButton(select);
        onRoleChange = () => setRole(select?.value || "");
        select.addEventListener("change", onRoleChange);
      }
      if (select) {
        renameTechnicianProfile(select);
        setRole(select.value);
      }
      removeExecutiveControlLink();
      const nextSection = currentSection();
      setSection(nextSection);
      makeConversationRowsDrillDown(nextSection);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (select && onRoleChange) select.removeEventListener("change", onRoleChange);
      document.querySelector('[data-operational-map-anchor]')?.remove();
      style.remove();
      document.documentElement.classList.remove("crm-refined");
    };
  }, []);

  const mapAllowed = MAP_ROLES.has(role) && MAP_SECTIONS.has(section);

  useEffect(() => {
    if (!mapAllowed) {
      document.querySelector('[data-operational-map-anchor]')?.remove();
      setAnchor(null);
      return;
    }
    const card = findActiveCard(section);
    if (!card) return;
    let target = document.querySelector('[data-operational-map-anchor]') as HTMLElement | null;
    if (!target) {
      target = document.createElement("div");
      target.dataset.operationalMapAnchor = "true";
      card.insertAdjacentElement("beforebegin", target);
    } else if (target.nextElementSibling !== card) {
      card.insertAdjacentElement("beforebegin", target);
    }
    setAnchor(target);
  }, [mapAllowed, section]);

  useEffect(() => {
    if (!mapAllowed) return;
    fetch("/api/crm/overview", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setOverview(payload || {}))
      .catch(() => setOverview({}));
  }, [mapAllowed, section]);

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

  if (!mapAllowed || !anchor) return null;

  const selected = activeCustomers.find((row) => row.order.id === selectedId) || activeCustomers[0];
  const customer = selected?.customer;
  const query = customer
    ? customer.latitude != null && customer.longitude != null
      ? `${customer.latitude},${customer.longitude}`
      : [customer.address, customer.sector, customer.municipality, customer.province, "República Dominicana"].filter(Boolean).join(", ")
    : "República Dominicana";
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed&z=16`;

  return createPortal(
    <section className={styles.card}>
      <div className={styles.head}>
        <div>
          <span>GESTIÓN TERRITORIAL</span>
          <h2>Mapa operativo</h2>
          <p>Disponible en {section}. Selecciona un cliente para enfocar la zona de servicio.</p>
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
    </section>,
    anchor,
  );
}
