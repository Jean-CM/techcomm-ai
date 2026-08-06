import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";
const ALLOWED_ROLES = ["owner", "admin", "manager", "analyst", "agent", "viewer"];
const ALLOWED_STATUSES = ["active", "suspended", "invited"];

async function requireOwnerOrAdmin() {
  const supabase = await createClient().catch(() => null);
  if (!supabase) return { error: NextResponse.json({ ok: false, error: "Supabase no configurado" }, { status: 500 }) };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };

  const admin = getSupabaseAdmin();
  const { data: membership } = await admin
    .from("organization_memberships")
    .select("role,status")
    .eq("user_id", user.id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (!membership || membership.status !== "active" || !["owner", "admin"].includes(membership.role)) {
    return { error: NextResponse.json({ ok: false, error: "Solo un owner o admin puede administrar usuarios." }, { status: 403 }) };
  }
  return { user, admin };
}

export async function PATCH(request: Request) {
  const auth = await requireOwnerOrAdmin();
  if (auth.error) return auth.error;
  const { admin, user } = auth;

  const body = (await request.json().catch(() => ({}))) as { user_id?: string; role?: string; status?: string };
  if (!body.user_id) return NextResponse.json({ ok: false, error: "user_id es requerido" }, { status: 400 });
  if (body.role && !ALLOWED_ROLES.includes(body.role)) return NextResponse.json({ ok: false, error: "role inválido" }, { status: 400 });
  if (body.status && !ALLOWED_STATUSES.includes(body.status)) return NextResponse.json({ ok: false, error: "status inválido" }, { status: 400 });

  if (body.user_id === user!.id && body.role && body.role !== "owner") {
    // Prevent an owner from locking themselves out by accident.
    const { count } = await admin!.from("organization_memberships").select("*", { count: "exact", head: true }).eq("organization_id", DEFAULT_ORG_ID).eq("role", "owner").eq("status", "active");
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ ok: false, error: "No puedes quitarte el rol de owner si eres el único owner activo." }, { status: 400 });
    }
  }

  const updates: Record<string, string> = {};
  if (body.role) updates.role = body.role;
  if (body.status) updates.status = body.status;

  const { error } = await admin!
    .from("organization_memberships")
    .update(updates)
    .eq("user_id", body.user_id)
    .eq("organization_id", DEFAULT_ORG_ID);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireOwnerOrAdmin();
  if (auth.error) return auth.error;
  const { admin, user } = auth;

  const body = (await request.json().catch(() => ({}))) as { user_id?: string };
  if (!body.user_id) return NextResponse.json({ ok: false, error: "user_id es requerido" }, { status: 400 });
  if (body.user_id === user!.id) return NextResponse.json({ ok: false, error: "No puedes eliminar tu propio acceso." }, { status: 400 });

  // Revoke access (remove the membership) without deleting the underlying
  // auth account — the email may belong to a real person used elsewhere.
  const { error } = await admin!
    .from("organization_memberships")
    .delete()
    .eq("user_id", body.user_id)
    .eq("organization_id", DEFAULT_ORG_ID);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
