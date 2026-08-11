import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/require-org-role";

const LARGE_EQUIPMENT_INSTALLATION_PRICE = 2000;
const SMALL_ITEM_DELIVERY_PRICE = 350;
const MAX_QUOTE_ITEMS = 30;

const QUOTE_WRITE_ROLES = ["owner", "admin", "manager", "agent"] as const;

type ItemInput = {
  product_id?: string;
  quantity?: number;
  requested_discount_pct?: number;
};

type Payload = {
  customer_id?: string;
  product_id?: string;
  quantity?: number;
  requested_discount_pct?: number;
  items?: ItemInput[];
  include_installation?: boolean;
  include_delivery?: boolean;
  work_order_id?: string;
  notes?: string;
};

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function fraction(value: unknown) {
  const parsed = amount(value);
  return Math.min(1, parsed > 1 ? parsed / 100 : parsed);
}

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLargeInstallableEquipment(product: Record<string, unknown>) {
  const text = normalize([
    product.name,
    product.piece_name,
    product.description,
    product.category,
    product.item_type,
  ].filter(Boolean).join(" "));

  return [
    "televisor", "television", "smart tv", "lavadora", "secadora", "estufa", "cocina",
    "aire acondicionado", "nevera", "refrigerador", "freezer", "congelador", "horno", "lavaplatos",
  ].some((term) => text.includes(term));
}

function isSmallDeliveryItem(product: Record<string, unknown>) {
  const text = normalize([
    product.name,
    product.piece_name,
    product.description,
    product.category,
    product.item_type,
  ].filter(Boolean).join(" "));

  return normalize(product.item_type) === "accessory" || [
    "movil", "celular", "telefono", "smartphone", "iphone", "cover", "funda", "protector",
    "cargador", "cable", "audifono", "bateria", "tableta", "tablet",
  ].some((term) => text.includes(term));
}

export async function POST(request: Request) {
  const auth = await requireOrgRole(QUOTE_WRITE_ROLES);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({})) as Payload;
  if (!body.customer_id) {
    return NextResponse.json({ ok: false, error: "Cliente es requerido." }, { status: 400 });
  }

  const incomingItems = Array.isArray(body.items) && body.items.length
    ? body.items
    : body.product_id
      ? [{ product_id: body.product_id, quantity: body.quantity, requested_discount_pct: body.requested_discount_pct }]
      : [];

  if (!incomingItems.length) {
    return NextResponse.json({ ok: false, error: "Agrega al menos un producto a la cotización." }, { status: 400 });
  }
  if (incomingItems.length > MAX_QUOTE_ITEMS) {
    return NextResponse.json({ ok: false, error: `Máximo ${MAX_QUOTE_ITEMS} líneas por cotización.` }, { status: 400 });
  }

  const consolidated = new Map<string, { quantity: number; requested_discount_pct: number }>();
  for (const item of incomingItems) {
    const productId = String(item.product_id ?? "").trim();
    if (!productId) continue;
    const current = consolidated.get(productId) ?? { quantity: 0, requested_discount_pct: 0 };
    current.quantity += Math.max(1, Math.floor(amount(item.quantity) || 1));
    current.requested_discount_pct = Math.max(current.requested_discount_pct, fraction(item.requested_discount_pct));
    consolidated.set(productId, current);
  }

  if (!consolidated.size) {
    return NextResponse.json({ ok: false, error: "Los productos seleccionados no son válidos." }, { status: 400 });
  }

  const admin = auth.admin!;
  const productIds = [...consolidated.keys()];
  const [{ data: customer, error: customerError }, { data: products, error: productError }] = await Promise.all([
    admin.from("customers")
      .select("id,full_name,phone,address,sector")
      .eq("id", body.customer_id)
      .eq("organization_id", auth.organizationId!)
      .single(),
    admin.from("products")
      .select("id,name,piece_name,description,item_type,category,sale_price,price,max_discount_pct,minimum_authorized_price,installation_price,delivery_price,installation_includes_delivery,stock,reserved_stock,active")
      .eq("organization_id", auth.organizationId!)
      .eq("active", true)
      .in("id", productIds),
  ]);

  if (customerError || !customer) {
    return NextResponse.json({ ok: false, error: customerError?.message || "Cliente no encontrado." }, { status: 404 });
  }
  if (productError || !products || products.length !== productIds.length) {
    return NextResponse.json({ ok: false, error: productError?.message || "Uno o más productos no están disponibles." }, { status: 404 });
  }

  let baseSubtotal = 0;
  let totalDiscount = 0;
  let approvalRequired = false;
  const lineRows: Array<Record<string, unknown>> = [];

  for (const product of products) {
    const requested = consolidated.get(product.id)!;
    const available = Math.max(0, Number(product.stock || 0) - Number(product.reserved_stock || 0));
    if (available < requested.quantity) {
      return NextResponse.json({
        ok: false,
        error: `${product.piece_name || product.name}: disponible ${available}, solicitado ${requested.quantity}.`,
      }, { status: 409 });
    }

    const unitPrice = Number(product.sale_price ?? product.price ?? 0);
    if (!(unitPrice > 0)) {
      return NextResponse.json({ ok: false, error: `${product.piece_name || product.name} no tiene precio de venta válido.` }, { status: 409 });
    }

    const maxDiscount = Math.max(0, Math.min(1, Number(product.max_discount_pct || 0)));
    const appliedDiscount = Math.min(requested.requested_discount_pct, maxDiscount);
    if (requested.requested_discount_pct > maxDiscount) approvalRequired = true;

    const gross = unitPrice * requested.quantity;
    const discountAmount = gross * appliedDiscount;
    const lineTotal = gross - discountAmount;
    baseSubtotal += gross;
    totalDiscount += discountAmount;

    lineRows.push({
      organization_id: auth.organizationId,
      product_id: product.id,
      description: product.piece_name || product.name,
      quantity: requested.quantity,
      unit_price: unitPrice,
      discount_pct: appliedDiscount,
      discount_amount: discountAmount,
      line_total: lineTotal,
    });
  }

  const largeInstallable = products.find((product) => isLargeInstallableEquipment(product as unknown as Record<string, unknown>));
  const smallDelivery = products.find((product) => isSmallDeliveryItem(product as unknown as Record<string, unknown>));
  const installationAmount = body.include_installation
    ? Number(largeInstallable?.installation_price || 0) > 0
      ? Number(largeInstallable?.installation_price || 0)
      : largeInstallable ? LARGE_EQUIPMENT_INSTALLATION_PRICE : 0
    : 0;
  const deliveryIncludedWithInstall = Boolean(body.include_installation && largeInstallable);
  const deliveryAmount = body.include_delivery && !deliveryIncludedWithInstall
    ? Number(smallDelivery?.delivery_price || 0) > 0
      ? Number(smallDelivery?.delivery_price || 0)
      : smallDelivery ? SMALL_ITEM_DELIVERY_PRICE : 0
    : 0;

  const linesAfterDiscount = baseSubtotal - totalDiscount;
  const subtotal = linesAfterDiscount + installationAmount + deliveryAmount;
  const tax = 0;
  const total = subtotal + tax;
  const weightedDiscount = baseSubtotal > 0 ? totalDiscount / baseSubtotal : 0;

  const { data: quoteNumber, error: numberError } = await admin.rpc("next_quote_number");
  if (numberError || !quoteNumber) {
    return NextResponse.json({ ok: false, error: "No fue posible generar el número de cotización." }, { status: 500 });
  }

  const customerAddress = [customer.address, customer.sector].filter(Boolean).join(", ");
  const warrantyNote = "Condiciones y garantía pendientes de la política comercial definitiva de Techcomm Wireless. La disponibilidad y el alcance técnico se validan antes de ejecutar el servicio.";
  const now = new Date().toISOString();

  const { data: quote, error: quoteError } = await admin.from("quotes").insert({
    organization_id: auth.organizationId,
    quote_number: quoteNumber,
    customer_id: customer.id,
    work_order_id: body.work_order_id || null,
    status: approvalRequired ? "pending_approval" : "draft",
    subtotal,
    tax,
    total,
    customer_name_snapshot: customer.full_name,
    customer_phone_snapshot: customer.phone,
    customer_address_snapshot: customerAddress || null,
    warranty_note: warrantyNote,
    discount_amount: totalDiscount,
    discount_pct: weightedDiscount,
    installation_included: Boolean(body.include_installation && installationAmount > 0),
    installation_amount: installationAmount,
    delivery_included: Boolean(body.include_delivery || deliveryIncludedWithInstall),
    delivery_amount: deliveryAmount,
    approval_required: approvalRequired,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    notes: String(body.notes ?? "").trim().slice(0, 1500) || (deliveryIncludedWithInstall ? "Instalación con envío incluido." : null),
    created_by: auth.user!.id,
    updated_at: now,
  }).select("id,public_token,quote_number,status,total,approval_required,expires_at").single();

  if (quoteError || !quote) {
    return NextResponse.json({ ok: false, error: quoteError?.message || "No fue posible crear la cotización." }, { status: 500 });
  }

  const itemsToInsert = lineRows.map((row) => ({ ...row, quote_id: quote.id }));
  const { error: itemError } = await admin.from("quote_items").insert(itemsToInsert);
  if (itemError) {
    await admin.from("quotes").delete().eq("id", quote.id).eq("organization_id", auth.organizationId!);
    return NextResponse.json({ ok: false, error: "No fue posible guardar los artículos de la cotización." }, { status: 500 });
  }

  await admin.from("quote_events").insert({
    organization_id: auth.organizationId,
    quote_id: quote.id,
    event_type: "created",
    actor_type: "user",
    actor_user_id: auth.user!.id,
    metadata: {
      items: itemsToInsert.length,
      base_subtotal: baseSubtotal,
      discount_amount: totalDiscount,
      installation_amount: installationAmount,
      delivery_amount: deliveryAmount,
      approval_required: approvalRequired,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://techcomm-ai-one.vercel.app";
  const previewUrl = `${appUrl}/cotizacion/${quote.public_token}`;

  return NextResponse.json({
    ok: true,
    quote,
    preview_url: previewUrl,
    approval_required: approvalRequired,
    line_count: itemsToInsert.length,
    pricing_policy: {
      provisional: true,
      installation_large_equipment_default: LARGE_EQUIPMENT_INSTALLATION_PRICE,
      small_item_delivery_default: SMALL_ITEM_DELIVERY_PRICE,
    },
  });
}
