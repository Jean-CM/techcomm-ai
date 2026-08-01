"use client";

import { useEffect, useState } from "react";
import styles from "./quote.module.css";

type QuoteItem = { id: string; description: string; quantity: number; unit_price: number; discount_amount: number; line_total: number };
type Quote = { quote_number: string; status: string; total: number; subtotal: number; discount_amount: number; installation_included: boolean; installation_amount: number; delivery_included: boolean; delivery_amount: number; customer_name_snapshot?: string; customer_address_snapshot?: string; warranty_note?: string; notes?: string; expires_at?: string; customer_response?: string; quote_items: QuoteItem[] };

const money = (value?: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 2 }).format(Number(value || 0));

export default function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState("Cargando cotización...");

  useEffect(() => { params.then(({ token }) => setToken(token)); }, [params]);
  useEffect(() => {
    if (!token) return;
    fetch(`/api/quotes/public/${token}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No disponible");
      setQuote(payload.quote); setMessage("");
    }).catch((error) => setMessage(error instanceof Error ? error.message : "No disponible"));
  }, [token]);

  async function respond(action: "approve" | "review" | "reject") {
    setMessage("Procesando respuesta...");
    const response = await fetch(`/api/quotes/public/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error || "No fue posible procesar la respuesta."); return; }
    setMessage(action === "approve" ? "Reparación autorizada. Techcomm recibió tu confirmación." : action === "review" ? "Solicitud de revisión enviada." : "Cotización no aprobada.");
    setQuote((current) => current ? { ...current, status: payload.quote.status, customer_response: action } : current);
  }

  if (!quote) return <main className={styles.shell}><section className={styles.card}><h1>Techcomm Operations</h1><p>{message}</p></section></main>;

  return <main className={styles.shell}><section className={styles.card}>
    <header><div><small>COTIZACIÓN DIGITAL</small><h1>Techcomm Operations</h1><p>{quote.quote_number}</p></div><span className={styles.seal}>TECHCOMM<br/>VERIFICADA</span></header>
    <section className={styles.customer}><strong>{quote.customer_name_snapshot || "Cliente"}</strong><span>{quote.customer_address_snapshot || "Dirección por confirmar"}</span></section>
    <div className={styles.items}>{quote.quote_items.map((item) => <article key={item.id}><div><strong>{item.description}</strong><span>{item.quantity} unidad(es)</span></div><b>{money(item.line_total)}</b></article>)}</div>
    <section className={styles.summary}>
      {quote.discount_amount > 0 && <div><span>Descuento</span><b>-{money(quote.discount_amount)}</b></div>}
      {quote.installation_included && <div><span>Instalación</span><b>{money(quote.installation_amount)}</b></div>}
      {quote.delivery_included && <div><span>Envío</span><b>{quote.delivery_amount > 0 ? money(quote.delivery_amount) : "Incluido"}</b></div>}
      <div className={styles.total}><span>Total</span><b>{money(quote.total)}</b></div>
    </section>
    <section className={styles.warranty}><strong>Garantía y condiciones</strong><p>{quote.warranty_note || "La garantía aplica según el producto, la pieza y el servicio realizado. La cotización está sujeta a validación técnica y disponibilidad."}</p>{quote.expires_at && <small>Válida hasta: {new Date(quote.expires_at).toLocaleDateString("es-DO")}</small>}</section>
    {!quote.customer_response && <div className={styles.actions}><button onClick={() => respond("approve")}>Aprobar reparación</button><button onClick={() => respond("review")}>Solicitar revisión</button><button className={styles.secondary} onClick={() => respond("reject")}>No aprobar</button></div>}
    {message && <p className={styles.message}>{message}</p>}
  </section></main>;
}
