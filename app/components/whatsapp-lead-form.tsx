"use client";

import { FormEvent, useState } from "react";

const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";

export function WhatsAppLeadForm() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [interest, setInterest] = useState("Demo empresarial");
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!whatsappNumber) {
      window.alert("El canal de WhatsApp está en configuración. Escríbenos desde el botón de contacto cuando esté activo.");
      return;
    }

    const text = [
      "Hola, quiero conocer Techcomm AI.",
      `Nombre: ${name}`,
      `Empresa/área: ${company || "No indicada"}`,
      `Interés: ${interest}`,
      `Consulta: ${message || "Deseo recibir más información y coordinar una demostración."}`
    ].join("\n");

    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          <span>Nombre</span>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          <span>Empresa o área</span>
          <input className="input" value={company} onChange={(event) => setCompany(event.target.value)} />
        </label>
      </div>
      <label>
        <span>¿Qué necesitas?</span>
        <select className="input" value={interest} onChange={(event) => setInterest(event.target.value)}>
          <option>Demo empresarial</option>
          <option>Automatización de procesos</option>
          <option>Integración de datos</option>
          <option>Asistente de IA por WhatsApp</option>
          <option>Dashboard y analítica</option>
          <option>Propuesta comercial</option>
        </select>
      </label>
      <label>
        <span>Cuéntanos brevemente</span>
        <textarea className="input textarea" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} />
      </label>
      <button className="button" type="submit">Consultar por WhatsApp</button>
    </form>
  );
}

export function WhatsAppFloatingButton() {
  const href = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hola, quiero información sobre Techcomm AI.")}`
    : "#contacto";

  return (
    <a className="whatsapp-float" href={href} target={whatsappNumber ? "_blank" : undefined} rel="noreferrer" aria-label="Consultar por WhatsApp">
      WhatsApp
    </a>
  );
}
