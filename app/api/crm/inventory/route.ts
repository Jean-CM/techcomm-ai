import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_ORG_ID = "e349e921-568f-44b3-a52f-d2850f480264";
const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

async function requireMembership() {
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

  if (!membership || membership.status !== "active") {
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, user, membership };
}

function cleanSearch(value: string) {
  return value.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ").slice(0, 100);
}

export async function GET(request: NextRequest) {
  const auth = await requireMembership();
  if (auth.error) return auth.error;
  const { admin } = auth;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(10, Number(params.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const query = cleanSearch(params.get("q") || "");
  const itemType = params.get("type") || "all";
  const stockStatus = params.get("stockStatus") || "all";
  const category = params.get("category") || "all";
  const brand = params.get("brand") || "all";
  const sort = params.get("sort") || "updated_desc";

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let productsQuery = admin!
    .from("products")
    .select(
      "id,sku,barcode,name,piece_name,description,item_type,category,subcategory,brand,model,supplier,warehouse_location,unit_cost,sale_price,price,max_discount_pct,minimum_authorized_price,installation_price,delivery_price,installation_includes_delivery,currency,stock,reserved_stock,pending_stock,min_stock,available_stock,inventory_status,serial_tracking,lot_tracking,warranty_days,last_inventory_at,active,created_at,updated_at",
      { count: "exact" },
    )
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("active", true);

  if (query) {
    const like = `%${query}%`;
    productsQuery = productsQuery.or(`sku.ilike.${like},barcode.ilike.${like},name.ilike.${like},piece_name.ilike.${like},brand.ilike.${like},model.ilike.${like},category.ilike.${like},subcategory.ilike.${like},supplier.ilike.${like}`);
  }
  if (itemType !== "all") productsQuery = productsQuery.eq("item_type", itemType);
  if (category !== "all") productsQuery = productsQuery.eq("category", category);
  if (brand !== "all") productsQuery = productsQuery.eq("brand", brand);
  if (stockStatus === "available") productsQuery = productsQuery.eq("inventory_status", "available");
  if (stockStatus === "low") productsQuery = productsQuery.eq("inventory_status", "low");
  if (stockStatus === "out") productsQuery = productsQuery.eq("inventory_status", "out");
  if (stockStatus === "reserved") productsQuery = productsQuery.gt("reserved_stock", 0);
  if (stockStatus === "pending") productsQuery = productsQuery.gt("pending_stock", 0);

  if (sort === "name_asc") productsQuery = productsQuery.order("name", { ascending: true });
  else if (sort === "stock_asc") productsQuery = productsQuery.order("available_stock", { ascending: true });
  else if (sort === "stock_desc") productsQuery = productsQuery.order("available_stock", { ascending: false });
  else productsQuery = productsQuery.order("updated_at", { ascending: false });

  const [products, summary, facets] = await Promise.all([
    productsQuery.range(from, to),
    admin!.rpc("get_inventory_summary", { p_organization_id: DEFAULT_ORG_ID }).single(),
    admin!.rpc("get_inventory_facets", { p_organization_id: DEFAULT_ORG_ID }),
  ]);

  if (products.error) return NextResponse.json({ ok: false, error: products.error.message }, { status: 500 });
  if (summary.error) return NextResponse.json({ ok: false, error: summary.error.message }, { status: 500 });
  if (facets.error) return NextResponse.json({ ok: false, error: facets.error.message }, { status: 500 });

  const facetData = (facets.data ?? {}) as { categories?: string[]; brands?: string[] };
  const total = products.count ?? 0;

  return NextResponse.json({
    ok: true,
    products: products.data ?? [],
    summary: summary.data,
    facets: {
      categories: Array.isArray(facetData.categories) ? facetData.categories : [],
      brands: Array.isArray(facetData.brands) ? facetData.brands : [],
    },
    pagination: {
      page,
      pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
