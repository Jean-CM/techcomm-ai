# Techcomm Operations

> Plataforma operativa y de inteligencia artificial para la gestión integral de atención al cliente, órdenes de servicio, técnicos, inventario, cotizaciones, comunicaciones y analítica de Techcomm Wireless.

**Estado del proyecto:** desarrollo activo / definición funcional con socio  
**Última actualización:** 13 de agosto de 2026  
**Repositorio principal:** `Jean-CM/techcomm-ai`  
**Branch estable:** `main`

---

## 1. Visión del proyecto

Techcomm Operations es la plataforma tecnológica central propuesta para **SERVICIOS DE TELECOMUNICACIONES TECHCOMM, S.R.L.**, comercialmente **Techcomm Wireless**, con foco inicial en la operación de atención al cliente y servicio técnico en República Dominicana.

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
- Equipo interno aproximado: 2 atención a clientes, 2 atención a fabricantes y tiendas, 2 soporte técnico externo, 3 técnicos internos, 1 supervisor de atención y 1 supervisor técnico.
- 5 cuadrillas externas subcontratadas en Santo Domingo con cobertura nacional.
- 1 cuadrilla externa subcontratada en Santiago.
- Capacidades indicadas: 47 instalaciones/día, 36 diagnósticos/día y 30 reparaciones/día.
- La empresa se encuentra en proceso de mejora operativa para reducir carga manual y optimizar la operación.

---

## 3. Servicios y equipos cubiertos

### Tipos de servicio

- Instalación de electrodomésticos.
- Mantenimiento de electrodomésticos.
- Reparación de electrodomésticos.
- Desinstalación de electrodomésticos.

### Categorías principales

Televisores, monitores TV, neveras, aires acondicionados, lavadoras, estufas, secadoras, lavadoras-secadoras, lavavajillas, hornos, microondas, microondas-extractor, pequeños electrodomésticos y equipos relacionados.

### Marcas y comercios mencionados

LG, Samsung, TCL, Black & Decker y otras marcas según artículo. Entre los comercios mencionados están Grupo Ramos, Plaza Lama y Ochoa.

Las tarifas pueden variar según equipo, servicio y nivel de reparación.

---

## 4. Modelo de garantías

La plataforma debe soportar:

- **Garantía fabricante**: cobertura según fecha de venta si existe factura o fecha de fabricación cuando no existe.
- **Garantía fabricante parcial**: extensión sobre piezas específicas.
- **Garantía fabricante promoción**: condiciones extraordinarias informadas por fabricante.
- **Garantía tienda/distribuidor**: trabajos asumidos por comercio/distribuidor cuando corresponda.
- **Garantía Techcomm**: 30 días sobre la misma reparación luego de la entrega.
- **Fuera de garantía**: equipos sin cobertura o excluidos por maltrato, rotura, humedad o intervención no autorizada.

Estas reglas deben evolucionar hacia un motor auditable y configurable.

---

## 5. Flujo de atención objetivo

### Canales

WhatsApp, llamadas telefónicas, correo electrónico, página del fabricante, redes sociales, call center y portal/web en fases posteriores.

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

### Atención y CRM
Clientes/Customer 360, contactos, direcciones/geolocalización, equipos, órdenes, conversaciones, evidencias y estado del caso.

### Órdenes de servicio
Solicitud, tipo de servicio/cliente, marca/modelo/serial, garantía, triage, estados, programación, técnico, repuestos, pagos, evidencias, aceptación/rechazo, cierre y reingreso.

### Triage e IA
Captura de síntomas, análisis de conversación, solicitud guiada de evidencias, diagnóstico preliminar asistido, posibles repuestos, resumen, intención, asistencia al agente y escalamiento humano. La IA será asistiva y auditable.

### Cotizaciones
Cliente, equipo, diagnóstico, mano de obra, repuestos, flete, materiales, impuestos, total, términos, formas de pago y autorización. Las cotizaciones estándar no requieren aprobación del supervisor; casos fuera de estándar/descuentos sí pueden requerirla. Una cotización autorizada y con pagos correspondientes podrá convertirse en orden de trabajo.

### Agenda y despacho
La asignación de técnicos **permanece manual en la fase actual**. El coordinador debe disponer de ubicación, equipo, garantía, síntomas, evidencias, triage, diagnóstico, distancia/ruta, fecha, disponibilidad, repuestos, stock, herramientas, pagos y cobros pendientes. La asignación automática queda como evolución futura.

### Portal del técnico
Agenda, salida, llegada, trabajo, datos del caso, diagnóstico, repuestos, evidencias, formulario firmado, aceptación/rechazo y finalización condicionada a evidencias obligatorias. Los técnicos todavía no tienen smartphones corporativos; sus dispositivos personales son mayormente Android. Se evaluará operación offline según alcance final.

### Kilometraje y rutas
La operación reporta cálculo desde Casa Central Techcomm Pantoja mediante Google Maps, ida y vuelta. Para fuera de garantía fuera del Gran Santo Domingo se reporta referencia de **RD$20/km**, sujeta a acuerdos por cliente.

### Inventario y repuestos
SKU/código/barcode/modelo/fabricante, existencia física, disponible/reservado/pendiente, solicitud y reserva por OS, entrega al técnico, consumo, compras, prepago fuera de garantía, movimientos, auditoría, reorden, mínimos/máximos, proveedores e integración externa. Los técnicos no mantienen inventario fijo en vehículos.

### Pagos y facturación
Medios declarados: transferencia, tarjeta y efectivo. Diagnóstico, flete y repuesto se pagan adelantados; mano de obra después del servicio. Se requieren NCF para crédito fiscal y consumidor final. La integración fiscal definitiva depende del sistema de facturación existente.

---

## 7. Comunicaciones — Arquitectura B optimizada

Principio: **Techcomm Operations debe ser el cerebro. Los proveedores de canal deben ser reemplazables.**

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
              Techcomm Operations
                       │
                       ▼
              PostgreSQL / Supabase
```

### WhatsApp
Meta WhatsApp Business Platform / Cloud API directa como opción preferida; webhooks propios; mensajes/archivos/eventos registrados; estrategia WhatsApp-first. WhatsApp Calling queda sujeto a validación final del número/WABA y disponibilidad.

### Telefonía
Número corporativo/carrier dominicano, SIP Trunk cuando sea viable y capa programable desacoplada. Se evaluarán Twilio BYOC, Telnyx u otras alternativas. PSTN continúa como canal esencial y fallback.

### Evolución
Fase inicial: `Carrier RD → SIP → capa programable/BYOC → Techcomm Operations/AI`.

Fase futura de alto volumen: `Carrier RD → SIP → Voice Gateway propio/Asterisk/FreeSWITCH → Techcomm Operations/AI`.

No se recomienda infraestructura SIP propia desde el primer día si el ahorro no compensa complejidad, seguridad y mantenimiento.

### Communications Gateway
La aplicación debe utilizar abstracciones como `sendMessage()`, `sendWhatsApp()`, `makeCall()`, `startAICall()` y `sendEmail()`, evitando acoplar el dominio a un proveedor concreto.

---

## 8. Stack tecnológico

- **Aplicación:** Next.js, TypeScript, Tailwind CSS, Node.js.
- **Datos/Auth:** Supabase, PostgreSQL, Supabase Auth/Storage, RLS.
- **IA/automatización:** OpenAI u otros modelos según función/costo, orquestador de IA, n8n y voz desacoplada.
- **Infraestructura:** Vercel, Cloudflare, Docker y opción híbrida/self-hosted.
- **Observabilidad:** Sentry, Better Stack/equivalente, logs, auditoría, backups y health monitoring.

---

## 9. Estado del producto

Estados oficiales:

- ✅ **Implementado / existente**.
- 🧪 **En pruebas / validación**.
- 🟡 **Diseñado / aprobado conceptualmente**.
- 🔴 **Pendiente de desarrollo o información**.

### Implementado o existente

- Base de Techcomm Operations.
- Dashboard operativo.
- Clientes / CRM.
- Agenda.
- Técnicos.
- Órdenes.
- Productos/inventario base.
- Conversaciones.
- Health monitor.
- Controles de agenda.
- Autenticación/base de seguridad.
- Estructura Supabase/PostgreSQL.
- Integración/arquitectura externa preparada.
- Documentación técnica del repositorio.

### En pruebas

- Inventario/catálogo de mayor volumen.
- Pruebas con datasets sintéticos de 1,000 y 5,000 SKU.
- Búsqueda, filtros, stock y escalabilidad.
- Pruebas de aceptación y carga documentadas.

### Diseñado / por implementar o completar

- Motor completo de garantías.
- Triage formal y reglas de IA.
- Cotización completa.
- Pagos y aprobación.
- Flujo completo de repuestos.
- Portal técnico final.
- Evidencias/firma.
- NPS.
- Integración fiscal/NCF.
- Integración definitiva con Andreina.
- Meta Cloud API directa.
- Communications Gateway.
- SIP/BYOC/carrier.
- WhatsApp Calling.
- KPIs gerenciales completos.
- Motor futuro de asignación automática.

---

## 10. Integraciones

### Andreina
Sistema interno actual mencionado por Techcomm para gestionar órdenes, técnicos, cotizaciones, facturación e inventario. La integración real depende de documentación técnica pendiente: motor de BD, acceso, tablas/vistas/API, diccionario de datos, autenticación, red y volumen.

### Inventario / ERP
Patrones preparados/documentados para Excel/XLSX/CSV, SQL Server, PostgreSQL, MySQL, Oracle, REST API, SFTP/file drop, SharePoint/OneDrive y agente de red privada con firma HMAC.

---

## 11. Seguridad

Supabase Auth, autorización server-side, owner/admin checks, aislamiento de técnicos, RLS, credenciales solo servidor, secretos fuera de tablas, HMAC SHA-256, protección replay, HTTPS/TLS, límites de payload, validación, almacenamiento privado, URLs firmadas temporales, logs de auditoría, logout por inactividad, password reset/first login, security headers, mantenimiento de dependencias y backup/restore testing.

Pendiente definir con el socio: MFA/WAF/CSP si aplica, retención de datos, retención de grabaciones y requisitos regulatorios definitivos.

---

## 12. KPIs objetivo

TAT, tiempo de contacto inicial, programación, productividad, cumplimiento de ruta, First-Time-Fix/First-Visit Resolution, reingresos, duración de diagnóstico, efectividad del triage, disponibilidad/rotación/faltantes de inventario, lead time, facturación, ticket promedio, margen, aprobación/rechazo de presupuestos, órdenes pendientes, satisfacción y NPS.

---

## 13. Modelo económico

El presupuesto debe separar obligatoriamente:

1. Implementación/desarrollo inicial.
2. Infraestructura mensual fija.
3. Consumo variable.
4. Soporte/mantenimiento.
5. Módulos opcionales/futuros.
6. Contingencia de integración.
7. Margen comercial.

### Costos variables a modelar

- WhatsApp/Meta.
- Telefonía PSTN/SIP.
- WhatsApp Calling.
- Voz IA.
- OpenAI/modelos.
- Transcripción.
- Grabaciones.
- Storage de fotos/videos/documentos.
- Maps/geocoding/routes.
- Email/SMS si aplica.
- Vercel/Supabase overages.
- Logs/monitoring/backups.

### Escenarios

Se modelarán al menos 1,000, 5,000, 10,000 y 25,000 casos/mes, calculando mensajes, llamadas, minutos, IA, storage, infraestructura, costo/caso, costo/conversación, costo/minuto, OPEX mensual/anual y precio/margen recomendado.

---

## 14. Estrategia comercial

No presentar un único número que mezcle todo. La propuesta debe separar inversión inicial, mensualidad/plataforma, consumo incluido, consumo adicional, soporte y opcionales. Se definirán precio mínimo, precio objetivo y precio premium/negociación.

Los cargos operativos que Techcomm facture a sus clientes finales no deben confundirse con CAPEX/OPEX tecnológico de Techcomm Operations.

---

## 15. Roadmap

### Fase 1 — MVP operativo
Atención/CRM, clientes, OS, garantía base, triage, cotización, agenda manual, técnicos, evidencias, inventario básico, dashboard, autenticación y auditoría.

### Fase 2 — Integración y automatización
Andreina, facturación/NCF, inventario avanzado, Meta WhatsApp, Communications Gateway, telefonía/SIP, pagos, reportería avanzada, automatizaciones y comunicaciones proactivas.

### Fase 3 — Inteligencia operacional
Asignación inteligente, optimización de rutas, predicción de repuestos, forecasting, IA avanzada, analítica predictiva y optimización automática de canales/costos.

---

## 16. Información pendiente del socio

Segundo documento funcional; prioridades; presupuesto; fecha objetivo; aprobadores; volúmenes mensuales de casos/órdenes, llamadas y WhatsApp; duración promedio; emails; visitas; evidencias; usuarios/roles; Andreina; facturación; retención; SLA; escalamiento humano; políticas regulatorias; promociones; descuentos; devoluciones; horarios excepcionales; backup/DR.

Estos pendientes no impiden construir una estimación V1 parametrizada, pero impiden cerrar el precio contractual definitivo sin supuestos.

---

## 17. Documentación del repositorio

La carpeta `docs/` contiene documentación especializada, incluyendo `BUDGET_MASTER_SCOPE.md`, `ACCEPTANCE_TESTS_V1.md`, `PERFORMANCE_LOAD_TESTING.md`, `SELF_HOSTING.md` y documentación de QA/rediseño UI.

El README es el **mapa maestro del proyecto**; los documentos especializados contienen el detalle técnico/operativo.

---

## 18. Reglas de proyecto

- No confundir prototipo con producción.
- No marcar diseñado como implementado.
- No inventar tarifas ni volúmenes faltantes.
- Revalidar precios de terceros antes de propuesta final.
- Mantener proveedores desacoplados cuando sea razonable.
- Seguridad y trazabilidad desde diseño.
- Automatizar progresivamente sin romper la operación actual.
- Toda funcionalidad nueva debe mapearse a proceso, costo, riesgo y KPI.
- El segundo documento del socio se incorporará mediante delta de alcance.

---

## 19. Repositorio y confidencialidad

El repositorio es actualmente público. No deben almacenarse secrets, tokens, credenciales, datos reales de clientes, grabaciones, documentos confidenciales ni información sensible de producción. Antes de producción debe revisarse la estrategia de visibilidad y acceso del repositorio.

---

## 20. Próximos pasos

1. Completar modelo de costos V1.
2. Comparar Meta directo + SIP/BYOC + Telnyx/Twilio/carrier local.
3. Calcular OPEX por escenario.
4. Estimar horas y valor de desarrollo por módulo.
5. Separar costo real, precio comercial y margen.
6. Recibir segundo documento del socio.
7. Ejecutar delta V1 → V2.
8. Preparar business case y propuesta final.

---

**Nombre oficial del proyecto: Techcomm Operations.**

Este README es un documento vivo y debe actualizarse cuando cambien el alcance, arquitectura, costos, integraciones o decisiones confirmadas con Techcomm.