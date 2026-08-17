# Sprint 1 — Línea Blanca · Contrato técnico verificable

## Objetivo
Demostrar un flujo end-to-end de postventa e instalación de Línea Blanca usando un sandbox reemplazable por integraciones reales del socio. El flujo debe ser auditable, idempotente y desacoplado del CRM/BD final.

## Alcance del Sprint 1
Evento de compra → creación de solicitud → contacto IA → aceptación → captura de ubicación → consulta de disponibilidad → cita → registro de interacción → auditoría.

## Estados y transiciones

### Compra (`cc_purchases.state`)
- `received`: compra recibida en el sandbox.
- `validated`: datos mínimos de compra/cliente válidos.
- `contact_pending`: lista para contacto automático.
- `contacted`: se logró contacto con el cliente.
- `converted`: cliente aceptó instalación y existe solicitud.
- `closed`: proceso de compra cerrado administrativamente.
- `cancelled`: compra anulada/no aplicable.

Transiciones permitidas del Sprint 1:
`received → validated → contact_pending → contacted → converted → closed`

Excepciones:
`received|validated|contact_pending → cancelled`

### Solicitud de instalación (`cc_installation_requests.state`)
- `created`
- `contact_pending`
- `accepted`
- `location_pending`
- `scheduling`
- `scheduled`
- `in_progress`
- `completed`
- `declined`
- `cancelled`
- `escalated`

Camino feliz:
`created → contact_pending → accepted → location_pending → scheduling → scheduled → in_progress → completed`

Desvíos:
`contact_pending|accepted → declined`
`created|contact_pending|accepted|location_pending|scheduling|scheduled → escalated`
`created|contact_pending|accepted|location_pending|scheduling|scheduled → cancelled`

### Cita (`cc_appointments.state`)
`proposed → confirmed → en_route → arrived → completed`

Reprogramación:
`confirmed → rescheduled → confirmed`

Cancelación/no show:
`proposed|confirmed|rescheduled → cancelled|no_show`

### Interacción (`cc_interactions.state`)
`initiated → connected → completed`

Alternativas:
`initiated → no_answer`
`initiated|connected → failed`
`connected → escalated`

## Esquema mínimo

### `cc_customers`
`id`, `organization_id`, `external_id`, `full_name`, `phone`, `email`, `address`, `province`, `municipality`, `sector`, `reference_1`, `reference_2`, `latitude`, `longitude`, timestamps.

### `cc_purchases`
`id`, `organization_id`, `distributor_id`, `store_id`, `customer_id`, `external_id`, `invoice_number`, `product_name`, `brand`, `model`, `serial_number`, `installation_included`, `purchased_at`, `received_at`, `state`, `metadata`.

### `cc_installation_requests`
`id`, `organization_id`, `purchase_id`, `customer_id`, `state`, `acceptance_status`, `requested_window`, `notes`, timestamps.

### `cc_appointments`
`id`, `organization_id`, `installation_request_id`, `technician_id`, `starts_at`, `ends_at`, `state`, `source`, `notes`.

### `cc_interactions`
`id`, `organization_id`, `installation_request_id`, `customer_id`, `channel`, `direction`, `state`, `conversation_id`, `provider_call_id`, `intent`, `outcome`, `summary`, `transcript`, timestamps.

### Auditoría
`cc_events`: eventos de dominio append-only.
`cc_tool_audit`: input/output por Tool, correlación, idempotencia, duración y error.
`cc_integration_refs`: mapeo entre IDs locales y IDs del sistema del socio.

## Contratos de Tools
Todos los Tools usan `POST /api/call-center/tools/execute`, `Authorization: Bearer <AGENT_TOOL_SECRET>` y requieren `tool`, `correlation_id`. Operaciones con escritura aceptan `idempotency_key`.

### `ingest_purchase`
Entrada mínima:
```json
{
  "tool": "ingest_purchase",
  "correlation_id": "...",
  "idempotency_key": "purchase:<external-id>",
  "customer": {"full_name":"...","phone":"..."},
  "purchase": {"external_id":"...","invoice_number":"...","product_name":"...","brand":"...","model":"...","installation_included":true},
  "distributor": {"name":"..."},
  "store": {"name":"..."}
}
```
Salida: `customer`, `purchase`, `next_action = contact_customer`.
Eventos: `purchase.received`, `purchase.validated`, `purchase.contact_pending`.

### `get_purchase`
Entrada: `purchase_id` o `external_id`.
Salida: compra, cliente, solicitud y cita vigentes.
No modifica estado.

### `create_installation_request`
Entrada: `purchase_id`, `acceptance_status` (`accepted|declined|pending`), `notes?`.
Salida: solicitud y siguiente acción.
Si `accepted`, compra → `converted`, solicitud → `location_pending` si falta ubicación/referencia; de lo contrario → `scheduling`.
Si `declined`, solicitud → `declined`.

### `update_customer_location`
Entrada: `customer_id` o `installation_request_id`, `address`, `province`, `municipality`, `sector`, `reference_1`, `reference_2?`, `latitude?`, `longitude?`.
Regla: dirección + al menos una referencia obligatorias. La segunda referencia es opcional.
Salida: cliente actualizado y solicitud en `scheduling` cuando corresponda.
Evento: `customer.location_updated` y `installation_request.ready_for_scheduling`.

### `get_available_slots`
Entrada: `installation_request_id`, `date_from?`, `days?`.
Salida: slots sandbox disponibles, claramente marcados `source=sandbox`.
No reserva.

### `schedule_installation`
Entrada: `installation_request_id`, `starts_at`, `ends_at?`, `technician_id?`.
Salida: cita `confirmed`, solicitud `scheduled`.
Debe rechazar una solicitud no aceptada o sin dirección/referencia mínima.
Eventos: `appointment.confirmed`, `installation_request.scheduled`.

### `register_interaction`
Entrada: `installation_request_id?`, `customer_id?`, `channel`, `direction`, `state`, `conversation_id?`, `provider_call_id?`, `intent?`, `outcome?`, `summary?`, `transcript?`.
Salida: interacción persistida.
Regla: `completed`, `no_answer`, `failed` o `escalated` son estados terminales para ese intento.
Evento: `interaction.<state>`.

## Eventos de dominio mínimos
- `purchase.received`
- `purchase.validated`
- `purchase.contact_pending`
- `purchase.contacted`
- `purchase.converted`
- `installation_request.created`
- `installation_request.accepted`
- `installation_request.declined`
- `installation_request.ready_for_scheduling`
- `installation_request.scheduled`
- `customer.location_updated`
- `appointment.confirmed`
- `appointment.rescheduled`
- `interaction.initiated`
- `interaction.connected`
- `interaction.completed`
- `interaction.no_answer`
- `interaction.failed`
- `interaction.escalated`

## Reglas de auditoría
1. Toda Tool deja registro en `cc_tool_audit`, exitoso o fallido.
2. Toda transición de estado genera `cc_events` con `from_state`, `to_state`, `correlation_id`, actor y payload mínimo.
3. No se guardan secretos en payloads de auditoría.
4. Cada intento de llamada tiene `conversation_id`/`provider_call_id` cuando el proveedor los entregue.
5. `correlation_id` une compra → solicitud → llamada → cita.
6. Escrituras deben admitir `idempotency_key`; repetir la misma operación no puede crear duplicados.
7. Los eventos son append-only durante el Sprint 1.
8. Las integraciones reales deben mapearse mediante `cc_integration_refs`; el agente nunca depende de IDs internos del socio en su prompt.

## Criterios de aceptación end-to-end
El Sprint 1 está aprobado cuando una prueba real cumple todos los puntos:

1. Una compra nueva entra por `ingest_purchase` y queda en `contact_pending`.
2. El sistema puede recuperar la compra con `get_purchase`.
3. Se inicia una llamada real y se registra una interacción con correlación.
4. El cliente acepta instalación y se crea una única solicitud idempotente.
5. El agente captura dirección completa y al menos una referencia; una segunda referencia no bloquea el flujo.
6. La solicitud pasa a `scheduling` solo con los datos mínimos requeridos.
7. `get_available_slots` devuelve opciones válidas del sandbox.
8. El cliente selecciona un horario y `schedule_installation` crea una sola cita `confirmed`.
9. La solicitud queda `scheduled` y la compra `converted`.
10. La interacción termina en `completed` con resumen y resultado.
11. El Mini CRM muestra compra, cliente, solicitud, cita e interacción como un único caso.
12. `cc_events` contiene la secuencia completa con el mismo `correlation_id`.
13. `cc_tool_audit` contiene cada Tool con request/response, éxito y duración.
14. Repetir una Tool de escritura con el mismo `idempotency_key` no duplica datos.
15. Ninguna Tool permite saltos críticos de estado ni agenda una solicitud rechazada/incompleta.
16. Toda la prueba puede ejecutarse usando el Sandbox Adapter y luego migrarse a un `TechcommAdapter` sin cambiar el contrato del agente.

## Criterio de migración a TI del socio
La integración real sustituirá únicamente la implementación de las Tools. Los nombres, inputs, outputs, estados y eventos de este contrato permanecen estables salvo versión explícita (`v2`).
