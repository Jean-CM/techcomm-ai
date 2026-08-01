import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Payload = {
  customer_id?: string;
  product_id?: string;
  quantity?: number;
  requested_discount_pct?: number;
  include_installation?: boolean;
  include_delivery?: boolean;
  work_order_id?: string;
};

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Payload;
  if (!body.customer_id || !body.product_id) return NextResponse.json({ ok: false, error: "Cliente y producto son requeridos." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const [{ data: customer, error: customerError }, { data: product, error: productError }] = await Promise.all([
    supabase.from("customers").select("id,full_name,phone,address,sector").eq("id", body.customer_id).single(),
    supabase.from("products").select("id,name,piece_name,description,sale_price,price,max_discount_pct,minimum_authorized_price,installation_price,delivery_price,installation_includes_delivery,stock,reserved_stock").eq("id", body.product_id).single(),
  ]);
  if (customerError || productError || !customer || !product) return NextResponse.json({ ok: false, error: customerError?.message || productError?.message || "Datos no encontrados." }, { status: 404 });

  const quantity = Math.max(1, Math.floor(amount(body.quantity) || 1));
  const available = Math.max(0, Number(product.stock || 0) - Number(product.reserved_stock || 0));
  if (available < quantity) return NextResponse.json({ ok: false, error: "No hay inventario suficiente para la cantidad solicitada." }, { status: 400 });

  const unitPrice = Number(product.sale_price ?? product.price ?? 0);
  const requestedDiscount = Math.min(1, amount(body.requested_discount_pct));
  const maxDiscount = Number(product.max_discount_pct || 0);
  const appliedDiscount = Math.min(requestedDiscount, maxDiscount);
  const approvalRequired = requestedDiscount > maxDiscount;
  const baseSubtotal = unitPrice * quantity;
  const discountAmount = baseSubtotal * appliedDiscount;
  const installationAmount = body.include_installation ? Number(product.installation_price || 0) : 0;
  const deliveryFree = Boolean(body.include_installation && product.installation_includes_delivery);
  const deliveryAmount = body.include_delivery && !deliveryFree ? Number(product.delivery_price || 0) : 0;
  const subtotal = baseSubtotal - discountAmount + installationAmount + deliveryAmount;
  const total = subtotal;
  const quoteNumber = `CT-${Date.now().toString().slice(-8)}`;
  const customerAddress = [customer.address, customer.sector].filter(Boolean).join(", ");
  const warrantyNote = "La garantía aplica según el producto, la pieza y el servicio realizado. La instalación y la reparación quedan sujetas a evaluación técnica y a las condiciones indicadas en la cotización.";

  const { data: quote, error: quoteError } = await supabase.from("quotes").insert({
    quote_number: quoteNumber,
    customer_id: customer.id,
    work_order_id: body.work_order_id || null,
    status: approvalRequired ? "pending_approval" : "draft",
    subtotal,
    tax: 0,
    total,
    customer_name_snapshot: customer.full_name,
    customer_phone_snapshot: customer.phone,
    customer_address_snapshot: customerAddress || null,
    warranty_note: warrantyNote,
    discount_amount: discountAmount,
    discount_pct: appliedDiscount,
    installation_included: Boolean(body.include_installation),
    installation_amount: installationAmount,
    delivery_included: Boolean(body.include_delivery || deliveryFree),
    delivery_amount: deliveryAmount,
    approval_required: approvalRequired,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    notes: deliveryFree ? "Instalación con envío incluido." : null,
  }).select().single();
  if (quoteError || !quote) return NextResponse.json({ ok: false, error: quoteError?.message || "No fue posible crear la cotización." }, { status: 500 });

  const description = product.piece_name || product.name;
  const { error: itemError } = await supabase.from("quote_items").insert({
    quote_id: quote.id,
    product_id: product.id,
    description,
    quantity,
    unit_price: unitPrice,
    discount_pct: appliedDiscount,
    discount_amount: discountAmount,
    line_total: baseSubtotal - discountAmount,
  });
  if (itemError) return NextResponse.json({ ok: false, error: itemError.message }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://techcomm-ai-one.vercel.app";
  const previewUrl = `${appUrl}/cotizacion/${quote.public_token}`;
  const message = [
    `Cotización ${quoteNumber}`,
    `Cliente: ${customer.full_name}`,
    customerAddress ? `Dirección: ${customerAddress}` : null,
    `${description}: RD$${unitPrice.toLocaleString("es-DO")}`,
    body.include_installation ? `Instalación: RD$${installationAmount.toLocaleString("es-DO")}` : "Sin instalación",
    deliveryFree ? "Envío: gratis con instalación" : body.include_delivery ? `Envío: RD$${deliveryAmount.toLocaleString("es-DO")}` : "Sin envío",
    appliedDiscount > 0 ? `Descuento aplicado: ${(appliedDiscount * 100).toFixed(0)}%` : null,
    `Total: RD$${total.toLocaleString("es-DO")}`,
    approvalRequired ? "El descuento solicitado requiere aprobación de un supervisor." : "Válida por 7 días.",
    `Ver y responder: ${previewUrl}`,
  ].filter(Boolean).join("\n");

  return NextResponse.json({ ok: true, quote, message, preview_url: previewUrl, approval_required: approvalRequired, available });
}
