import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";
const WRITE_ROLES = new Set(["owner", "admin", "manager", "analyst", "agent"]);
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

  const { data: product, error: productError } = await auth.admin!
    .from("products")
    .select("id,stock,reserved_stock,pending_stock")
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("id", productId)
    .single();
  if (productError || !product) return NextResponse.json({ ok: false, error: "Producto no encontrado." }, { status: 404 });

  const before = { stock: product.stock, reserved: product.reserved_stock, pending: product.pending_stock };
  let stock = before.stock;
  let reserved = before.reserved;
  let pending = before.pending;

  if (["receipt", "return", "transfer_in"].includes(movementType)) stock += quantity;
  if (["issue", "transfer_out"].includes(movementType)) {
    if (quantity > Math.max(0, stock - reserved)) return NextResponse.json({ ok: false, error: "La salida supera el stock disponible no reservado." }, { status: 409 });
    stock -= quantity;
  }
  if (movementType === "reserve") {
    if (reserved + quantity > stock) return NextResponse.json({ ok: false, error: "La reserva supera el stock total." }, { status: 409 });
    reserved += quantity;
  }
  if (movementType === "release") reserved = Math.max(0, reserved - quantity);
  if (movementType === "pending_add") pending += quantity;
  if (movementType === "pending_cancel") pending = Math.max(0, pending - quantity);
  if (movementType === "pending_receive") {
    const received = Math.min(quantity, pending);
    pending -= received;
    stock += received;
  }

  const now = new Date().toISOString();
  const { error: updateError } = await auth.admin!
    .from("products")
    .update({ stock, reserved_stock: Math.min(reserved, stock), pending_stock: pending, last_inventory_at: now, updated_at: now })
    .eq("id", productId)
    .eq("organization_id", DEFAULT_ORG_ID);
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  const { data: movement, error: movementError } = await auth.admin!
    .from("inventory_movements")
    .insert({
      organization_id: DEFAULT_ORG_ID,
      product_id: productId,
      movement_type: movementType,
      quantity,
      stock_before: before.stock,
      stock_after: stock,
      reserved_before: before.reserved,
      reserved_after: Math.min(reserved, stock),
      pending_before: before.pending,
      pending_after: pending,
      reference_type: String(body.reference_type ?? "").slice(0, 80) || null,
      reference_id: String(body.reference_id ?? "").slice(0, 120) || null,
      note: String(body.note ?? "").slice(0, 500) || null,
      created_by: auth.user!.id,
    })
    .select("id,created_at")
    .single();
  if (movementError) return NextResponse.json({ ok: false, error: movementError.message }, { status: 500 });

  return NextResponse.json({ ok: true, movement, product: { id: productId, stock, reserved_stock: Math.min(reserved, stock), pending_stock: pending, available_stock: Math.max(0, stock - reserved) } });
}
