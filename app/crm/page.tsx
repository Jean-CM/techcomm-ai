import OperationsClient from "./operations-client";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";

export default async function CrmPage() {
  let canOpenAudit = false;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const admin = getSupabaseAdmin();
      const { data: membership } = await admin
        .from("organization_memberships")
        .select("role,status")
        .eq("user_id", user.id)
        .eq("organization_id", DEFAULT_ORG_ID)
        .maybeSingle();

      canOpenAudit = Boolean(
        membership && membership.status === "active" && ["owner", "admin"].includes(membership.role),
      );
    }
  } catch {
    canOpenAudit = false;
  }

  return <OperationsClient canOpenAudit={canOpenAudit} />;
}
