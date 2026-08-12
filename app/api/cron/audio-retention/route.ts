import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// INDOTEL's Resolución 091-2020 gives customers 3 months to file a formal
// complaint. We keep recordings for 4 months (120 days) — the extra month is
// a safety margin so a complaint filed right at the deadline still has the
// audio available while it's being processed, not deleted the same day.
const RETENTION_DAYS = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: expired, error } = await admin
    .from("call_events")
    .select("id, audio_storage_path")
    .not("audio_storage_path", "is", null)
    .lt("audio_captured_at", cutoff)
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!expired || expired.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

  let deleted = 0;
  for (const row of expired) {
    if (!row.audio_storage_path) continue;
    const { error: removeError } = await admin.storage.from("call-recordings").remove([row.audio_storage_path]);
    if (!removeError) {
      await admin.from("call_events").update({ audio_storage_path: null, audio_captured_at: null }).eq("id", row.id);
      deleted += 1;
    }
  }

  return NextResponse.json({ ok: true, deleted, retention_days: RETENTION_DAYS });
}
