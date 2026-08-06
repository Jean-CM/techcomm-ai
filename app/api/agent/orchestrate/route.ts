import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseAdmin, requireToolSecret } from "@/lib/supabase-admin";

// ---------------------------------------------------------------------------
// Techcomm's own AI orchestrator (text channels: WhatsApp / Web).
// Voice stays on ElevenLabs for now. This route owns the prompt, the model
// choice, and the tool-calling loop — the part of the platform that is
// actually yours, versioned, and portable.
// ---------------------------------------------------------------------------

const MODEL = "gpt-5.6-terra";

// Published per-million-token rates (short-context tier). Update here if
// OpenAI changes pricing — this is the single source of truth used to
// compute llm_cost_usd on every logged run.
const PRICE_PER_MILLION_INPUT = 2.0;
const PRICE_PER_MILLION_OUTPUT = 12.0;

const TOOL_SECRET = process.env.TECHCOMM_TOOL_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

const SYSTEM_PROMPT = `Eres el asistente de Techcomm Wireless, un negocio de reparación y venta de equipos en República Dominicana, escribiendo por WhatsApp. Escribes exactamente como un empleado real de confianza escribiría — no como un bot.

Cómo escribes:
- Un mensaje = una idea. Nada de listas con guiones, nada de pedir varios datos de un jalón.
- Abre reconociendo lo que le pasa al cliente con calidez genuina antes de pedir nada ("Ay, qué molesto eso", "Uy, vamos a resolverlo"). No repitas la misma muletilla en cada mensaje.
- Pide un dato a la vez, en el orden que fluiría en una conversación real: primero qué pasa y el equipo, luego el nombre, después cómo contactarlo y la dirección, y al final cuándo prefiere la visita.
- Escribe como se escribe en WhatsApp de verdad: frases cortas, tono natural dominicano, sin sonar corporativo ni acartonado. Nada de "estimado cliente" ni firmas formales.
- Usa el nombre del cliente una vez que lo tengas, con naturalidad, no en cada mensaje.
- Antes de crear cualquier orden, resume en un mensaje corto lo que tienes (equipo, dirección, fecha/hora, costo) y pregunta "¿así está bien?" — espera un sí antes de ejecutar la herramienta. Nunca te saltes este paso.

Fechas y horas:
- Cuando el cliente dé un día/hora, conviértelo tú misma a ISO 8601 incluyendo SIEMPRE el offset de Santo Domingo: -04:00. Ejemplo: si dice "mañana a las 10am", eso se traduce como 2026-08-07T10:00:00-04:00 (usa la fecha real de mañana). Nunca mandes la hora sin el "-04:00" al final.
- El horario de visitas es de 8:00am a 4:00pm. Si el cliente pide una hora fuera de ese rango, dile el horario y pide otra.

Reglas que no puedes romper:
- Nunca inventes números de orden, estados, precios o disponibilidad de técnicos — todo dato factual sale de una herramienta, nunca de tu cabeza.
- Nunca uses "no proporcionado", "Cliente", "pendiente" ni similares para rellenar un campo — pregúntale al cliente el dato real.
- Si el cliente muestra frustración o pide explícitamente hablar con una persona, deja de usar herramientas y dile que un agente humano va a continuar la conversación.`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_service_order",
      description: "Crea una orden de servicio (visita técnica) para una avería o reparación. Usar solo cuando ya tengas todos los datos reales del cliente.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          customer_phone: { type: "string", description: "Número dominicano de 10 dígitos (809/829/849)" },
          address: { type: "string" },
          sector: { type: "string" },
          equipment: { type: "string" },
          brand: { type: "string" },
          model: { type: "string" },
          issue: { type: "string" },
          scheduled_at: { type: "string", description: "Fecha y hora ISO 8601 CON el offset de zona horaria de Santo Domingo incluido, ej: 2026-08-11T15:00:00-04:00. Nunca la mandes sin el -04:00 al final." },
          source: { type: "string", enum: ["whatsapp", "phone", "web", "crm"] },
          visit_fee_accepted: { type: "boolean" },
          customer_confirmed: { type: "boolean", description: "True solo después de que el cliente confirmó por escrito el resumen completo de la visita (equipo, dirección, fecha/hora, costo)." }
        },
        required: ["customer_name", "customer_phone", "address", "equipment", "issue", "scheduled_at", "visit_fee_accepted"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "lookup_customer",
      description: "Busca o registra un cliente por su número de teléfono.",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string" },
          full_name: { type: "string" },
          email: { type: "string" },
          address: { type: "string" },
          sector: { type: "string" }
        },
        required: ["phone"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Busca productos en el catálogo (para consultas de compra o piezas).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          brand: { type: "string" },
          category: { type: "string" },
          model: { type: "string" }
        }
      }
    }
  }
];

const TOOL_ENDPOINTS: Record<string, string> = {
  create_service_order: "/api/tools/create-service-order",
  lookup_customer: "/api/tools/customers",
  search_products: "/api/tools/products"
};

async function callToolEndpoint(name: string, args: Record<string, unknown>) {
  const path = TOOL_ENDPOINTS[name];
  if (!path) return { ok: false, error: `Unknown tool: ${name}` };
  const response = await fetch(`${APP_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(TOOL_SECRET ? { "x-techcomm-tool-secret": TOOL_SECRET } : {})
    },
    body: JSON.stringify(args)
  });
  return response.json().catch(() => ({ ok: false, error: "Invalid tool response" }));
}

type OrchestratePayload = {
  conversation_id?: string;
  channel?: "whatsapp" | "web";
  customer_phone?: string;
  message: string;
};

export async function POST(request: Request) {
  if (!requireToolSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  const body = (await request.json().catch(() => null)) as OrchestratePayload | null;
  if (!body?.message) {
    return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
  }

  const channel = body.channel ?? "whatsapp";
  const supabase = getSupabaseAdmin();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Resolve or create the conversation so we keep real history across turns.
  let conversationId = body.conversation_id ?? null;
  if (!conversationId) {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ channel, status: "open", started_at: new Date().toISOString() })
      .select("id")
      .single();
    conversationId = created?.id ?? null;
  }

  const { data: priorMessages } = conversationId
    ? await supabase
        .from("messages")
        .select("role,content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(20)
    : { data: [] as { role: string; content: string }[] };

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...((priorMessages ?? []).map((m) => ({
      role: m.role === "customer" ? "user" : "assistant",
      content: m.content
    })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]),
    { role: "user", content: body.message }
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsUsed: string[] = [];
  let status: "success" | "error" | "escalated_to_human" = "success";
  let errorMessage: string | null = null;
  let finalReply = "";

  try {
    for (let turn = 0; turn < 5; turn++) {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: "auto",
        reasoning_effort: "none" as OpenAI.Chat.Completions.ChatCompletionCreateParams["reasoning_effort"]
      });

      totalInputTokens += completion.usage?.prompt_tokens ?? 0;
      totalOutputTokens += completion.usage?.completion_tokens ?? 0;

      const choice = completion.choices[0];
      const toolCalls = choice.message.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        finalReply = choice.message.content ?? "";
        break;
      }

      messages.push(choice.message);

      for (const call of toolCalls) {
        const args = JSON.parse(call.function.arguments || "{}");
        toolsUsed.push(call.function.name);
        const result = await callToolEndpoint(call.function.name, args);

        await supabase.from("ai_agent_tool_calls").insert({
          run_id: null, // backfilled after the run row is created below
          tool_name: call.function.name,
          arguments: args,
          result,
          succeeded: Boolean(result?.ok)
        }).select().maybeSingle();

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result)
        });
      }
    }
  } catch (err) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : "Unknown error";
    finalReply = "Disculpa, tuve un problema procesando tu mensaje. Un agente humano te va a contactar.";
  }

  const llmCost =
    (totalInputTokens / 1_000_000) * PRICE_PER_MILLION_INPUT +
    (totalOutputTokens / 1_000_000) * PRICE_PER_MILLION_OUTPUT;

  // Persist the conversation turn.
  if (conversationId) {
    await supabase.from("messages").insert([
      { conversation_id: conversationId, role: "customer", content: body.message, message_type: "text" },
      { conversation_id: conversationId, role: "assistant", content: finalReply, message_type: "text" }
    ]);
  }

  const { data: run } = await supabase
    .from("ai_agent_runs")
    .insert({
      organization_id: "e349e921-568f-44b3-a52f-d2850f480264",
      conversation_id: conversationId,
      channel,
      model: MODEL,
      status,
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      llm_cost_usd: Number(llmCost.toFixed(6)),
      latency_ms: Date.now() - startedAt,
      tools_used: toolsUsed,
      error_message: errorMessage
    })
    .select("id")
    .single();

  return NextResponse.json({
    ok: status !== "error",
    conversation_id: conversationId,
    reply: finalReply,
    run_id: run?.id ?? null,
    tools_used: toolsUsed,
    cost_usd: Number(llmCost.toFixed(6))
  });
}
