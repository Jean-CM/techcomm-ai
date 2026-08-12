"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Material = { id: string; product_name: string; quantity: number; unit_price: number | null };
type Product = { id: string; name: string; sku: string; price: number | null; stock: number | null };

type OrderData = {
  order: {
    id: string; order_number: string; status: string; equipment: string; brand: string | null; model: string | null; issue: string;
    technician_departed_at: string | null; technician_arrived_at: string | null; technician_completed_at: string | null;
  };
  customer: { full_name: string; address: string; sector: string | null; phone: string } | null;
  appointment: { starts_at: string } | null;
  materials: Material[];
};

export default function TechnicianOrderView({ orderId }: { orderId: string }) {
  const [data, setData] = useState<OrderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [isAdditionalPurchase, setIsAdditionalPurchase] = useState(false);
  const [quoteFeedback, setQuoteFeedback] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [acceptance, setAcceptance] = useState<"accepted" | "rejected" | "">("");
  const [acceptanceNotes, setAcceptanceNotes] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  async function load() {
    try {
      const response = await fetch(`/api/tecnico/ordenes/${orderId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Error al cargar");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    }
  }

  useEffect(() => { void load(); }, [orderId]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      const response = await fetch(`/api/tecnico/productos?q=${encodeURIComponent(query)}`);
      const payload = await response.json();
      if (response.ok) setResults(payload.products);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function act(action: "salio" | "llego" | "termino") {
    setLoadingAction(action);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "termino") {
        if (!acceptance) throw new Error("Indica si el cliente aceptó o rechazó el servicio.");
        if (!signatureDataUrl) throw new Error("Falta la firma del cliente.");
        if (photos.length === 0) throw new Error("Agrega al menos una foto de evidencia.");
        body.customer_acceptance = acceptance;
        body.customer_acceptance_notes = acceptanceNotes;
        body.signature_base64 = signatureDataUrl;
        body.photo_base64_list = photos;
      }
      const response = await fetch(`/api/tecnico/ordenes/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Error");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoadingAction(null);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setPhotos((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = pointerPos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }
  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.strokeStyle = "#14181D";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function endDraw() {
    drawingRef.current = false;
    if (canvasRef.current) setSignatureDataUrl(canvasRef.current.toDataURL("image/png"));
  }
  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  }

  async function addMaterial(product: Product) {
    setQuoteFeedback(null);
    const response = await fetch(`/api/tecnico/ordenes/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_material", product_id: product.id, product_name: product.name, quantity, unit_price: product.price, is_additional_purchase: isAdditionalPurchase }),
    });
    const payload = await response.json().catch(() => ({}));
    if (isAdditionalPurchase) {
      if (payload.quote_sent) setQuoteFeedback("Cotización creada y enviada al cliente por WhatsApp.");
      else if (payload.quote_created) setQuoteFeedback("Cotización creada, pero no se pudo enviar por WhatsApp (verifica el teléfono del cliente).");
      else setQuoteFeedback("No se pudo generar la cotización — revisa con la oficina.");
    }
    setQuery("");
    setResults([]);
    setQuantity(1);
    setIsAdditionalPurchase(false);
    await load();
  }

  if (error) {
    return <main style={{ minHeight: "100vh", background: "#14181D", color: "#F2EEE6", display: "grid", placeItems: "center", padding: 24, fontFamily: "sans-serif" }}><p>{error}</p></main>;
  }
  if (!data) {
    return <main style={{ minHeight: "100vh", background: "#14181D", color: "#9BA1A6", display: "grid", placeItems: "center", fontFamily: "sans-serif" }}>Cargando...</main>;
  }

  const { order, customer, appointment, materials } = data;
  const btnStyle = (done: boolean, disabled: boolean) => ({
    width: "100%", padding: "18px", fontSize: 18, fontWeight: 700 as const, borderRadius: 10, border: "none", marginBottom: 14,
    background: disabled ? "#242A33" : done ? "#4CC38A" : "#FF6A39",
    color: disabled ? "#5B6470" : "#181109", opacity: disabled ? 0.6 : 1,
  });

  return (
    <main style={{ minHeight: "100vh", background: "#14181D", color: "#F2EEE6", fontFamily: "sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <Link href="/tecnico" style={{ color: "#9BA1A6", fontSize: 14, textDecoration: "none" }}>← Mis órdenes</Link>
        <p style={{ color: "#E3B341", fontWeight: 700, letterSpacing: 1, fontSize: 13, marginTop: 12 }}>ORDEN {order.order_number}</p>
        <h1 style={{ fontSize: 24, margin: "6px 0 18px" }}>{order.equipment}{order.brand ? ` — ${order.brand}` : ""}{order.model ? ` ${order.model}` : ""}</h1>

        <div style={{ background: "#1C2129", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", color: "#9BA1A6", fontSize: 13 }}>Falla reportada</p>
          <p style={{ margin: "0 0 16px" }}>{order.issue}</p>
          <p style={{ margin: "0 0 8px", color: "#9BA1A6", fontSize: 13 }}>Cliente</p>
          <p style={{ margin: "0 0 16px" }}>{customer?.full_name ?? "—"} · {customer?.phone}</p>
          <p style={{ margin: "0 0 8px", color: "#9BA1A6", fontSize: 13 }}>Dirección</p>
          <p style={{ margin: 0 }}>{customer?.address ?? "—"}{customer?.sector ? `, ${customer.sector}` : ""}</p>
          {appointment && <><p style={{ margin: "16px 0 8px", color: "#9BA1A6", fontSize: 13 }}>Hora acordada</p><p style={{ margin: 0 }}>{new Date(appointment.starts_at).toLocaleString("es-DO")}</p></>}
        </div>

        <button style={btnStyle(Boolean(order.technician_departed_at), Boolean(order.technician_departed_at) || loadingAction !== null)} disabled={Boolean(order.technician_departed_at) || loadingAction !== null} onClick={() => act("salio")}>
          {order.technician_departed_at ? "✓ Saliste" : loadingAction === "salio" ? "Registrando..." : "Salí"}
        </button>
        <button style={btnStyle(Boolean(order.technician_arrived_at), !order.technician_departed_at || Boolean(order.technician_arrived_at) || loadingAction !== null)} disabled={!order.technician_departed_at || Boolean(order.technician_arrived_at) || loadingAction !== null} onClick={() => act("llego")}>
          {order.technician_arrived_at ? "✓ Llegaste" : loadingAction === "llego" ? "Registrando..." : "Llegué"}
        </button>

        {order.technician_arrived_at && !order.technician_completed_at && (
          <div style={{ background: "#1C2129", borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700 }}>Evidencia para cerrar el servicio</p>

            <p style={{ margin: "0 0 6px", color: "#9BA1A6", fontSize: 13 }}>Fotos del trabajo realizado</p>
            <input type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoChange} style={{ marginBottom: 10 }} />
            {photos.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />)}
              </div>
            )}

            <p style={{ margin: "10px 0 6px", color: "#9BA1A6", fontSize: 13 }}>Firma del cliente</p>
            <canvas
              ref={canvasRef}
              width={400}
              height={140}
              style={{ width: "100%", height: 140, background: "#F2EEE6", borderRadius: 8, touchAction: "none" }}
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerLeave={endDraw}
            />
            <button type="button" onClick={clearSignature} style={{ marginTop: 6, background: "transparent", border: "1px solid #2C333D", color: "#9BA1A6", borderRadius: 6, padding: "4px 10px", fontSize: 12 }}>Borrar firma</button>

            <p style={{ margin: "14px 0 6px", color: "#9BA1A6", fontSize: 13 }}>¿El cliente acepta el servicio?</p>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <button type="button" onClick={() => setAcceptance("accepted")} style={{ flex: 1, padding: 10, borderRadius: 8, border: acceptance === "accepted" ? "2px solid #4CC38A" : "1px solid #2C333D", background: acceptance === "accepted" ? "#1a2a22" : "transparent", color: "#F2EEE6" }}>✓ Acepta</button>
              <button type="button" onClick={() => setAcceptance("rejected")} style={{ flex: 1, padding: 10, borderRadius: 8, border: acceptance === "rejected" ? "2px solid #E8646A" : "1px solid #2C333D", background: acceptance === "rejected" ? "#2a1a1c" : "transparent", color: "#F2EEE6" }}>✗ Rechaza</button>
            </div>
            {acceptance === "rejected" && (
              <textarea
                value={acceptanceNotes}
                onChange={(e) => setAcceptanceNotes(e.target.value)}
                placeholder="¿Por qué rechaza el cliente?"
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #2C333D", background: "#0F1318", color: "#F2EEE6", minHeight: 60 }}
              />
            )}
          </div>
        )}

        {order.technician_arrived_at && !order.technician_completed_at && (
          <div style={{ background: "#1C2129", borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700 }}>¿El cliente compró algo del inventario?</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto o pieza..."
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #2C333D", background: "#0F1318", color: "#F2EEE6", marginBottom: 8 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 14, color: "#E3B341" }}>
              <input type="checkbox" checked={isAdditionalPurchase} onChange={(e) => setIsAdditionalPurchase(e.target.checked)} />
              Es una compra adicional — no estaba en la orden original (genera y envía cotización al cliente)
            </label>
            {results.length > 0 && (
              <div>
                {results.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #2C333D" }}>
                    <div>
                      <p style={{ margin: 0 }}>{p.name}</p>
                      <p style={{ margin: 0, color: "#9BA1A6", fontSize: 12 }}>{p.sku} · RD${p.price} · stock {p.stock}</p>
                    </div>
                    <button onClick={() => addMaterial(p)} style={{ background: "#FF6A39", border: 0, borderRadius: 6, padding: "6px 12px", color: "#181109", fontWeight: 700 }}>+ Agregar</button>
                  </div>
                ))}
              </div>
            )}
            {quoteFeedback && <p style={{ color: "#4CC38A", fontSize: 13, marginTop: 8 }}>{quoteFeedback}</p>}
            {materials.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: "0 0 6px", color: "#9BA1A6", fontSize: 13 }}>Agregado a esta orden:</p>
                {materials.map((m) => <p key={m.id} style={{ margin: "2px 0" }}>• {m.quantity}× {m.product_name}</p>)}
              </div>
            )}
          </div>
        )}

        <button style={btnStyle(Boolean(order.technician_completed_at), !order.technician_arrived_at || Boolean(order.technician_completed_at) || loadingAction !== null)} disabled={!order.technician_arrived_at || Boolean(order.technician_completed_at) || loadingAction !== null} onClick={() => act("termino")}>
          {order.technician_completed_at ? "✓ Terminado" : loadingAction === "termino" ? "Registrando..." : "Terminé"}
        </button>

        {order.technician_completed_at && <p style={{ color: "#4CC38A", textAlign: "center" }}>Servicio completado — se envió la encuesta al cliente.</p>}
      </div>
    </main>
  );
}
