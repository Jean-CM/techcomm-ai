import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";
const ALLOWED_ROLES = ["owner", "admin", "manager", "analyst", "agent", "viewer", "technician"];

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 7; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function findAuthUserByEmail(admin: ReturnType<typeof getSupabaseAdmin>, email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 100) break;
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient().catch(() => null);
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: membership } = await admin.from("organization_memberships").select("role,status").eq("user_id", user.id).eq("organization_id", DEFAULT_ORG_ID).maybeSingle();
  if (!membership || membership.status !== "active" || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ ok: false, error: "Solo un owner o admin puede crear usuarios." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string; role?: string; full_name?: string; phone?: string };
  const email = body.email?.trim().toLowerCase();
  const role = body.role;
  if (!email || !role || !ALLOWED_ROLES.includes(role)) return NextResponse.json({ ok: false, error: "email y role válidos son requeridos" }, { status: 400 });
  if (role === "technician" && !body.phone?.trim()) return NextResponse.json({ ok: false, error: "El teléfono es requerido para crear un perfil de técnico." }, { status: 400 });

  // Recover safely from orphan Auth users: an account may remain in auth.users even
  // after its organization membership was removed by older versions of the admin UI.
  const existingAuthUser = await findAuthUserByEmail(admin, email).catch(() => null);
  if (existingAuthUser) {
    const [{ count: membershipCount }, { count: technicianCount }] = await Promise.all([
      admin.from("organization_memberships").select("*", { count: "exact", head: true }).eq("user_id", existingAuthUser.id),
      admin.from("technicians").select("*", { count: "exact", head: true }).eq("user_id", existingAuthUser.id),
    ]);

    if ((membershipCount ?? 0) > 0 || (technicianCount ?? 0) > 0) {
      return NextResponse.json({ ok: false, error: "Este correo ya pertenece a un usuario activo o vinculado. Elimínalo desde Administración antes de volver a crearlo." }, { status: 409 });
    }

    const { error: orphanDeleteError } = await admin.auth.admin.deleteUser(existingAuthUser.id);
    if (orphanDeleteError) {
      return NextResponse.json({ ok: false, error: `El correo quedó huérfano en autenticación y no pudo limpiarse automáticamente: ${orphanDeleteError.message}` }, { status: 500 });
    }
  }

  const tempPassword = generateTempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      ...(body.full_name ? { full_name: body.full_name } : {}),
      ...(body.phone ? { phone: body.phone.trim() } : {}),
      must_change_password: true,
      ...(role === "technician" ? { app_role: "technician" } : {}),
    }
  });
  if (createError || !created.user) return NextResponse.json({ ok: false, error: createError?.message ?? "No se pudo crear el usuario" }, { status: 500 });

  if (role === "technician") {
    const { error: technicianError } = await admin.from("technicians").insert({ organization_id: DEFAULT_ORG_ID, user_id: created.user.id, full_name: body.full_name?.trim() || email, phone: body.phone!.trim(), active: true, status: "available" });
    if (technicianError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ ok: false, error: `No se pudo vincular el perfil de técnico: ${technicianError.message}` }, { status: 500 });
    }
  }

  const { error: membershipError } = await admin.from("organization_memberships").insert({ organization_id: DEFAULT_ORG_ID, user_id: created.user.id, role, status: "active" });
  if (membershipError) {
    await admin.from("technicians").delete().eq("user_id", created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ ok: false, error: membershipError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user: { id: created.user.id, email }, temp_password: tempPassword, note: "Contraseña temporal de 7 caracteres. Debe cambiarse al primer ingreso." });
}
