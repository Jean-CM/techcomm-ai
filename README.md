# Techcomm Operations

> Plataforma operativa y de inteligencia artificial para la gestión integral de atención al cliente, órdenes de servicio, técnicos, inventario, cotizaciones, comunicaciones y analítica de Techcomm Wireless.

**Estado del proyecto:** desarrollo activo / definición funcional con socio  
**Última actualización:** 13 de agosto de 2026  
**Repositorio principal:** `Jean-CM/techcomm-ai`  
**Branch estable:** `main`

---

## 1. Visión del proyecto

Techcomm Nexus AI es la plataforma tecnológica central propuesta para **SERVICIOS DE TELECOMUNICACIONES TECHCOMM, S.R.L.**, comercialmente **Techcomm Wireless**, con foco inicial en la operación de atención al cliente y servicio técnico en República Dominicana.

El objetivo no es construir un simple chatbot ni una agenda aislada. La plataforma busca centralizar y orquestar el ciclo completo de servicio:

1. Recepción del contacto del cliente.
2. Identificación del cliente y del equipo.
3. Validación del tipo de servicio y garantía.
4. Triage y diagnóstico preliminar.
5. Solicitud y recepción de evidencias.
6. Cotización cuando aplique.
7. Confirmación de pago cuando corresponda.
8. Validación o solicitud de repuestos.
9. Programación de visita.
10. Asignación manual de técnico en la fase actual.
11. Ejecución del servicio.
12. Evidencias de trabajo y aceptación/rechazo del cliente.
13. Cierre de orden.
14. Encuesta, satisfacción y NPS.
15. Reportería operativa, financiera y gerencial.

La arquitectura se está diseñando para soportar crecimiento, nuevos canales, automatización progresiva y sustitución de proveedores sin rehacer el núcleo del producto.

---

## 2. Fuente funcional principal actual

El alcance funcional V1 se está contrastando con el documento de descubrimiento entregado por Techcomm y completado por **Wendy Rodríguez el 11 de agosto de 2026**.

Ese documento corresponde al primer levantamiento formal del servicio de **Atención al Cliente**. Existe un segundo documento pendiente de entrega por parte del socio; cuando sea recibido se realizará un análisis de delta para actualizar alcance, costos, dependencias y prioridades sin reiniciar el trabajo ya realizado.

### Datos operativos declarados en el primer levantamiento

- Operación actual en República Dominicana.
- Equipo interno aproximado:
  - 2 atención a clientes.
  - 2 atención a fabricantes y tiendas.
  - 2 soporte técnico externo.
  - 3 técnicos internos.
  - 1 supervisor de atención.
  - 1 supervisor técnico.
- 5 cuadrillas externas subcontratadas en Santo Domingo con cobertura nacional.
- 1 cuadrilla externa subcontratada en Santiago.
- Capacidades operativas indicadas:
  - 47 instalaciones/día.
  - 36 diagnósticos/día.
  - 30 reparaciones/día.
- La empresa se encuentra en un proceso de mejora operativa con expectativa de reducir carga manual y tamaño operativo donde sea posible.

---

## 3. Servicios y equipos cubiertos

### Tipos de servicio

- Instalación de electrodomésticos.
- Mantenimiento de electrodomésticos.
- Reparación de electrodomésticos.
- Desinstalación de electrodomésticos.

### Categorías principales de equipos

- Televisores.
- Monitores TV.
- Neveras.
- Aires acondicionados.
- Lavadoras.
- Estufas.
- Secadoras.
- Lavadoras-secadoras.
- Lavavajillas.
- Hornos.
- Microondas.
- Microondas-extractor.
- Pequeños electrodomésticos y equipos relacionados.

### Marcas y comercios mencionados

- LG.
- Samsung.
- TCL.
- Black & Decker.
- Otras marcas según artículo.
- Grupo Ramos.
- Plaza Lama.
- Ochoa.

Las tarifas de servicio pueden variar según tipo de equipo, tipo de servicio y nivel de reparación.

---

## 4. Modelo de garantías

La plataforma debe soportar reglas diferenciadas para:

- **Garantía fabricante**: cobertura según fecha de venta si existe factura o fecha de fabricación cuando no existe.
- **Garantía fabricante parcial**: extensión de cobertura sobre piezas específicas.
- **Garantía fabricante promoción**: condiciones extraordinarias informadas por el fabricante.
- **Garantía tienda/distribuidor**: trabajos asumidos por el comercio/distribuidor cuando corresponda.
- **Garantía Techcomm**: cobertura de 30 días sobre la misma reparación luego de la entrega del equipo.
- **Fuera de garantía**: equipos sin cobertura o casos excluidos por maltrato, rotura, humedad o intervención no autorizada.

El objetivo técnico es evitar que estas reglas queden dispersas en código o decisiones humanas. Deben evolucionar hacia un motor de reglas auditable y configurable.

---

## 5. Flujo de atención objetivo

### Canales de entrada actuales / previstos

- WhatsApp.
- Llamadas telefónicas.
- Correo electrónico.
- Página del fabricante.
- Redes sociales.
- Call center.
- Portal/web en fases posteriores.

### Flujo operacional identificado

```text
Cliente
  ↓
Contacto / solicitud
  ↓
Registro de cliente + equipo + servicio
  ↓
Validación de garantía
  ↓
¿Aplica diagnóstico con costo?
  ├─ Sí → cotización + pago adelantado
  └─ No
  ↓
Triage / diagnóstico preliminar
  ↓
Fotos / videos / factura / evidencias
  ↓
¿Se identifica falla y repuesto?
  ├─ Sí → validar inventario / solicitar pieza
  └─ No → coordinar visita diagnóstica
  ↓
Agenda y asignación manual de técnico
  ↓
Servicio en sitio / taller
  ↓
Evidencias + formulario firmado
  ↓
Aceptación o rechazo
  ↓
Cierre de orden
  ↓
Satisfacción / NPS / KPIs
```

---

## 6. Módulos funcionales

La plataforma se está organizando alrededor de los siguientes dominios:

### Atención y CRM

- Clientes / Customer 360.
- Datos de contacto.
- Direcciones y geolocalización.
- Equipos asociados al cliente.
- Historial de órdenes.
- Historial de conversaciones y contactos.
- Evidencias recibidas.
- Estado actual del caso.

### Órdenes de servicio

- Registro de solicitud.
- Tipo de servicio.
- Tipo de cliente.
- Marca, modelo y serial.
- Estado de garantía.
- Triage y diagnóstico preliminar.
- Estados del proceso.
- Programación.
- Técnico asignado.
- Repuestos asociados.
- Pagos requeridos.
- Evidencias.
- Firma/aceptación/rechazo del cliente.
- Cierre y reapertura/reingreso.

### Triage e inteligencia artificial

- Captura estructurada de síntomas.
- Análisis de conversación.
- Solicitud guiada de evidencias.
- Diagnóstico preliminar asistido.
- Identificación de posibles repuestos.
- Resumen automático de casos.
- Clasificación de intención.
- Asistencia al agente humano.
- Escalamiento a humano cuando aplique.

La IA será asistiva y auditable; las decisiones comerciales o técnicas críticas deben conservar reglas de negocio y trazabilidad.

### Cotizaciones

Deben contemplar como mínimo:

- Datos del cliente.
- Datos del equipo.
- Diagnóstico.
- Mano de obra.
- Repuestos.
- Flete/transporte.
- Materiales adicionales.
- Impuestos aplicables.
- Total.
- Términos y condiciones.
- Formas de pago.
- Autorización del cliente.

No se requiere aprobación del supervisor para una cotización estándar. El supervisor interviene en casos fuera de estándar o cuando se aplican descuentos.

Luego de la autorización del cliente y del registro de los pagos correspondientes, la cotización debe poder convertirse en orden de trabajo.

### Agenda y despacho

La asignación de técnicos **permanece manual en la fase actual**. La plataforma debe ayudar al coordinador mostrando:

- Cliente y ubicación.
- Tipo de equipo.
- Garantía.
- Síntoma.
- Evidencias.
- Triage.
- Diagnóstico preliminar.
- Distancia.
- Ruta.
- Fecha solicitada.
- Disponibilidad.
- Repuestos requeridos.
- Stock.
- Herramientas especiales.
- Diagnóstico aprobado.
- Pagos recibidos.
- Cobros pendientes.

La asignación automática queda como evolución futura cuando la operación esté preparada.

### Portal del técnico

Objetivo funcional:

- Visualizar agenda y servicios asignados.
- Confirmar salida.
- Marcar llegada.
- Registrar inicio/fin de trabajo cuando aplique.
- Consultar datos mínimos del caso.
- Registrar diagnóstico.
- Registrar repuestos utilizados.
- Cargar fotos/videos/evidencias.
- Adjuntar formulario firmado.
- Registrar aceptación o rechazo.
- Completar el servicio únicamente cuando se cumplan evidencias obligatorias.
- Liberar disponibilidad para el próximo caso.

Los tiempos registrados sirven para disponibilidad operativa y evaluación de desempeño.

**Restricción actual:** los técnicos todavía no tienen smartphones corporativos asignados; sus dispositivos personales son mayormente Android. Debe contemplarse conectividad móvil real y evaluar modo offline cuando el alcance final lo justifique.

### Kilometraje y rutas

La operación reporta cálculo actual desde Casa Central Techcomm Pantoja hasta el servicio utilizando Google Maps, considerando kilómetros de ida y vuelta.

Para servicios fuera de garantía fuera del Gran Santo Domingo se reporta una referencia de **RD$20 por kilómetro recorrido**, aunque los acuerdos pueden variar por cliente.

### Inventario y repuestos

El inventario no debe tratarse como una simple lista de productos. Debe soportar progresivamente:

- SKU / código / barcode / modelo / fabricante.
- Existencia física.
- Stock disponible.
- Stock reservado.
- Stock pendiente.
- Solicitud desde la orden de servicio.
- Reserva para una orden concreta.
- Entrega de piezas al técnico antes de la ruta.
- Consumo por servicio.
- Compra cuando no hay stock.
- Condición de prepago para repuesto fuera de garantía.
- Historial de movimientos.
- Auditoría.
- Reorden / mínimos / máximos.
- Proveedores.
- Integración con fuente maestra externa.

Los técnicos no mantienen inventario fijo en vehículos; reciben las piezas requeridas para la ruta del día.

### Pagos y facturación

Medios actuales declarados:

- Transferencia bancaria.
- Tarjeta de crédito.
- Efectivo.

Regla operacional reportada:

- Diagnóstico, flete y repuesto: pago adelantado.
- Mano de obra: pago después de recibido el servicio.

Se requieren comprobantes fiscales para crédito fiscal y consumidor final. La plataforma deberá integrarse o coordinarse con el software de facturación existente; la implementación fiscal definitiva depende de la información técnica pendiente de ese sistema.

---

## 7. Comunicaciones — Arquitectura B optimizada

La recomendación arquitectónica actual es evitar que un único proveedor se convierta en el centro de todo el ecosistema.

### Principio

**Techcomm Platform debe ser el cerebro. Los proveedores de canal son reemplazables.**

```text
                    CLIENTES
                       │
          ┌────────────┼─────────────┐
          │            │             │
       WhatsApp     Teléfono       Web/Email
          │            │             │
          ▼            ▼             ▼
      Meta API      SIP/Carrier    API/SMTP
          │            │             │
          └────────────┼─────────────┘
                       ▼
          Techcomm Communications Gateway
                       │
          ┌────────────┼──────────────┐
          ▼            ▼              ▼
       AI/LLM       Voice AI       Reglas
          │            │              │
          └────────────┼──────────────┘
                       ▼
               Techcomm Platform
                       │
                       ▼
              PostgreSQL / Supabase
```

### WhatsApp

Arquitectura objetivo:

- Meta WhatsApp Business Platform / Cloud API como integración directa preferida.
- Webhooks propios hacia Techcomm Communications Gateway.
- Mensajes, archivos y eventos registrados en el historial del cliente.
- Estrategia **WhatsApp-first** para reducir dependencia de llamadas tradicionales.
- WhatsApp Calling sujeto a validación final de disponibilidad, reglas y proveedor para el número/WABA de Techcomm.

### Telefonía tradicional

Arquitectura objetivo:

- Número corporativo / carrier dominicano.
- SIP Trunk cuando sea viable comercial y técnicamente.
- Capa programable desacoplada.
- Evaluación inicial de Twilio BYOC, Telnyx u otra plataforma compatible.
- PSTN como canal esencial y fallback; no se elimina el teléfono tradicional.

### Evolución de telefonía

**Fase inicial recomendada:**

```text
Carrier RD → SIP → capa programable/BYOC → Techcomm AI
```

**Fase futura de alto volumen:**

```text
Carrier RD → SIP → Voice Gateway propio/Asterisk/FreeSWITCH → Techcomm AI
```

No se recomienda operar infraestructura SIP propia desde el primer día si el ahorro variable no compensa complejidad, seguridad y mantenimiento.

### Communications Gateway

La aplicación debe llamar abstracciones internas como:

```text
sendMessage()
sendWhatsApp()
makeCall()
startAICall()
sendEmail()
```

En vez de acoplar el negocio a funciones del proveedor.

Ejemplo conceptual:

```text
WhatsAppProvider = META
VoiceProvider = SIP_BYOC
AIProvider = OPENAI
TTSProvider = CONFIGURABLE
```

Esto permite sustituir proveedores sin reescribir órdenes, CRM, inventario o dashboards.

---

## 8. Stack tecnológico

### Aplicación

- Next.js.
- TypeScript.
- Tailwind CSS.
- Node.js.

### Datos y autenticación

- Supabase.
- PostgreSQL.
- Supabase Auth.
- Supabase Storage donde corresponda.
- Row Level Security.

### Automatización / IA

- OpenAI u otros modelos según función y costo.
- Orquestador de IA.
- n8n.
- Voz IA desacoplada del dominio de negocio.

### Hosting / infraestructura

- Vercel para aplicación cloud cuando aplique.
- Cloudflare para DNS, seguridad/túneles según arquitectura.
- Docker para componentes containerizados.
- Opción híbrida/self-hosted documentada para fases o componentes específicos.

### Observabilidad y seguridad operativa

- Sentry.
- Better Stack / monitoreo equivalente.
- Logs y auditoría.
- Backups.
- Health monitoring.

---

## 9. Estado del producto

Usamos cuatro estados para evitar confundir "diseñado" con "terminado":

- ✅ **Implementado / existente en el producto**.
- 🧪 **En pruebas / validación**.
- 🟡 **Diseñado o acordado; pendiente de implementación completa**.
- 🔴 **Pendiente / requiere información o desarrollo**.

### Estado general al 13-08-2026

| Área | Estado | Nota |
|---|---|---|
| Repositorio y base técnica | ✅ | Estructura activa con Next.js/TS/Supabase y documentación técnica. |
| Seguridad base | ✅ / 🧪 | RLS, auth, server-side controls y hardening documentados; continuar QA. |
| UI / sistema visual | ✅ / 🧪 | Rediseño y QA documentados en `/docs`. |
| Clientes / CRM | ✅ / 🧪 | Núcleo funcional presente; ampliar con reglas del socio. |
| Agenda / órdenes | ✅ / 🧪 | Base existente; adaptar flujo formal de Techcomm. |
| Técnicos | ✅ / 🧪 | Administración existente; portal operativo requiere completar reglas de campo. |
| Inventario | ✅ / 🧪 | Base y pruebas de carga existentes; integración productiva depende de sistema fuente. |
| Cotizaciones | 🟡 | Reglas funcionales ya levantadas; completar flujo productivo. |
| Garantías | 🟡 | Modelo de negocio definido en documento del socio; motor/reglas por completar. |
| Triage con IA | 🟡 | Arquitectura y flujo definidos; requiere validación funcional y datos reales. |
| WhatsApp Meta directo | 🟡 | Arquitectura objetivo; onboarding WABA/número y producción pendientes. |
| WhatsApp Calling | 🟡 | Evaluación técnica/comercial pendiente. |
| Telefonía SIP/BYOC | 🟡 | Arquitectura recomendada; cotización carrier y PoC pendientes. |
| Communications Gateway | 🟡 | Patrón objetivo para desacoplar proveedores. |
| Integración Andreina | 🔴 | Falta especificación técnica del sistema fuente. |
| Integración facturación/NCF | 🔴 | Falta especificación técnica y alcance fiscal definitivo. |
| Satisfacción / NPS | 🟡 | Requerido y reportado como trabajo en proceso por Techcomm. |
| Reportería gerencial completa | 🟡 | KPIs definidos; completar dataset y dashboards. |
| Asignación automática | 🔴 / Futuro | No requerida en fase actual; Techcomm solicita asignación manual. |
| Segundo documento del socio | 🔴 | Pendiente de recepción. |

---

## 10. Pruebas y escalabilidad

El repositorio contiene documentación específica para pruebas de aceptación y performance.

Se han trabajado escenarios de inventario con volúmenes sintéticos para validar comportamiento de carga, búsqueda, filtros, stock y escalabilidad. Estas pruebas no sustituyen la validación con datos reales del sistema fuente de Techcomm.

Documentos relevantes:

- [`docs/ACCEPTANCE_TESTS_V1.md`](docs/ACCEPTANCE_TESTS_V1.md)
- [`docs/PERFORMANCE_LOAD_TESTING.md`](docs/PERFORMANCE_LOAD_TESTING.md)
- [`docs/UI_REDESIGN_FINAL_QA.md`](docs/UI_REDESIGN_FINAL_QA.md)

---

## 11. KPIs requeridos por Techcomm

La plataforma debe poder construir o alimentar, según disponibilidad real de datos:

### Servicio y atención

- TAT: fecha creación → fecha cierre.
- Tiempo de contacto inicial.
- % clientes contactados exitosamente.
- Tiempo de programación de visita.
- Tiempo de respuesta.
- Tiempo de diagnóstico.
- Efectividad del triage.
- Servicios resueltos en primera visita.
- Reingreso hasta 30 y 90 días.

### Técnicos y rutas

- Productividad por técnico/día.
- Servicios completados por técnico.
- % visitas realizadas en fecha prometida.
- Cumplimiento de ruta.
- Disponibilidad operativa.
- Tiempos por etapa del servicio.

### Inventario

- Disponibilidad de inventario para reparación.
- Tiempo de abastecimiento de piezas no disponibles.
- Equipos esperando repuesto.
- Rotación de inventario.
- Precisión inventario físico vs sistema.
- Repuestos defectuosos.

### Finanzas

- Facturación mensual segmentada.
- Promedio de cobro por servicio.
- Margen de beneficios.
- Tasa de aprobación de presupuestos.
- Razones de rechazo de presupuesto / Pareto.

### Backlog

Órdenes pendientes segmentadas por:

- Diagnóstico.
- Espera de repuesto.
- Espera de cliente.
- Espera de pago.
- Visita programada.

### Experiencia de cliente

- Satisfacción de servicio.
- NPS.

---

## 12. Integraciones

### Sistema interno Andreina

Techcomm informó que clientes, técnicos, historial de órdenes e inventario se encuentran registrados en su sistema interno **Andreina**.

Antes de desarrollar la integración productiva deben confirmarse:

- Motor de base de datos.
- Acceso de red.
- API disponible o no.
- Tablas/vistas.
- Diccionario de datos.
- Volumen.
- Frecuencia de actualización.
- Estrategia de sincronización.
- Identificadores maestros.
- Reglas de escritura: read-only vs bidireccional.

### Patrones de integración previstos

- REST API.
- SQL Server.
- PostgreSQL.
- MySQL.
- Oracle.
- Excel/XLSX/CSV.
- SFTP/file drop.
- SharePoint/OneDrive.
- Agente privado para redes internas.
- Push firmado con HMAC cuando corresponda.

### Facturación

Existe software de facturación actual. El conector definitivo queda pendiente de identificar proveedor, API, datos fiscales, flujo NCF, responsabilidades y restricciones.

---

## 13. Seguridad

### Principios

- No almacenar secretos en el código fuente.
- Variables sensibles únicamente por environment/secrets manager.
- Supabase Auth.
- Row Level Security.
- Server-side authorization.
- Least privilege.
- Service keys solo en servidor.
- Aislamiento de técnico/usuario según rol.
- Logs de auditoría para operaciones sensibles.
- Validación de inputs.
- Límites de payload.
- HTTPS/TLS.
- HMAC SHA-256 para integraciones compatibles.
- Protección contra replay por timestamp/ventana.
- Grabaciones y evidencias privadas.
- URLs firmadas y temporales cuando se compartan archivos protegidos.
- Backups y pruebas de restauración.
- Actualización de dependencias.
- Cierre por inactividad.
- Cambio de contraseña / recuperación.
- MFA, WAF y CSP más estricta como hardening futuro cuando corresponda.

### Importante sobre este repositorio

El repositorio GitHub se encuentra actualmente configurado como **público**. Por tanto, ningún secreto, credencial, token, API key, dato de cliente, grabación ni información confidencial de Techcomm debe incorporarse al repositorio.

La política anterior que describía el repositorio como "privado" no debe considerarse válida mientras GitHub mantenga esta configuración.

Ver también [`SECURITY.md`](SECURITY.md).

---

## 14. Grabaciones, datos y cumplimiento

Techcomm indicó que el órgano regulador no establece en el levantamiento recibido un plazo específico de retención de grabaciones. También indicó como referencia que el Reglamento para la Solución de Controversias de INDOTEL, Resolución 091-2020, contempla un plazo de tres meses para que el cliente presente una queja formal ante la prestadora.

**Esto no se interpreta aquí como una política legal automática de retención.** La política final debe ser confirmada por Techcomm y/o su asesor legal.

Requerimientos del sistema:

- Política configurable de retención.
- Almacenamiento privado.
- Eliminación controlada.
- Trazabilidad de acceso.
- Búsqueda histórica por caso/cliente/orden cuando esté autorizada.
- Capacidad de atender una solicitud recibida por correo o notificación legal según el proceso de Techcomm.

---

## 15. Arquitectura de costos

El presupuesto no debe presentar un único número mezclando desarrollo y operación.

### A. Implementación — one-time

Incluye, según alcance final:

- Discovery y definición de reglas.
- Arquitectura.
- UI/UX.
- Frontend.
- Backend.
- Base de datos.
- Auth/roles/RLS.
- IA y orquestación.
- Comunicaciones.
- Integraciones.
- Inventario.
- Portal técnico.
- Reporterías.
- Seguridad.
- QA/UAT.
- Deployment.
- Documentación.
- Capacitación.
- Go-live y estabilización.

### B. OPEX fijo mensual

- Hosting.
- Base de datos.
- Storage base.
- Backups.
- Monitoreo.
- Dominios/DNS si aplica.
- Mantenimiento de componentes propios.
- Soporte según plan.

### C. OPEX variable

Debe modelarse por consumo:

- Llamadas entrantes/salientes.
- Minutos PSTN/SIP/BYOC.
- WhatsApp messages/templates.
- WhatsApp Calling si se adopta.
- Voz IA / TTS / STT.
- OpenAI/LLM por tokens o modalidad aplicable.
- Grabaciones.
- Transcripción.
- Almacenamiento de audio.
- Fotos/videos/evidencias.
- Maps/geocoding/rutas.
- Correo/SMS si se incorpora.

### Escenarios económicos a calcular

El modelo financiero V1 debe poder simular como mínimo:

- 1,000 casos/mes.
- 5,000 casos/mes.
- 10,000 casos/mes.
- 25,000 casos/mes.

Y sensibilidad de llamadas de 3, 5 y 10 minutos, porcentaje digital vs voz y número de mensajes/evidencias por caso.

### Estimación de desarrollo V1

Con el primer documento del socio y antes de recibir el segundo, la valoración preliminar del alcance completo identificado se está manejando como **rango de trabajo, no cotización final**. El presupuesto debe cerrarse después de:

1. Completar el segundo levantamiento.
2. Marcar qué módulos ya existen vs qué debe construirse.
3. Estimar horas por módulo.
4. Cotizar integraciones reales.
5. Verificar precios actuales de proveedores.
6. Definir volumen de operación.
7. Aplicar contingencia y margen.

Ver [`docs/BUDGET_MASTER_SCOPE.md`](docs/BUDGET_MASTER_SCOPE.md).

---

## 16. Datos que todavía necesitamos del socio

Antes del cierre comercial deben confirmarse, como mínimo:

- Segundo documento funcional prometido.
- Prioridades reales de los módulos.
- Presupuesto objetivo o rango disponible.
- Fecha límite / evento de salida.
- Responsable operativo del proyecto.
- Responsable con autoridad para aprobar cambios.
- Casos/órdenes mensuales.
- Llamadas entrantes mensuales.
- Llamadas salientes mensuales.
- Duración promedio de llamadas.
- Volumen mensual de WhatsApp.
- Emails mensuales.
- % casos que requieren visita.
- Fotos/videos promedio por caso.
- Usuarios concurrentes.
- Cantidad final de roles y usuarios.
- SLA esperado.
- Horarios de operación y excepciones.
- Política de descuentos.
- Tarifario oficial completo.
- Políticas de devolución/reembolso.
- Política final de grabaciones y datos.
- Reglas de escalamiento humano.
- Datos técnicos de Andreina.
- Datos técnicos del sistema de facturación.
- Política de backups/retención.
- Carrier actual y posibilidad de SIP Trunk/BYOC.
- Número/WABA de WhatsApp Business y estado en Meta.

---

## 17. Roadmap

### Fase 1 — MVP operativo

Prioridad: operar el flujo principal sin intentar automatizar prematuramente toda la empresa.

- Atención / CRM.
- Clientes y equipos.
- Órdenes.
- Garantías.
- Triage.
- Evidencias.
- Cotizaciones.
- Pagos básicos / estados.
- Agenda.
- Asignación manual.
- Portal técnico.
- Inventario esencial.
- Comunicaciones prioritarias.
- Dashboard operativo.
- Auditoría y seguridad base.

### Fase 2 — Integraciones y automatización

- Integración Andreina.
- Integración facturación/NCF.
- Inventario avanzado.
- Sincronización de fuentes.
- Automatizaciones n8n.
- Communications Gateway consolidado.
- WhatsApp productivo.
- Telefonía SIP/BYOC.
- Voz IA.
- Reporterías financieras y gerenciales completas.
- Satisfacción/NPS.

### Fase 3 — Inteligencia operacional

- Recomendación inteligente de técnico.
- Asignación automática cuando Techcomm esté preparado.
- Optimización de rutas.
- Predicción de repuestos.
- Forecast de inventario.
- Detección de riesgo de reingreso.
- Asistencia predictiva al triage.
- Analítica de calidad de llamadas/conversaciones.
- Optimización automática de canales por costo y probabilidad de resolución.

---

## 18. Estrategia comercial

Para presentar al socio se deben separar claramente:

1. **Valor de implementación.**
2. **Costo incremental real de desarrollo.**
3. **Módulos opcionales / fases futuras.**
4. **Costo fijo mensual de plataforma.**
5. **Costo variable por uso.**
6. **Soporte y mantenimiento.**
7. **Contingencia de integración.**
8. **Margen comercial.**
9. **Precio mínimo negociable.**
10. **Precio objetivo.**
11. **Opción premium.**

El objetivo es que el socio pueda entender cuánto cuesta construir, cuánto cuesta operar, qué mueve el OPEX y cómo escala el costo por caso.

---

## 19. Documentación del repositorio

Documentos clave existentes:

- [`docs/BUDGET_MASTER_SCOPE.md`](docs/BUDGET_MASTER_SCOPE.md) — alcance maestro para presupuesto.
- [`docs/ACCEPTANCE_TESTS_V1.md`](docs/ACCEPTANCE_TESTS_V1.md) — pruebas de aceptación.
- [`docs/PERFORMANCE_LOAD_TESTING.md`](docs/PERFORMANCE_LOAD_TESTING.md) — estrategia/pruebas de performance.
- [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) — opción de despliegue/self-hosting.
- [`docs/UI_REDESIGN_FINAL_QA.md`](docs/UI_REDESIGN_FINAL_QA.md) — QA del rediseño.
- [`SECURITY.md`](SECURITY.md) — seguridad del repositorio/aplicación.

---

## 20. Principios de diseño

- No automatizar por automatizar.
- Mantener humano en el loop cuando el proceso lo requiera.
- Priorizar trazabilidad sobre magia negra de IA.
- Diseñar por dominios de negocio, no por proveedor.
- Evitar vendor lock-in.
- Mantener separación entre core operacional y canales.
- Medir costo por caso, no solo costo mensual.
- Escalar infraestructura cuando el volumen lo justifique.
- Mantener seguridad y cumplimiento desde el diseño.
- No confundir prototipo funcional con producción aprobada.
- No declarar una integración como terminada hasta probarla con el sistema real.
- Toda cifra de terceros debe verificarse nuevamente antes de una propuesta comercial.

---

## 21. Changelog de esta actualización

### 13-08-2026 — README maestro V2

- Reemplazado README de etapa inicial por documentación maestra del estado real.
- Incorporado el primer levantamiento funcional de Atención al Cliente.
- Incorporados garantías, triage, cotizaciones, técnicos, inventario, pagos y KPIs.
- Documentada Arquitectura B optimizada.
- Documentado patrón Techcomm Communications Gateway.
- Separados estados implementado / pruebas / diseñado / pendiente.
- Incorporada estrategia WhatsApp-first + SIP/BYOC como arquitectura objetivo.
- Documentadas dependencias de Andreina y facturación.
- Incorporada estructura de costos CAPEX/OPEX/variable.
- Incorporados escenarios de dimensionamiento.
- Incorporado roadmap por fases.
- Corregida la referencia de seguridad del repositorio: actualmente GitHub lo reporta como público.
- Consolidada la documentación técnica existente en `/docs`.

---

## Aviso

Este README es el **documento maestro técnico-operativo del proyecto**, no una propuesta contractual ni una cotización cerrada. El alcance, fechas y costos comerciales deben mantenerse versionados y actualizarse cuando llegue nueva documentación del socio o cambien precios/condiciones de proveedores externos.
