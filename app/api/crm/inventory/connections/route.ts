import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";
const MANAGER_ROLES = new Set(["owner", "admin", "manager"]);
const SOURCE_TYPES = new Set(["sql_server", "postgresql", "mysql", "oracle", "api", "sftp", "sharepoint", "onedrive", "excel_csv", "other"]);
const CONNECTION_MODES = new Set(["push_agent", "api_pull", "file_drop", "manual_upload", "private_network"]);
const FORBIDDEN_CONFIG_KEYS = /(password|secret|token|private[_-]?key|api[_-]?key|connection[_-]?string|credential)/i;

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
    .map(([key, item]) => [key.slice(0, 80), typeof item === "string" ? item.slice(0, 500) : item]);
  return Object.fromEntries(entries);
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
  return NextResponse.json({ ok: true, sources: data ?? [] });
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
  };

  const name = String(body.name ?? "").trim().slice(0, 120);
  const sourceType = String(body.source_type ?? "");
  const connectionMode = String(body.connection_mode ?? "");
  if (!name) return NextResponse.json({ ok: false, error: "El nombre de la fuente es requerido." }, { status: 400 });
  if (!SOURCE_TYPES.has(sourceType)) return NextResponse.json({ ok: false, error: "Tipo de fuente no permitido." }, { status: 400 });
  if (!CONNECTION_MODES.has(connectionMode)) return NextResponse.json({ ok: false, error: "Modo de conexión no permitido." }, { status: 400 });

  const record = {
    organization_id: DEFAULT_ORG_ID,
    name,
    source_type: sourceType,
    connection_mode: connectionMode,
    status: "draft",
    description: String(body.description ?? "").trim().slice(0, 500) || null,
    config: safeConfig(body.config),
    secret_ref: String(body.secret_ref ?? "").trim().slice(0, 200) || null,
    created_by: auth.user!.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.admin!.from("data_sources").insert(record).select("id,name,source_type,connection_mode,status,description,config,secret_ref,last_sync_at,created_at,updated_at").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    source: data,
    next_step: connectionMode === "push_agent"
      ? "Instala un agente/servicio dentro de la red privada que lea la base de datos y envíe lotes al endpoint de sincronización."
      : "Configura la credencial fuera de data_sources y guarda solo su referencia en secret_ref.",
  });
}
