import Link from "next/link";
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

  return (
    <>
      <OperationsClient />
      {canOpenAudit && (
        <Link
          href="/admin/auditoria"
          style={{
            position: "fixed",
            right: 22,
            bottom: 22,
            zIndex: 120,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            padding: "12px 18px",
            background: "#FF6A39",
            color: "#181109",
            fontWeight: 800,
            textDecoration: "none",
            boxShadow: "0 12px 34px rgba(0,0,0,.34)",
          }}
        >
          ◉ Auditoría de llamadas
        </Link>
      )}
    </>
  );
}
