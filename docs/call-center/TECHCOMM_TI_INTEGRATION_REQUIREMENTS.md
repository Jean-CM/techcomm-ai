# Techcomm AI · Línea Blanca — Requerimientos de Integración TI

## Propósito
Migrar el piloto desde `SandboxAdapter` hacia los sistemas reales de Techcomm sin cambiar los contratos de los agentes.

## Accesos a definir con TI

### 1. Infraestructura
- Hosting objetivo: Techcomm, nube aprobada o híbrido.
- Dominio/subdominio oficial para Call Center AI.
- DNS, certificados TLS/SSL y responsable de cambios.
- Conectividad: Internet público controlado, VPN, private link o red interna.
- Allowlist de IPs y puertos.
- Ambientes separados: DEV / UAT / PROD.

### 2. Fuente de compras de Línea Blanca
TI debe identificar la fuente oficial y confiable de una nueva compra/orden que potencialmente requiera instalación.

Datos mínimos requeridos:
- ID único de compra/orden.
- factura/orden de compra.
- fecha/hora.
- distribuidor y punto de venta.
- nombre y teléfono del cliente.
- producto, marca, modelo y serial cuando exista.
- indicador de instalación incluida/gratuita cuando exista.

Mecanismo preferido, en orden:
1. webhook/evento en tiempo real;
2. API incremental;
3. vista/consulta autorizada de BD;
4. archivo/cola como contingencia.

### 3. Agenda e instalaciones
Definir sistema fuente para:
- zonas de servicio;
- técnicos disponibles;
- disponibilidad horaria;
- creación de cita;
- reprogramación/cancelación;
- asignación de técnico;
- estados de ejecución y cierre.

### 4. Clientes
Operaciones solicitadas:
- buscar cliente por teléfono/ID;
- leer datos de contacto;
- actualizar dirección de servicio;
- provincia, municipio, sector;
- referencia 1 obligatoria para el piloto;
- referencia 2 opcional;
- coordenadas cuando estén disponibles.

### 5. Canales
- Número(s) de voz que usará el piloto/producción.
- SIP/PBX/carrier actual y método autorizado de integración.
- Caller ID saliente.
- Transferencia a humanos/colas.
- WhatsApp Business oficial y responsable del WABA.
- Políticas de grabación y retención.

### 6. Seguridad y autenticación
TI debe escoger el mecanismo autorizado por sistema:
- OAuth2;
- service account;
- JWT;
- API key;
- mTLS/certificado;
- credencial de BD restringida cuando no exista API.

Principios obligatorios:
- mínimo privilegio;
- secretos fuera del código y prompts;
- credenciales diferentes por ambiente;
- rotación de secretos;
- logs de accesos y escrituras;
- posibilidad de revocar el acceso sin redeploy del agente.

### 7. Matriz lectura/escritura propuesta
| Operación | Lectura | Escritura |
|---|---:|---:|
| Detectar compra | ✓ | |
| Consultar cliente | ✓ | |
| Actualizar dirección/referencias | | ✓ |
| Consultar disponibilidad | ✓ | |
| Crear cita | | ✓ |
| Reprogramar/cancelar cita | | ✓ |
| Consultar estado de instalación | ✓ | |
| Registrar interacción Call Center | | ✓ |
| Registrar seguimiento/escalación | | ✓ |

## Contratos estables que Techcomm AI expondrá
- `ingest_purchase`
- `get_purchase`
- `create_installation_request`
- `update_customer_location`
- `get_available_slots`
- `schedule_installation`
- `register_interaction`

TI puede implementar cada operación mediante API, BD, middleware o ERP existente. El agente no tendrá acceso directo a credenciales ni a tablas internas.

## Eventos requeridos/deseables del socio
- `purchase.created`
- `purchase.updated`
- `appointment.updated`
- `technician.assigned`
- `installation.started`
- `installation.completed`
- `installation.cancelled`

Si no existen webhooks, se acordará polling incremental con cursor/fecha de actualización.

## Pruebas antes de PROD
1. Credenciales de UAT.
2. Datos ficticios o anonimizados.
3. Lecturas verificadas contra fuente oficial.
4. Escrituras de cita reversibles.
5. Idempotencia.
6. Prueba de desconexión/timeouts.
7. Auditoría completa.
8. Prueba de transferencia humana.
9. Aprobación de Seguridad/TI.
10. Plan de rollback y revocación de accesos.

## Preguntas bloqueantes para la reunión
1. ¿Cuál es la fuente oficial que indica que una compra de Línea Blanca ya puede ser gestionada por Techcomm?
2. ¿Existe un webhook/API o solo acceso de BD/correo/archivo?
3. ¿Cuál sistema es dueño de las citas y técnicos?
4. ¿Qué IDs enlazan compra, cliente, cita y servicio?
5. ¿Techcomm AI puede escribir citas directamente o debe usar middleware del socio?
6. ¿Qué dominios, VPN, allowlists y certificados exige TI?
7. ¿Qué datos pueden salir de su red y cuáles deben permanecer dentro?
8. ¿Cuál es la política de retención de audio, transcripción y PII?
9. ¿Qué ambiente UAT nos entregarán y cuándo?
10. ¿Quién será el responsable técnico para aprobar cambios y resolver bloqueos de integración?
