# Techcomm Operations — Performance & Artillery Runbook

## Objetivo
Validar que el CRM mantenga tiempos estables con un perfil equivalente a 100+ usuarios concurrentes sin crear datos ni disparar WhatsApp/telefonía durante la prueba de lectura.

## Regla de seguridad
- `crm-smoke.yml` puede usarse contra producción con carga mínima.
- `crm-read.yml` debe ejecutarse preferiblemente contra staging/preproducción. No correr la fase completa de 100–150 VUs contra producción sin ventana aprobada.
- Nunca guardar cookies, contraseñas, tokens o claves en Git.
- Las variables `.env.*` ya están excluidas por `.gitignore`.
- La prueba de escritura de cotizaciones/inventario se hará únicamente en staging con datos sintéticos.

## Requisitos
Node.js 22 y Artillery actual.

Instalación local opcional:

```bash
npm install -g artillery
artillery --version
```

También puede ejecutarse con `npx artillery` sin agregar Artillery al bundle de producción.

## Sesión de prueba
Usar una cuenta exclusiva de pruebas con el rol mínimo necesario. Iniciar sesión normalmente en Techcomm Operations y copiar el encabezado `Cookie` de una petición autenticada desde DevTools > Network. No compartir esa cookie ni guardarla en el repositorio.

Crear localmente un archivo `.env.artillery`:

```text
TC_TARGET=https://<staging-techcomm>
TC_SESSION_COOKIE=<cookie completa de la cuenta de prueba>
ARTILLERY_DISABLE_TELEMETRY=true
```

## Smoke seguro

```bash
npx artillery run --env-file .env.artillery tests/performance/crm-smoke.yml
```

Valida `/api/crm/overview`, primera página de Inventario y Centro de Cotizaciones con una carga mínima.

## Perfil 100+ usuarios

```bash
npx artillery run --env-file .env.artillery \
  --output artillery-report.json \
  tests/performance/crm-read.yml
```

El perfil hace warm-up, rampa, carga sostenida y spike corto. `maxVusers` limita la concurrencia de cada fase; Artillery usa un modelo de llegadas, por lo que 100 usuarios humanos no significa 100 requests por segundo.

## SLO inicial propuesto para preproducción
- `http.response_time.p95 < 1200 ms`
- `http.response_time.p99 < 2500 ms`
- `vusers.failed = 0`
- cero HTTP 5xx

Estos umbrales son de certificación inicial y deben endurecerse cuando tengamos una línea base estable.

## Qué monitorear mientras corre
1. Vercel runtime errors y 5xx.
2. Supabase CPU, conexiones, I/O y consultas lentas.
3. Latencia por endpoint: overview, inventario, cotizaciones.
4. Deep pagination de inventario.
5. Saturación de Auth/RLS/membership lookups.
6. Tamaño de payload y número de consultas por apertura del CRM.

## Interpretación
- p95 alto solo en páginas profundas de Inventario: migrar esa navegación a cursor/keyset pagination.
- p95 alto en `/api/crm/overview`: dividir el overview monolítico y cargar módulos bajo demanda.
- p95 alto en Cotizaciones: mantener resúmenes agregados en SQL/RPC y paginar historial.
- 429: revisar límites/rate limiting y diferenciar protección de tráfico legítimo.
- 5xx: detener la prueba y revisar runtime logs antes de aumentar carga.

## Siguiente etapa
Crear entorno staging con datos sintéticos y un script de escritura separado para probar de forma atómica:
- crear cotización;
- aprobación interna;
- reserva de inventario;
- cancelación/liberación;
- aceptación de cliente simulada;
- venta/OT;
- Kardex.

No ejecutar ese escenario de escritura sobre producción.
