import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

export async function requireOrgRole(allowedRoles: readonly string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = getSupabaseAdmin();
  const { data: membership, error } = await admin
    .from("organization_memberships")
    .select("role,status")
    .eq("user_id", user.id)
    .eq("organization_id", DEFAULT_ORG_ID)
    .maybeSingle();

  if (error || !membership || membership.status !== "active" || !allowedRoles.includes(membership.role)) {
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, user, membership, organizationId: DEFAULT_ORG_ID };
}
