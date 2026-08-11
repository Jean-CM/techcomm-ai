import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";
const WRITE_ROLES = new Set(["owner", "admin", "manager"]);
const MOVEMENT_TYPES = new Set(["receipt", "issue", "reserve", "release", "return", "transfer_in", "transfer_out", "pending_add", "pending_receive", "pending_cancel"]);

async function requireWriter() {
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

  if (!membership || membership.status !== "active" || !WRITE_ROLES.has(membership.role)) {
    return { error: NextResponse.json({ ok: false, error: "No tienes permiso para mover inventario." }, { status: 403 }) };
  }
  return { admin, user };
}

export async function GET(request: NextRequest) {
  const auth = await requireWriter();
  if (auth.error) return auth.error;
  const productId = request.nextUrl.searchParams.get("product_id");
  if (!productId) return NextResponse.json({ ok: false, error: "product_id es requerido." }, { status: 400 });

  const { data, error } = await auth.admin!
    .from("inventory_movements")
    .select("id,movement_type,quantity,stock_before,stock_after,reserved_before,reserved_after,pending_before,pending_after,reference_type,reference_id,note,created_at")
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, movements: data ?? [] });
}

function movementError(message: string) {
  if (message.includes("PRODUCT_NOT_FOUND")) return [404, "Producto no encontrado."] as const;
  if (message.includes("INSUFFICIENT_AVAILABLE_STOCK")) return [409, "La salida supera el stock disponible no reservado."] as const;
  if (message.includes("INSUFFICIENT_STOCK_TO_RESERVE")) return [409, "La reserva supera el stock disponible."] as const;
  if (message.includes("INVALID_QUANTITY") || message.includes("INVALID_MOVEMENT_TYPE")) return [400, "Movimiento o cantidad inválida."] as const;
  return [500, "No fue posible registrar el movimiento de inventario."] as const;
}

export async function POST(request: NextRequest) {
  const auth = await requireWriter();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    product_id?: string;
    movement_type?: string;
    quantity?: number;
    reference_type?: string;
    reference_id?: string;
    note?: string;
  };

  const productId = String(body.product_id ?? "");
  const movementType = String(body.movement_type ?? "");
  const quantity = Math.floor(Number(body.quantity) || 0);
  if (!productId || !MOVEMENT_TYPES.has(movementType) || quantity <= 0) {
    return NextResponse.json({ ok: false, error: "Producto, tipo de movimiento y cantidad válida son requeridos." }, { status: 400 });
  }

  const { data, error } = await auth.admin!.rpc("apply_inventory_movement", {
    p_organization_id: DEFAULT_ORG_ID,
    p_product_id: productId,
    p_movement_type: movementType,
    p_quantity: quantity,
    p_reference_type: String(body.reference_type ?? "").slice(0, 80) || null,
    p_reference_id: String(body.reference_id ?? "").slice(0, 120) || null,
    p_note: String(body.note ?? "").slice(0, 500) || null,
    p_created_by: auth.user!.id,
  });

  if (error) {
    const [status, friendly] = movementError(error.message);
    return NextResponse.json({ ok: false, error: friendly }, { status });
  }

  const result = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    movement: result ? { id: result.movement_id, created_at: result.created_at } : null,
    product: result ? {
      id: result.product_id,
      stock: result.stock,
      reserved_stock: result.reserved_stock,
      pending_stock: result.pending_stock,
      available_stock: result.available_stock,
    } : null,
  });
}
