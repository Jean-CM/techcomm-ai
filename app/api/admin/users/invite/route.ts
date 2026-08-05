import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";
const ALLOWED_ROLES = ["owner", "admin", "manager", "analyst", "agent", "viewer"];

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(request: Request) {
  // 1. Confirm the caller is logged in and is an owner/admin of the org.
  const supabase = await createClient().catch(() => null);
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: membership } = await admin
    .from("organization_memberships")
    .select("role,status")
    .eq("user_id", user.id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (!membership || membership.status !== "active" || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Solo un owner o admin puede crear usuarios." }, { status: 403 });
  }

  // 2. Validate input.
  const body = (await request.json().catch(() => ({}))) as { email?: string; role?: string; full_name?: string };
  const email = body.email?.trim().toLowerCase();
  const role = body.role;
  if (!email || !role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: "email y role válidos son requeridos" }, { status: 400 });
  }

  // 3. Create the auth user with a temporary password (no email service configured yet,
  // so we return the password here for the admin to share manually).
  const tempPassword = generateTempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: body.full_name ? { full_name: body.full_name } : undefined
  });

  if (createError || !created.user) {
    return NextResponse.json({ ok: false, error: createError?.message ?? "No se pudo crear el usuario" }, { status: 500 });
  }

  // 4. Attach them to the organization with the requested role.
  const { error: membershipError } = await admin.from("organization_memberships").insert({
    organization_id: DEFAULT_ORG_ID,
    user_id: created.user.id,
    role,
    status: "active"
  });

  if (membershipError) {
    return NextResponse.json({ ok: false, error: membershipError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    user: { id: created.user.id, email },
    temp_password: tempPassword,
    note: "Comparte esta contraseña temporal de forma segura. El usuario debe cambiarla al entrar."
  });
}
