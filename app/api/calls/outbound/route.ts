import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireToolSecret } from "@/lib/supabase-admin";

type OutboundCallBody = {
  toNumber?: string;
  customerName?: string;
  appointment?: string;
  orderId?: string;
};

function normalizeE164DominicanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^(809|829|849)\d{7}$/.test(local)) return null;
  return `+1${local}`;
}

async function isAuthorized(request: Request) {
  if (requireToolSecret(request)) return true;
  const supabase = await createClient().catch(() => null);
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;

  if (!apiKey || !agentId || !phoneNumberId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Falta configurar ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID o ELEVENLABS_PHONE_NUMBER_ID."
      },
      { status: 503 }
    );
  }

  let body: OutboundCallBody;
  try {
    body = await request.json() as OutboundCallBody;
  } catch {
    return NextResponse.json({ ok: false, error: "El cuerpo de la solicitud no es válido." }, { status: 400 });
  }

  const toNumber = body.toNumber ? normalizeE164DominicanPhone(body.toNumber) : null;
  if (!toNumber) {
    return NextResponse.json(
      { ok: false, error: "El teléfono debe ser dominicano y comenzar con 809, 829 o 849." },
      { status: 400 }
    );
  }

  const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: phoneNumberId,
      to_number: toNumber,
      call_recording_enabled: false,
      conversation_initiation_client_data: {
        dynamic_variables: {
          customer_name: body.customerName ?? "cliente",
          appointment: body.appointment ?? "la cita registrada",
          order_id: body.orderId ?? "la orden registrada",
          reminder_window: "una hora antes"
        }
      }
    })
  });

  const payload = await response.json().catch(() => null) as unknown;

  if (!response.ok) {
    return NextResponse.json(
      { ok: false, error: "ElevenLabs no pudo iniciar la llamada.", details: payload },
      { status: response.status }
    );
  }

  return NextResponse.json({ ok: true, result: payload });
}
