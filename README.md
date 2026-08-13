# Techcomm Operations

> Plataforma modular de operaciones, atención al cliente e inteligencia artificial diseñada para centralizar procesos de servicio, comunicaciones, órdenes de trabajo, técnicos, inventario, cotizaciones, pagos, evidencias, analítica e integraciones empresariales.

**Estado del proyecto:** desarrollo activo / definición funcional y comercial  
**Última actualización:** 13 de agosto de 2026  
**Repositorio principal:** `Jean-CM/techcomm-ai`  
**Branch estable:** `main`

---

## 1. Visión del producto

Techcomm Operations se está construyendo como una **plataforma operativa reutilizable y extensible**, no como una solución rígida para una sola empresa.

El primer caso real de implementación se está levantando con Techcomm Wireless, pero la arquitectura debe permitir que el mismo núcleo pueda adaptarse posteriormente a otras empresas, industrias, marcas, talleres, distribuidores, operaciones de campo o negocios de servicio sin rehacer el producto desde cero.

El principio rector es:

> **El núcleo del producto debe ser genérico; las reglas específicas de cada empresa deben ser configurables.**

Por eso, conceptos como clientes, órdenes, garantías, técnicos, inventario, cotizaciones, canales, pagos, documentos, evidencias, roles, KPIs e integraciones deben mantenerse desacoplados de una empresa concreta siempre que sea técnicamente razonable.

---

## 2. Objetivo general

La plataforma busca orquestar el ciclo completo de una operación de servicio:

1. Recepción del contacto.
2. Identificación del cliente, cuenta o empresa.
3. Registro del producto, activo o servicio relacionado.
4. Clasificación del requerimiento.
5. Validación de reglas de cobertura, contrato o garantía.
6. Triage o diagnóstico preliminar.
7. Solicitud y recepción de documentos o evidencias.
8. Cotización cuando aplique.
9. Confirmación de autorización o pago.
10. Validación de materiales, repuestos o inventario.
11. Programación.
12. Asignación de personal o técnico.
13. Ejecución del trabajo.
14. Captura de tiempos, evidencias y firma/aceptación.
15. Cierre del caso u orden.
16. Encuesta de satisfacción.
17. Analítica operativa, financiera y gerencial.

El flujo exacto puede variar por empresa y debe parametrizarse mediante reglas de negocio.

---

## 3. Estrategia de producto multiempresa

La plataforma se diseña desde ahora para poder evolucionar hacia una arquitectura **multi-organización / multi-tenant**.

Cada organización podrá tener progresivamente su propia configuración de:

- Nombre comercial e identidad visual.
- Usuarios y roles.
- Sucursales, almacenes y zonas.
- Tipos de servicio.
- Productos, activos o equipos.
- Reglas de garantía/cobertura.
- Tarifarios.
- Impuestos.
- Moneda.
- Formas de pago.
- Técnicos y proveedores.
- Horarios y capacidad operativa.
- Estados de orden.
- Reglas de aprobación.
- Inventario.
- Plantillas de mensajes.
- Canales de atención.
- KPIs.
- Integraciones externas.
- Reglas de IA.
- Políticas de retención y auditoría.

### Regla arquitectónica

No se deben codificar nombres de clientes, tarifas, teléfonos, garantías, centros, marcas o reglas comerciales directamente en el núcleo cuando puedan convertirse en configuración.

---

## 4. Implementación de referencia actual — Techcomm Wireless

El primer levantamiento formal corresponde a **SERVICIOS DE TELECOMUNICACIONES TECHCOMM, S.R.L. / Techcomm Wireless**, República Dominicana.

El documento de descubrimiento recibido y completado el 11 de agosto de 2026 constituye la principal fuente funcional V1 para este caso de implementación. Existe un segundo documento pendiente del socio.

Los requerimientos específicos de Techcomm se utilizan para validar la plataforma en un escenario real, pero deben implementarse de forma que las capacidades reutilizables permanezcan disponibles para futuras organizaciones.

### Datos operativos declarados en el caso Techcomm

- Operación en República Dominicana.
- Atención a clientes, fabricantes y tiendas.
- Soporte técnico interno y externo.
- Supervisión de atención y técnica.
- Cuadrillas externas en Santo Domingo y Santiago.
- Cobertura nacional mediante operación propia/subcontratada.
- Capacidades indicadas de 47 instalaciones, 36 diagnósticos y 30 reparaciones por día.

### Servicios del caso actual

- Instalación.
- Mantenimiento.
- Reparación.
- Desinstalación.

### Equipos del caso actual

Televisores, monitores, neveras, aires acondicionados, lavadoras, estufas, secadoras, lavadoras-secadoras, lavavajillas, hornos, microondas y pequeños electrodomésticos, entre otros.

Estos catálogos deben vivir como datos configurables y no como límites del producto.

---

## 5. Dominios funcionales de la plataforma

### 5.1 Organizaciones y configuración

- Organizaciones/tenants.
- Perfil empresarial.
- Sucursales y centros de operación.
- Usuarios, roles y permisos.
- Parámetros comerciales.
- Horarios.
- Catálogos configurables.
- Plantillas.
- Reglas de negocio.

### 5.2 CRM / Customer 360

- Clientes y cuentas.
- Contactos.
- Direcciones.
- Geolocalización.
- Productos/activos asociados.
- Historial de servicios.
- Historial de conversaciones.
- Documentos y evidencias.
- Estado de casos abiertos.

### 5.3 Casos y órdenes de servicio

- Registro de solicitud.
- Tipo de servicio.
- Canal de origen.
- Prioridad.
- Producto/activo.
- Diagnóstico/triage.
- Garantía/cobertura.
- Estados configurables.
- Agenda.
- Técnico o responsable.
- Inventario/repuestos.
- Pagos.
- Evidencias.
- Aceptación/rechazo.
- Cierre.
- Reapertura/reingreso.
- SLA y tiempos.

### 5.4 Garantías, contratos y coberturas

El motor debe soportar múltiples tipos de cobertura y permitir que cada organización configure sus propias reglas.

El caso Techcomm actualmente requiere garantía de fabricante, fabricante parcial, promoción, tienda/distribuidor, garantía propia de reparación y fuera de garantía.

La arquitectura objetivo es un **motor de reglas configurable y auditable**, evitando condicionar el producto a un único modelo de garantía.

### 5.5 Triage e inteligencia artificial

- Captura estructurada de síntomas.
- Análisis de conversación.
- Clasificación de intención.
- Solicitud guiada de evidencias.
- Diagnóstico preliminar asistido.
- Sugerencia de próximos pasos.
- Identificación de posibles materiales/repuestos.
- Resumen automático.
- Asistencia al agente humano.
- Escalamiento.
- Base de conocimiento por organización.

La IA será asistiva, trazable y desacoplada del proveedor de modelo.

### 5.6 Cotizaciones y aprobaciones

- Cliente/cuenta.
- Producto/activo.
- Diagnóstico.
- Mano de obra.
- Materiales/repuestos.
- Transporte/flete.
- Impuestos.
- Descuentos.
- Total.
- Vigencia.
- Términos y condiciones.
- Formas de pago.
- Aprobación interna cuando aplique.
- Autorización del cliente.
- Conversión a orden de trabajo.

Las reglas de aprobación deben ser parametrizables por organización.

### 5.7 Agenda, capacidad y despacho

- Calendario operacional.
- Capacidad por día/franja.
- Zonas.
- Disponibilidad.
- Especialidad.
- Carga de trabajo.
- Inventario requerido.
- Ruta/distancia.
- Fecha solicitada.
- Técnicos internos/externos.
- Asignación manual.
- Sugerencia automática futura.
- Optimización automática futura.

### 5.8 Portal de técnicos / personal de campo

- Agenda asignada.
- Check-out/salida.
- Llegada.
- Inicio/fin.
- Diagnóstico.
- Materiales/repuestos utilizados.
- Fotografías/videos.
- Documentos.
- Firma.
- Aceptación/rechazo.
- Observaciones.
- Geolocalización cuando aplique.
- Operación offline futura cuando sea necesaria.

### 5.9 Inventario y logística

- SKU/código/barcode.
- Categoría/modelo/fabricante.
- Almacenes.
- Existencia física.
- Disponible.
- Reservado.
- Pendiente.
- Mínimos/máximos.
- Reorden.
- Reserva por orden.
- Entrega a técnico.
- Consumo.
- Devolución.
- Compras.
- Proveedores.
- Movimientos.
- Auditoría.
- Integración con ERP o fuente maestra.

### 5.10 Pagos, facturación y fiscalidad

- Efectivo.
- Transferencia.
- Tarjeta.
- Pagos anticipados/parciales/finales.
- Balance pendiente.
- Facturación.
- Impuestos.
- Integración fiscal.
- Integración con ERP/contabilidad.

Las reglas fiscales serán específicas por país/empresa y deben mantenerse fuera del núcleo genérico.

### 5.11 Satisfacción y calidad

- Encuestas.
- CSAT.
- NPS.
- Razones de insatisfacción.
- Reingresos.
- First-Time-Fix / First-Visit Resolution.
- Auditoría de llamadas y conversaciones.
- Evaluación de técnicos/agentes.

---

## 6. Communications Gateway — arquitectura desacoplada

La plataforma no debe depender de un solo proveedor de comunicaciones.

```text
                       CLIENTES
                          │
           ┌──────────────┼──────────────┐
           │              │              │
        WhatsApp       Telefonía      Web/Email
           │              │              │
           ▼              ▼              ▼
       Meta/BSP        SIP/Carrier     API/SMTP
           │              │              │
           └──────────────┼──────────────┘
                          ▼
               Communications Gateway
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
       AI/LLM          Voice AI         Reglas
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                 Operations Platform
                          │
                          ▼
                 PostgreSQL / Supabase
```

### Abstracciones internas

El dominio debe utilizar interfaces como:

```text
sendMessage()
sendWhatsApp()
makeCall()
startAICall()
sendEmail()
```

En lugar de acoplar cada módulo a Twilio, Meta, Telnyx, OpenAI, ElevenLabs u otro proveedor específico.

### Estrategia inicial de canales

- WhatsApp Business Platform / Cloud API directa cuando sea conveniente.
- Webhooks propios.
- SIP/carrier para telefonía empresarial cuando corresponda.
- BYOC/capa programable según costo y complejidad.
- PSTN como canal de respaldo y accesibilidad.
- Voz IA desacoplada.
- Proveedores sustituibles mediante adapters.

### Evolución de alto volumen

La plataforma podrá evolucionar desde servicios administrados/BYOC hacia infraestructura SIP/Voice Gateway propia cuando el volumen y ahorro justifiquen la complejidad.

---

## 7. Stack tecnológico actual

### Aplicación

- Next.js.
- TypeScript.
- Tailwind CSS.
- Node.js.

### Datos y autenticación

- Supabase.
- PostgreSQL.
- Supabase Auth.
- Supabase Storage.
- Row Level Security.

### IA y automatización

- OpenAI u otros modelos según costo/capacidad.
- Orquestador de IA.
- n8n.
- Voz IA configurable.

### Infraestructura

- Vercel.
- Cloudflare.
- Docker.
- Arquitectura híbrida/self-hosted para componentes que lo requieran.

### Observabilidad

- Sentry.
- Better Stack o equivalente.
- Logs.
- Auditoría.
- Backups.
- Health monitoring.

---

## 8. Estrategia de datos multi-tenant

La evolución del modelo de datos debe contemplar separación por organización.

Patrón objetivo conceptual:

```text
organization_id
   ├── users
   ├── customers
   ├── assets
   ├── work_orders
   ├── technicians
   ├── inventory
   ├── quotes
   ├── payments
   ├── conversations
   ├── documents
   ├── integrations
   └── settings
```

Principios:

- Aislamiento lógico por tenant.
- RLS por organización.
- Configuración por tenant.
- Auditoría por tenant.
- Integraciones independientes.
- Storage segmentado.
- Nunca mezclar información entre empresas.

La migración definitiva a multi-tenant deberá planificarse cuidadosamente antes de incorporar una segunda organización productiva.

---

## 9. Integraciones empresariales

El producto debe poder conectarse a distintas fuentes mediante adapters/conectores:

- REST API.
- Webhooks.
- SQL Server.
- PostgreSQL.
- MySQL.
- Oracle.
- Excel/XLSX/CSV.
- SFTP/file drop.
- SharePoint/OneDrive.
- ERP.
- CRM.
- Facturación.
- Sistemas de inventario.
- Sistemas legacy en redes privadas.

Para redes privadas se contempla un agente/conector con autenticación y firma HMAC.

### Caso Techcomm

El sistema interno mencionado actualmente es **Andreina**. Su integración queda como adaptación específica de la primera implementación, no como dependencia del núcleo del producto.

---

## 10. Seguridad

- Autenticación robusta.
- Autorización server-side.
- Roles y permisos.
- Aislamiento multi-tenant.
- RLS.
- Service credentials solo servidor.
- Secret management.
- HTTPS/TLS.
- HMAC para integraciones.
- Protección contra replay.
- Validación de inputs.
- Límites de payload.
- Storage privado.
- URLs firmadas temporales.
- Audit logs.
- Logout por inactividad.
- Password reset/first login.
- Security headers.
- Dependency management.
- Backups y pruebas de restauración.
- MFA/WAF/CSP según criticidad.
- Retención configurable.

El repositorio no debe contener credenciales, tokens, información de clientes, grabaciones ni datos reales sensibles.

---

## 11. KPIs configurables

La plataforma debe permitir que cada organización seleccione y defina sus KPIs.

Catálogo inicial:

- TAT.
- Tiempo de primera respuesta.
- Contactabilidad.
- Programación.
- Productividad.
- Cumplimiento de agenda/ruta.
- First-Time-Fix.
- Reingresos.
- Tiempo de diagnóstico.
- Efectividad del triage.
- SLA.
- Disponibilidad de inventario.
- Rotación.
- Lead time de abastecimiento.
- Facturación.
- Ticket promedio.
- Margen.
- Aprobación de cotizaciones.
- Razones de rechazo.
- Órdenes pendientes.
- CSAT.
- NPS.

---

## 12. Estado del producto

Estados oficiales:

- ✅ **Implementado / existente**.
- 🧪 **En pruebas / validación**.
- 🟡 **Diseñado / aprobado conceptualmente**.
- 🔴 **Pendiente**.

### Implementado o existente

- Base de la plataforma.
- Dashboard operativo.
- CRM/clientes.
- Agenda.
- Técnicos.
- Órdenes.
- Productos/inventario base.
- Conversaciones.
- Health monitor.
- Controles de agenda.
- Autenticación/base de seguridad.
- Supabase/PostgreSQL.
- Arquitectura de integración externa.
- Documentación técnica.

### En pruebas

- Inventario/catálogo de alto volumen.
- Datasets sintéticos de 1,000 y 5,000 SKU.
- Búsqueda, filtros, stock y escalabilidad.
- Pruebas de aceptación/carga.

### Diseñado / pendiente de completar

- Soporte multi-tenant formal.
- Motor de reglas/configuración por organización.
- Garantías/coberturas configurables.
- Triage formal e IA.
- Cotizaciones completas.
- Pagos/aprobaciones.
- Repuestos/logística completa.
- Portal técnico final.
- Evidencias/firma.
- NPS/CSAT.
- Fiscalidad configurable.
- Communications Gateway.
- Meta Cloud API.
- SIP/BYOC/carrier.
- WhatsApp Calling.
- KPIs configurables completos.
- Asignación inteligente futura.
- White-labeling futuro.

---

## 13. Modelo económico del producto

Toda implementación debe separar:

1. Desarrollo/configuración inicial.
2. Adaptaciones específicas del cliente.
3. Integraciones.
4. Infraestructura fija.
5. Consumo variable.
6. Soporte/mantenimiento.
7. Módulos opcionales.
8. Contingencia.
9. Margen comercial.

### Costos variables

- WhatsApp/Meta/BSP.
- Telefonía PSTN/SIP.
- WhatsApp Calling.
- Voz IA.
- LLM/IA.
- Transcripción.
- Grabaciones.
- Storage.
- Maps/geocoding/routes.
- Email/SMS.
- Hosting/DB overages.
- Logs/monitoring/backups.

### Escenarios de dimensionamiento

Se modelarán al menos 1,000, 5,000, 10,000 y 25,000 casos mensuales, con costo por caso, conversación, minuto, usuario, organización y OPEX mensual/anual.

El modelo económico debe permitir reutilizar el producto para nuevas organizaciones y separar claramente **costo del núcleo**, **costo de adaptación** y **costo operativo por cliente**.

---

## 14. Estrategia comercial y expansión

El proyecto debe poder evolucionar desde una implementación inicial hacia un producto comercializable.

Modelos futuros posibles:

- Implementación + mensualidad.
- SaaS por organización.
- SaaS por usuario.
- SaaS por volumen de órdenes/interacciones.
- Licenciamiento enterprise.
- White-label.
- Instalación privada/self-hosted.
- Servicios profesionales de integración.
- Soporte premium/SLA.

La primera implementación sirve para validar el producto, crear componentes reutilizables, identificar costos reales y construir una base que permita vender futuras implementaciones con menor costo marginal.

---

## 15. Roadmap general

### Fase 1 — Núcleo operativo

CRM, órdenes, agenda, técnicos, inventario base, conversaciones, autenticación, seguridad, dashboard y auditoría.

### Fase 2 — Automatización e integración

Reglas configurables, cotizaciones, garantías/coberturas, pagos, evidencias, Communications Gateway, WhatsApp, telefonía, integraciones empresariales, reportería avanzada.

### Fase 3 — Productización

Multi-tenancy formal, configuración por organización, onboarding, módulos activables, billing, white-label, administración multiempresa y plantillas sectoriales.

### Fase 4 — Inteligencia operacional

Asignación inteligente, optimización de rutas, predicción de demanda/repuestos, forecasting, analítica predictiva, IA avanzada y optimización automática de canales/costos.

---

## 16. Información pendiente de la primera implementación

Para cerrar costos y alcance contractual del caso Techcomm siguen pendientes, entre otros:

- Segundo documento funcional.
- Prioridades.
- Presupuesto disponible.
- Fecha objetivo.
- Aprobadores.
- Volúmenes de casos.
- Llamadas/minutos.
- WhatsApp/mensajes.
- Emails.
- Visitas.
- Evidencias.
- Usuarios/roles.
- Información técnica de Andreina.
- Sistema de facturación.
- Retención.
- SLA.
- Escalamiento humano.
- Requisitos regulatorios.
- Backup/DR.

Estos elementos pertenecen a la implementación inicial y no deben convertirse automáticamente en reglas globales del producto.

---

## 17. Documentación del repositorio

La carpeta `docs/` contiene documentación especializada, incluyendo:

- `BUDGET_MASTER_SCOPE.md`
- `ACCEPTANCE_TESTS_V1.md`
- `PERFORMANCE_LOAD_TESTING.md`
- `SELF_HOSTING.md`
- documentación de QA y UI

El README funciona como **mapa maestro del producto y del proyecto**.

---

## 18. Reglas de ingeniería del proyecto

- Diseñar primero capacidades reutilizables.
- Separar núcleo de configuración específica.
- No hardcodear reglas de clientes cuando puedan parametrizarse.
- No confundir prototipo con producción.
- No marcar diseñado como implementado.
- No inventar tarifas ni volúmenes.
- Revalidar costos de terceros antes de cotizar.
- Mantener proveedores desacoplados cuando sea razonable.
- Diseñar seguridad y trazabilidad desde el inicio.
- Preparar aislamiento multi-tenant antes de una segunda empresa productiva.
- Mapear toda funcionalidad a proceso, costo, riesgo y KPI.
- Incorporar nuevos clientes mediante configuración/adapters, no forks innecesarios del producto.

---

## 19. Repositorio y confidencialidad

El repositorio es actualmente público. No deben almacenarse secrets, tokens, credenciales, datos reales de clientes, grabaciones, documentos confidenciales ni información sensible de producción.

Antes de producción y especialmente antes de alojar múltiples organizaciones, debe revisarse la estrategia de visibilidad, acceso, secretos y segregación de ambientes.

---

## 20. Próximos pasos

1. Completar la estimación V1 de la primera implementación.
2. Comparar proveedores de comunicaciones y costos.
3. Calcular OPEX por volumen.
4. Estimar horas/valor por módulo.
5. Separar núcleo reutilizable vs personalización del cliente.
6. Recibir el segundo documento del socio.
7. Ejecutar delta de alcance.
8. Diseñar formalmente `organization_id` / multi-tenancy.
9. Crear estrategia de configuración por organización.
10. Preparar business case de la implementación inicial y roadmap de productización.

---

**Nombre actual del proyecto: Techcomm Operations.**  
**Dirección estratégica: plataforma operativa reutilizable, configurable y preparada para expansión a múltiples organizaciones.**

Este README es un documento vivo y debe actualizarse cuando cambien el alcance, arquitectura, modelo comercial, integraciones o estrategia de productización.