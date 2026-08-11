# Techcomm Operations v1.0 — Matriz de aceptación

Estado: **BORRADOR DE CERTIFICACIÓN**  
Última revisión: 2026-08-10  

> Esta matriz se usa para cerrar v1.0. Las reglas comerciales que dependan de documentación oficial de la empresa se marcarán como **POLÍTICA PENDIENTE** hasta recibir y validar esa documentación.

## Regla oficial de horario para pruebas

- Lunes a viernes: 8:00 a. m. – 6:00 p. m.
- Sábado: 9:00 a. m. – 1:00 p. m.
- Domingo: cerrado.
- Zona horaria: America/Santo_Domingo.

## Criterio de salida

Techcomm Operations v1.0 solo se marca **APROBADO** cuando todos los casos críticos estén PASS y no exista ningún defecto crítico abierto.

| # | Área | Caso de prueba | Resultado esperado | Estado |
|---|---|---|---|---|
| 01 | Acceso | Abrir /crm sin sesión | Redirige a login | PENDING |
| 02 | Acceso | Consumir /api/crm/overview sin sesión | 401 Unauthorized | PENDING |
| 03 | Acceso | Usuario técnico intenta entrar al CRM | Se redirige al portal técnico | PENDING |
| 04 | Acceso | Recuperación de contraseña | Correo y cambio de contraseña funcionan | PENDING |
| 05 | Acceso | Usuario inactivo 5 minutos | Sesión cerrada automáticamente | PENDING |
| 06 | Horario | Lunes 8:00 a. m. | Cita permitida | PENDING |
| 07 | Horario | Viernes 5:30 p. m. | Cita permitida | PENDING |
| 08 | Horario | Viernes 6:30 p. m. | Cita rechazada por IA/herramienta | PENDING |
| 09 | Horario | Sábado 9:00 a. m. | Cita permitida | PENDING |
| 10 | Horario | Sábado 12:00 p. m. | Cita permitida | PENDING |
| 11 | Horario | Sábado 2:00 p. m. | Cita rechazada | PENDING |
| 12 | Horario | Domingo cualquier hora | Cita rechazada; informa cerrado | PENDING |
| 13 | Avería | Cliente reporta falla sin nombre | IA solicita nombre real | PENDING |
| 14 | Avería | Teléfono dominicano inválido | No crea orden y pide teléfono válido | PENDING |
| 15 | Avería | Cliente no acepta visita RD$500 | No crea orden | PENDING |
| 16 | Avería | Cliente acepta RD$500 pero no confirma datos | Lee resumen y espera confirmación | PENDING |
| 17 | Avería | Cliente confirma todos los datos | Crea cliente/cita/orden una sola vez | PENDING |
| 18 | Avería | Intento de duplicar misma cita/orden | No crea duplicado | PENDING |
| 19 | Avería | Solicitud comercial entra por herramienta de reparación | Se deriva al flujo comercial | PENDING |
| 20 | Agenda | Reprogramación válida Lun–Vie | Guarda nueva fecha | PENDING |
| 21 | Agenda | Reprogramación válida sábado | Guarda nueva fecha | PENDING |
| 22 | Agenda | Reprogramación domingo vía IA | Rechazada | PENDING |
| 23 | Agenda | Reprogramación manual fuera de horario | Guarda con advertencia y auditoría | PENDING |
| 24 | Agenda | Técnico con cita solapada | Advierte conflicto de agenda | PENDING |
| 25 | Agenda | Cita sin técnico | Se identifica como pendiente de asignación | PENDING |
| 26 | Orden | Número de orden | Usa formato secuencial OT-00001... | PENDING |
| 27 | Orden | Asignar técnico desde CRM | Orden y cita quedan vinculadas al técnico | PENDING |
| 28 | Orden | Cambiar estado de orden | Estado se actualiza y queda auditado | PENDING |
| 29 | Técnico | Técnico inicia sesión | Solo ve su operación asignada | PENDING |
| 30 | Técnico | Técnico marca Salí / Llegué / Terminé | Tiempos y estado se actualizan correctamente | PENDING |
| 31 | Técnico | Técnico agrega pieza/producto usado | Inventario/orden reflejan el registro | PENDING |
| 32 | Técnico | Compra adicional durante visita | Genera cotización sin alterar reparación original | PENDING |
| 33 | Inventario | Producto sin stock disponible | Venta/cotización bloqueada o advertida | PENDING |
| 34 | Inventario | reserved_stock > stock | Sistema detecta inconsistencia | PENDING |
| 35 | Comercial | Cotización normal | Calcula total correctamente | PENDING |
| 36 | Comercial | Instalación de equipo grande | POLÍTICA PENDIENTE DE DOCUMENTO EMPRESA | POLICY |
| 37 | Comercial | Envío de artículo pequeño | POLÍTICA PENDIENTE DE DOCUMENTO EMPRESA | POLICY |
| 38 | Comercial | Descuento mayor al autorizado | Solicita aprobación | PENDING |
| 39 | Conversaciones | Abrir CRM inicial | No descarga transcripciones completas | PENDING |
| 40 | Conversaciones | Lista de conversaciones | Muestra WhatsApp y llamadas con resumen, cliente y fecha | PENDING |
| 41 | Conversaciones | Abrir conversación específica | Descarga mensajes solo bajo demanda | PENDING |
| 42 | Conversaciones | Perfil operativo abre conversación | No recibe URL de audio | PENDING |
| 43 | Auditoría | Super Admin/Admin abre auditoría | Acceso permitido | PENDING |
| 44 | Auditoría | Usuario no Admin abre auditoría | 403 o redirección | PENDING |
| 45 | Auditoría | Buscar llamada por fecha/teléfono/cliente | Devuelve resumen, duración, resultado y orden relacionada | PENDING |
| 46 | Auditoría | Pulsar Escuchar | Genera URL firmada temporal y reproduce audio | PENDING |
| 47 | Seguridad | Webhook ElevenLabs con firma inválida | Rechazado | PENDING |
| 48 | Seguridad | API protegida sin secreto/sesión | Rechazada | PENDING |
| 49 | Homelab | Levantar imagen Docker y /api/health | 200 OK | PENDING |
| 50 | Recuperación | Reiniciar/recrear contenedor desde repo + secretos | Servicio vuelve operativo sin pérdida de datos | PENDING |

## Pendiente para afinar con documentación oficial

Cuando llegue la documentación de la empresa se debe validar y congelar, como mínimo:

- tarifas y condiciones comerciales;
- garantías;
- política de instalación y transporte;
- devoluciones/reembolsos;
- horarios especiales o feriados;
- niveles de autorización de descuentos;
- conservación de grabaciones y datos;
- reglas de escalamiento a personal humano;
- textos legales/regulatorios aplicables.

## Evidencia de certificación

Cada caso debe guardar al menos una de estas evidencias: captura, respuesta HTTP, registro de auditoría, fila creada/actualizada en Supabase o log de prueba. No se deben usar datos reales sensibles cuando un dato de prueba sea suficiente.
