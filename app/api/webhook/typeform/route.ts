import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { generateQrPng } from "@/lib/qrcode";
import { sendConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs";

// Verifica la firma che Typeform manda nell'header "Typeform-Signature"
// (HMAC SHA256 del body grezzo, con il secret configurato sul webhook Typeform).
function verifyTypeformSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.TYPEFORM_WEBHOOK_SECRET;
  if (!secret) throw new Error("TYPEFORM_WEBHOOK_SECRET mancante");
  if (!signatureHeader) return false;

  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("base64");

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type TypeformAnswer = {
  type: string;
  text?: string;
  email?: string;
  choice?: { label?: string; other?: string };
  choices?: { labels?: string[]; other?: string };
  field: { ref?: string; id: string; type: string };
};

type TypeformDefinitionField = { id: string; ref?: string; title?: string };

const TICKET_REFS = ["ticket", "ticket_type", "tipologia_ticket"];

// Trova la risposta al campo "tipologia ticket": per ref (ticket, ticket_type, tipologia_ticket)
// oppure, in mancanza, per titolo della domanda che contiene "ticket" o "tipologia".
function extractTicketType(answers: TypeformAnswer[], fields: TypeformDefinitionField[]): string | null {
  const field = fields.find(
    (f) => (f.ref && TICKET_REFS.includes(f.ref)) || /ticket|tipologia/i.test(f.title ?? "")
  );
  if (!field) return null;
  const a = answers.find((x) => x.field?.id === field.id);
  if (!a) return null;
  const value =
    a.choice?.label ?? a.choice?.other ?? a.choices?.labels?.join(", ") ?? a.choices?.other ?? a.text ?? null;
  return value ? value.trim() : null;
}

function extractEmailAndName(answers: TypeformAnswer[]): { email: string | null; fullName: string | null } {
  let email: string | null = null;
  let fullName: string | null = null;

  for (const a of answers) {
    if (a.type === "email" && a.email) email = a.email;
    if (a.field?.ref === "email" && a.email) email = a.email;
    if ((a.field?.ref === "name" || a.field?.ref === "full_name") && a.text) fullName = a.text;
  }
  // Fallback: se nessun campo aveva ref "name", prendi la prima risposta testuale libera
  if (!fullName) {
    const firstText = answers.find((a) => a.type === "text" && a.text);
    if (firstText?.text) fullName = firstText.text;
  }
  return { email, fullName };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("typeform-signature");

  try {
    if (!verifyTypeformSignature(rawBody, signature)) {
      return NextResponse.json({ error: "firma non valida" }, { status: 401 });
    }
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "config webhook mancante" }, { status: 500 });
  }

  const payload = JSON.parse(rawBody);
  const formId: string | undefined = payload?.form_response?.form_id;
  const responseToken: string | undefined = payload?.form_response?.token;
  const answers: TypeformAnswer[] = payload?.form_response?.answers ?? [];
  const definitionFields: TypeformDefinitionField[] = payload?.form_response?.definition?.fields ?? [];
  const ticketType = extractTicketType(answers, definitionFields);

  if (!formId || !responseToken) {
    return NextResponse.json({ error: "payload inatteso" }, { status: 400 });
  }

  const { email, fullName } = extractEmailAndName(answers);
  if (!email) {
    return NextResponse.json(
      { error: "nessuna email trovata nelle risposte, controlla i 'ref' dei campi nel typeform" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { data: event, error: eventErr } = await db
    .from("events")
    .select("id, name, is_active")
    .eq("typeform_form_id", formId)
    .maybeSingle();

  if (eventErr) {
    console.error(eventErr);
    return NextResponse.json({ error: "errore db" }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json(
      { error: `nessun evento configurato per il typeform ${formId}. Aggiungilo nella tabella 'events'.` },
      { status: 404 }
    );
  }
  if (!event.is_active) {
    return NextResponse.json({ error: "evento non attivo" }, { status: 200 });
  }

  // Idempotenza: se Typeform ripete il webhook per la stessa risposta, non duplichiamo la registrazione.
  const { data: existing } = await db
    .from("registrations")
    .select("id, email_status")
    .eq("event_id", event.id)
    .eq("typeform_response_token", responseToken)
    .maybeSingle();

  let registrationId: string;

  if (existing) {
    registrationId = existing.id;
    if (existing.email_status === "sent") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  } else {
    const { data: inserted, error: insertErr } = await db
      .from("registrations")
      .insert({
        event_id: event.id,
        typeform_response_token: responseToken,
        email,
        full_name: fullName,
        raw_answers: answers,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error(insertErr);
      return NextResponse.json({ error: "errore inserimento registrazione" }, { status: 500 });
    }
    registrationId = inserted.id;
  }

  try {
    const qrPng = await generateQrPng(registrationId);
    await sendConfirmationEmail({
      to: email,
      fullName,
      ticketType,
      eventName: event.name,
      qrPngBuffer: qrPng,
    });
    await db.from("registrations").update({ email_status: "sent", email_error: null }).eq("id", registrationId);
  } catch (e: any) {
    console.error("invio email fallito", e);
    await db
      .from("registrations")
      .update({ email_status: "failed", email_error: String(e?.message ?? e) })
      .eq("id", registrationId);
    return NextResponse.json({ error: "invio email fallito" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, registrationId });
}
