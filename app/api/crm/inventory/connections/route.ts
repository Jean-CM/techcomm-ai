import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";
const MANAGER_ROLES = new Set(["owner", "admin", "manager"]);
const SOURCE_TYPES = new Set(["sql_server", "postgresql", "mysql", "oracle", "api", "sftp", "sharepoint", "onedrive", "excel_csv", "power_bi", "other"]);
const CONNECTION_MODES = new Set(["push_agent", "api_pull", "file_drop", "manual_upload", "private_network"]);
const FORBIDDEN_CONFIG_KEYS = /(password|secret|token|private[_-]?key|api[_-]?key|connection[_-]?string|credential)/i;
const SECRET_REF_PATTERN = /^[A-Z][A-Z0-9_]{2,79}$/;
const SCHEDULES: Record<string, string | null> = {
  manual: null,
  every_5_minutes: "*/5 * * * *",
  every_15_minutes: "*/15 * * * *",
  hourly: "0 * * * *",
  daily: "0 2 * * *",
};

async function requireManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const { data: membership } = await admin
    .from("organization_memberships")
    .select("role,status")
    .eq("user_id", user.id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (!membership || membership.status !== "active" || !MANAGER_ROLES.has(membership.role)) {
    return { error: NextResponse.json({ ok: false, error: "Solo owner/admin/manager pueden configurar fuentes de inventario." }, { status: 403 }) };
  }

  return { admin, user };
}

function safeConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !FORBIDDEN_CONFIG_KEYS.test(key))
    .slice(0, 30)
    .map(([key, item]) => [key.slice(0, 80), typeof item === "string" ? item.trim().slice(0, 500) : item]);
  return Object.fromEntries(entries);
}

function readiness(source: { connection_mode: string; secret_ref?: string | null; config?: Record<string, unknown> | null }) {
  const config = source.config ?? {};
  const credentialReferenceSet = Boolean(source.secret_ref);
  const secretConfigured = Boolean(source.secret_ref && process.env[source.secret_ref]);
  const locationConfigured = Boolean(String(config.table_or_view ?? config.endpoint ?? "").trim());
  const needsSecret = ["push_agent", "api_pull", "private_network"].includes(source.connection_mode);
  return {
    credential_reference_set: credentialReferenceSet,
    secret_configured: secretConfigured,
    location_configured: locationConfigured,
    configuration_ready: locationConfigured && (!needsSecret || secretConfigured),
  };
}

function publicSource(source: Record<string, unknown>) {
  return {
    id: source.id,
    name: source.name,
    source_type: source.source_type,
    connection_mode: source.connection_mode,
    status: source.status,
    description: source.description,
    config: source.config ?? {},
    last_sync_at: source.last_sync_at,
    created_at: source.created_at,
    updated_at: source.updated_at,
    ...readiness(source as { connection_mode: string; secret_ref?: string | null; config?: Record<string, unknown> | null }),
  };
}

export async function GET() {
  const auth = await requireManager();
  if (auth.error) return auth.error;

  const { data, error } = await auth.admin!
    .from("data_sources")
    .select("id,name,source_type,connection_mode,status,description,config,secret_ref,last_sync_at,created_at,updated_at")
    .eq("organization_id", DEFAULT_ORG_ID)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sources: (data ?? []).map((source) => publicSource(source as Record<string, unknown>)) });
}

export async function POST(request: NextRequest) {
  const auth = await requireManager();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    source_type?: string;
    connection_mode?: string;
    description?: string;
    config?: Record<string, unknown>;
    secret_ref?: string;
    schedule?: string;
  };

  const name = String(body.name ?? "").trim().slice(0, 120);
  const sourceType = String(body.source_type ?? "");
  const connectionMode = String(body.connection_mode ?? "");
  const secretRef = String(body.secret_ref ?? "").trim();
  const schedule = String(body.schedule ?? "manual");
  if (!name) return NextResponse.json({ ok: false, error: "El nombre de la fuente es requerido." }, { status: 400 });
  if (!SOURCE_TYPES.has(sourceType)) return NextResponse.json({ ok: false, error: "Tipo de fuente no permitido." }, { status: 400 });
  if (!CONNECTION_MODES.has(connectionMode)) return NextResponse.json({ ok: false, error: "Modo de conexión no permitido." }, { status: 400 });
  if (secretRef && !SECRET_REF_PATTERN.test(secretRef)) {
    return NextResponse.json({ ok: false, error: "Usa una referencia segura en MAYÚSCULAS, por ejemplo TECHCOMM_INV_ERP_PROD_SECRET. Nunca pegues la contraseña aquí." }, { status: 400 });
  }
  if (!(schedule in SCHEDULES)) return NextResponse.json({ ok: false, error: "Frecuencia de sincronización no permitida." }, { status: 400 });

  const record = {
    organization_id: DEFAULT_ORG_ID,
    name,
    source_type: sourceType,
    connection_mode: connectionMode,
    status: "draft",
    description: String(body.description ?? "").trim().slice(0, 500) || null,
    config: safeConfig(body.config),
    secret_ref: secretRef || null,
    created_by: auth.user!.id,
    updated_at: new Date().toISOString(),
  };

  const { data: source, error } = await auth.admin!
    .from("data_sources")
    .insert(record)
    .select("id,name,source_type,connection_mode,status,description,config,secret_ref,last_sync_at,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: dataset, error: datasetError } = await auth.admin!
    .from("datasets")
    .insert({
      organization_id: DEFAULT_ORG_ID,
      data_source_id: source.id,
      name: "inventory_products",
      destination_schema: "public",
      destination_table: "products",
      description: `Inventario maestro alimentado por ${name}.`,
      is_enabled: true,
      created_by: auth.user!.id,
    })
    .select("id")
    .single();
  if (datasetError || !dataset) {
    await auth.admin!.from("data_sources").delete().eq("id", source.id).eq("organization_id", DEFAULT_ORG_ID);
    return NextResponse.json({ ok: false, error: datasetError?.message || "No fue posible preparar el dataset de inventario." }, { status: 500 });
  }

  const { error: jobError } = await auth.admin!
    .from("sync_jobs")
    .insert({
      organization_id: DEFAULT_ORG_ID,
      dataset_id: dataset.id,
      name: "inventory_sync",
      schedule_cron: SCHEDULES[schedule],
      is_enabled: false,
      timeout_seconds: 900,
      created_by: auth.user!.id,
    });
  if (jobError) {
    await auth.admin!.from("data_sources").delete().eq("id", source.id).eq("organization_id", DEFAULT_ORG_ID);
    return NextResponse.json({ ok: false, error: jobError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    source: publicSource(source as Record<string, unknown>),
    next_step: connectionMode === "push_agent"
      ? "Configura el secreto en el entorno del servidor, valida la fuente y luego actívala. El agente usará firma HMAC SHA-256 con ventana de 5 minutos."
      : "Configura la credencial fuera de data_sources, valida la fuente y actívala cuando esté lista.",
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireManager();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { id?: string; action?: string };
  const id = String(body.id ?? "").trim();
  const action = String(body.action ?? "validate");
  if (!id) return NextResponse.json({ ok: false, error: "La fuente es requerida." }, { status: 400 });
  if (!new Set(["validate", "activate", "pause", "disable"]).has(action)) {
    return NextResponse.json({ ok: false, error: "Acción no permitida." }, { status: 400 });
  }

  const { data: source, error } = await auth.admin!
    .from("data_sources")
    .select("id,name,source_type,connection_mode,status,description,config,secret_ref,last_sync_at,created_at,updated_at")
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("id", id)
    .maybeSingle();
  if (error || !source) return NextResponse.json({ ok: false, error: "Fuente no encontrada." }, { status: 404 });

  const sourceReadiness = readiness(source);
  if (action === "validate") {
    return NextResponse.json({
      ok: true,
      readiness: sourceReadiness,
      message: sourceReadiness.configuration_ready
        ? "Configuración lista para activarse."
        : "Falta configurar la tabla/vista o endpoint, o registrar el secreto en el entorno del servidor.",
    });
  }
  if (action === "activate" && !sourceReadiness.configuration_ready) {
    return NextResponse.json({ ok: false, error: "La fuente no puede activarse hasta completar ubicación de datos y credencial externa." }, { status: 409 });
  }

  const nextStatus = action === "activate" ? "active" : action === "pause" ? "paused" : "disabled";
  const now = new Date().toISOString();
  const { error: updateError } = await auth.admin!
    .from("data_sources")
    .update({ status: nextStatus, updated_at: now })
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("id", id);
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  const { data: dataset } = await auth.admin!
    .from("datasets")
    .select("id")
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("data_source_id", id)
    .maybeSingle();
  if (dataset) {
    await auth.admin!
      .from("sync_jobs")
      .update({ is_enabled: action === "activate", updated_at: now })
      .eq("organization_id", DEFAULT_ORG_ID)
      .eq("dataset_id", dataset.id);
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
