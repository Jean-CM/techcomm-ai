"use client";

import { useEffect, useState } from "react";

type OrderData = {
  order: {
    order_number: string;
    status: string;
    equipment: string;
    brand: string | null;
    model: string | null;
    issue: string;
    technician_departed_at: string | null;
    technician_arrived_at: string | null;
    technician_completed_at: string | null;
  };
  customer: { full_name: string; address: string; sector: string | null } | null;
  appointment: { starts_at: string } | null;
};

export default function TechnicianView({ token }: { token: string }) {
  const [data, setData] = useState<OrderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch(`/api/tecnico/${token}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Enlace inválido");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    }
  }

  useEffect(() => { void load(); }, [token]);

  async function act(action: "salio" | "llego" | "termino") {
    setLoadingAction(action);
    try {
      const response = await fetch(`/api/tecnico/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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

  if (error) {
    return (
      <main style={{ minHeight: "100vh", background: "#14181D", color: "#F2EEE6", display: "grid", placeItems: "center", padding: 24, fontFamily: "sans-serif" }}>
        <p>{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ minHeight: "100vh", background: "#14181D", color: "#9BA1A6", display: "grid", placeItems: "center", fontFamily: "sans-serif" }}>
        Cargando...
      </main>
    );
  }

  const { order, customer, appointment } = data;
  const btnStyle = (active: boolean, disabled: boolean) => ({
    width: "100%",
    padding: "18px",
    fontSize: 18,
    fontWeight: 700 as const,
    borderRadius: 10,
    border: "none",
    marginBottom: 14,
    background: disabled ? "#242A33" : active ? "#4CC38A" : "#FF6A39",
    color: disabled ? "#5B6470" : "#181109",
    opacity: disabled ? 0.6 : 1,
  });

  return (
    <main style={{ minHeight: "100vh", background: "#14181D", color: "#F2EEE6", fontFamily: "sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <p style={{ color: "#E3B341", fontWeight: 700, letterSpacing: 1, fontSize: 13 }}>ORDEN {order.order_number}</p>
        <h1 style={{ fontSize: 24, margin: "6px 0 18px" }}>{order.equipment}{order.brand ? ` — ${order.brand}` : ""}{order.model ? ` ${order.model}` : ""}</h1>

        <div style={{ background: "#1C2129", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", color: "#9BA1A6", fontSize: 13 }}>Falla reportada</p>
          <p style={{ margin: "0 0 16px" }}>{order.issue}</p>
          <p style={{ margin: "0 0 8px", color: "#9BA1A6", fontSize: 13 }}>Cliente</p>
          <p style={{ margin: "0 0 16px" }}>{customer?.full_name ?? "—"}</p>
          <p style={{ margin: "0 0 8px", color: "#9BA1A6", fontSize: 13 }}>Dirección</p>
          <p style={{ margin: 0 }}>{customer?.address ?? "—"}{customer?.sector ? `, ${customer.sector}` : ""}</p>
          {appointment && (
            <>
              <p style={{ margin: "16px 0 8px", color: "#9BA1A6", fontSize: 13 }}>Hora acordada</p>
              <p style={{ margin: 0 }}>{new Date(appointment.starts_at).toLocaleString("es-DO")}</p>
            </>
          )}
        </div>

        <button
          style={btnStyle(Boolean(order.technician_departed_at), Boolean(order.technician_departed_at) || loadingAction === "salio")}
          disabled={Boolean(order.technician_departed_at) || loadingAction !== null}
          onClick={() => act("salio")}
        >
          {order.technician_departed_at ? "✓ Saliste" : loadingAction === "salio" ? "Registrando..." : "Salí"}
        </button>

        <button
          style={btnStyle(Boolean(order.technician_arrived_at), !order.technician_departed_at || Boolean(order.technician_arrived_at) || loadingAction === "llego")}
          disabled={!order.technician_departed_at || Boolean(order.technician_arrived_at) || loadingAction !== null}
          onClick={() => act("llego")}
        >
          {order.technician_arrived_at ? "✓ Llegaste" : loadingAction === "llego" ? "Registrando..." : "Llegué"}
        </button>

        <button
          style={btnStyle(Boolean(order.technician_completed_at), !order.technician_arrived_at || Boolean(order.technician_completed_at) || loadingAction === "termino")}
          disabled={!order.technician_arrived_at || Boolean(order.technician_completed_at) || loadingAction !== null}
          onClick={() => act("termino")}
        >
          {order.technician_completed_at ? "✓ Terminado" : loadingAction === "termino" ? "Registrando..." : "Terminé"}
        </button>

        {order.technician_completed_at && (
          <p style={{ color: "#4CC38A", textAlign: "center", marginTop: 12 }}>
            Servicio completado — se envió la encuesta al cliente.
          </p>
        )}
      </div>
    </main>
  );
}
