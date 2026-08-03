import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireToolSecret } from "@/lib/supabase-admin";

type Payload = {
  query?: string;
  brand?: string;
  category?: string;
  model?: string;
};

type ProductRow = {
  id: string;
  sku?: string | null;
  name?: string | null;
  piece_name?: string | null;
  description?: string | null;
  item_type?: string | null;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  sale_price?: number | string | null;
  price?: number | string | null;
  currency?: string | null;
  stock?: number | string | null;
  reserved_stock?: number | string | null;
  installation_price?: number | string | null;
  delivery_price?: number | string | null;
  installation_includes_delivery?: boolean | null;
  max_discount_pct?: number | string | null;
  minimum_authorized_price?: number | string | null;
};

const LARGE_EQUIPMENT_INSTALLATION_PRICE = 2000;
const SMALL_ITEM_DELIVERY_PRICE = 350;

const GENERIC_WORDS = new Set([
  "de",
  "del",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "para",
  "con",
  "sin",
  "que",
  "quiero",
  "busco",
  "necesito",
  "interesa",
  "interesado",
  "interesada",
  "televisor",
  "televisores",
  "television",
  "tv",
  "smart",
  "pulgada",
  "pulgadas",
  "equipo",
  "producto",
]);

function normalize(value?: string | null) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[″”"]/g, " pulgadas ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value?: string | null) {
  return normalize(value)
    .split(/\s+/)
    .filter((word) => word.length > 1 && !GENERIC_WORDS.has(word))
    .slice(0, 12);
}

function availableUnits(item: ProductRow) {
  return Math.max(0, Number(item.stock || 0) - Number(item.reserved_stock || 0));
}

function productText(item: ProductRow) {
  return normalize(
    [item.sku, item.name, item.piece_name, item.description, item.category, item.brand, item.model]
      .filter(Boolean)
      .join(" "),
  );
}

function isLargeInstallableEquipment(item: ProductRow) {
  const text = productText(item);
  return [
    "televisor",
    "television",
    "smart tv",
    "lavadora",
    "secadora",
    "estufa",
    "cocina",
    "aire acondicionado",
    "nevera",
    "refrigerador",
    "freezer",
    "congelador",
    "horno",
    "lavaplatos",
  ].some((term) => text.includes(term));
}

function isSmallDeliveryItem(item: ProductRow) {
  const text = productText(item);
  const type = normalize(item.item_type);
  if (type === "accessory") return true;
  return [
    "movil",
    "celular",
    "telefono",
    "smartphone",
    "iphone",
    "cover",
    "funda",
    "protector",
    "cargador",
    "cable",
    "audifono",
    "bateria",
    "tableta",
    "tablet",
  ].some((term) => text.includes(term));
}

function requestedTelevisionSize(value?: string) {
  const normalized = normalize(value);
  const explicit = normalized.match(/\b(\d{2,3})\s*(?:pulgada|pulgadas|pulg|inch|inches)\b/);
  if (explicit) return Number(explicit[1]);

  const televisionRequest = /\b(?:tv|televisor|television|smart tv)\b/.test(normalized);
  if (!televisionRequest) return null;

  const standalone = normalized.match(/\b(2[4-9]|[3-9]\d|1[01]\d)\b/);
  return standalone ? Number(standalone[1]) : null;
}

function productMatchesSize(item: ProductRow, size: number) {
  const text = productText(item);
  return new RegExp(`\\b${size}(?:\\s*(?:pulgada|pulgadas|pulg))?\\b`).test(text);
}

function explicitBrandFromQuery(queryText: string, products: ProductRow[]) {
  const normalizedQuery = normalize(queryText);
  const brands = [...new Set(products.map((item) => item.brand?.trim()).filter((value): value is string => Boolean(value)))];
  return brands.find((brand) => {
    const normalizedBrand = normalize(brand);
    return normalizedBrand && new RegExp(`(^|\\s)${normalizedBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`).test(normalizedQuery);
  }) ?? null;
}

function presentationMode(requestedBrand: string | null, requestedModel: string | null, requestedSize: number | null) {
  if (requestedModel) return "exact_model";
  if (requestedBrand && requestedSize != null) return "brand_and_size";
  if (requestedBrand) return "brand_only";
  if (requestedSize != null) return "size_only";
  return "general_category";
}

export async function POST(request: Request) {
  if (!requireToolSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Payload;
  const supabase = getSupabaseAdmin();

  let databaseQuery = supabase
    .from("products")
    .select(
      "id,sku,name,piece_name,description,item_type,category,brand,model,sale_price,price,currency,stock,reserved_stock,installation_price,delivery_price,installation_includes_delivery,max_discount_pct,minimum_authorized_price",
    )
    .eq("active", true)
    .limit(250);

  if (body.brand?.trim()) databaseQuery = databaseQuery.ilike("brand", `%${body.brand.trim()}%`);
  if (body.category?.trim()) databaseQuery = databaseQuery.ilike("category", `%${body.category.trim()}%`);
  if (body.model?.trim()) databaseQuery = databaseQuery.ilike("model", `%${body.model.trim()}%`);

  const { data, error } = await databaseQuery;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const products = (data ?? []) as ProductRow[];
  const queryText = body.query?.trim() ?? "";
  const requestedSize = requestedTelevisionSize(queryText);
  const requestedBrand = body.brand?.trim() || explicitBrandFromQuery(queryText, products);
  const requestedModel = body.model?.trim() || null;
  const tokens = words(queryText).filter((token) => token !== String(requestedSize ?? ""));

  const exactCandidates = products
    .filter((item) => availableUnits(item) > 0)
    .filter((item) => !requestedBrand || normalize(item.brand).includes(normalize(requestedBrand)))
    .filter((item) => !requestedModel || normalize(item.model).includes(normalize(requestedModel)))
    .filter((item) => requestedSize == null || productMatchesSize(item, requestedSize));

  const ranked = exactCandidates
    .map((item) => {
      const text = productText(item);
      const tokenScore = tokens.reduce((total, token) => total + (text.includes(token) ? 1 : 0), 0);
      const brandScore = requestedBrand && normalize(item.brand).includes(normalize(requestedBrand)) ? 5 : 0;
      const sizeScore = requestedSize != null && productMatchesSize(item, requestedSize) ? 5 : 0;
      const modelScore = requestedModel && normalize(item.model).includes(normalize(requestedModel)) ? 8 : 0;
      return { item, score: tokenScore + brandScore + sizeScore + modelScore };
    })
    .filter(({ score }) => !tokens.length || score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ item }) => {
      const configuredInstallationPrice = Number(item.installation_price || 0);
      const configuredDeliveryPrice = Number(item.delivery_price || 0);
      const largeInstallableEquipment = isLargeInstallableEquipment(item);
      const smallDeliveryItem = isSmallDeliveryItem(item);

      const installationPrice = largeInstallableEquipment
        ? configuredInstallationPrice > 0
          ? configuredInstallationPrice
          : LARGE_EQUIPMENT_INSTALLATION_PRICE
        : configuredInstallationPrice > 0
          ? configuredInstallationPrice
          : null;

      const deliveryPrice = smallDeliveryItem
        ? configuredDeliveryPrice > 0
          ? configuredDeliveryPrice
          : SMALL_ITEM_DELIVERY_PRICE
        : configuredDeliveryPrice > 0
          ? configuredDeliveryPrice
          : null;

      return {
        id: item.id,
        sku: item.sku,
        name: item.piece_name || item.name,
        description: item.description,
        item_type: item.item_type,
        category: item.category,
        brand: item.brand,
        model: item.model,
        price: Number(item.sale_price ?? item.price ?? 0),
        currency: item.currency,
        available: true,
        installation_available: installationPrice !== null,
        installation_price: installationPrice,
        delivery_price: deliveryPrice,
        installation_includes_delivery: largeInstallableEquipment
          ? true
          : installationPrice !== null && Boolean(item.installation_includes_delivery),
        service_pricing_rule: largeInstallableEquipment
          ? "large_equipment_installation"
          : smallDeliveryItem
            ? "small_item_delivery"
            : "catalog_configuration",
        discount_available: Number(item.max_discount_pct || 0) > 0,
        minimum_authorized_price: Number(item.minimum_authorized_price || 0),
      };
    });

  const strictRequest = Boolean(requestedBrand || requestedModel || requestedSize != null);
  const mode = presentationMode(requestedBrand, requestedModel, requestedSize);

  const presentationInstructions: Record<string, string> = {
    general_category: "Presenta hasta tres opciones disponibles. No menciones instalación ni envío salvo que el cliente lo pregunte.",
    size_only: "Presenta todas las opciones disponibles de ese tamaño, con un máximo de tres. Para cada una indica marca, tamaño, característica principal y precio. No menciones instalación ni envío salvo que el cliente lo pregunte.",
    brand_only: "Presenta únicamente opciones de la marca solicitada. No menciones otras marcas ni instalación o envío salvo que el cliente lo solicite.",
    brand_and_size: "Presenta únicamente opciones que coincidan con esa marca y tamaño. No sugieras otras marcas o tamaños. No menciones instalación ni envío salvo que el cliente lo solicite.",
    exact_model: "Responde únicamente sobre el modelo solicitado. No sugieras otras opciones. No menciones instalación ni envío salvo que el cliente lo solicite.",
  };

  return NextResponse.json({
    ok: true,
    found: ranked.length > 0,
    strict_match: strictRequest,
    presentation_mode: mode,
    requested: {
      brand: requestedBrand,
      model: requestedModel,
      size_inches: requestedSize,
    },
    service_policy: {
      repair_visit_price: 500,
      repair_visit_creditable: true,
      large_equipment_installation_price: LARGE_EQUIPMENT_INSTALLATION_PRICE,
      large_equipment_installation_includes_delivery: true,
      small_item_delivery_price: SMALL_ITEM_DELIVERY_PRICE,
    },
    products: ranked,
    customer_message: ranked.length
      ? `${presentationInstructions[mode]} Presenta únicamente los productos devueltos en products. No reveles cantidades exactas ni información interna.`
      : strictRequest
        ? "No hay una coincidencia exacta disponible para lo solicitado. No ofrezcas alternativas todavía. Pregunta si el cliente desea ver otras marcas, tamaños o modelos disponibles."
        : "No se encontró una coincidencia disponible. Solicita una marca, tamaño, modelo o característica para refinar la búsqueda.",
  });
}
