import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function eventNameOf(reg: any): string | undefined {
  const rel = reg?.event;
  return Array.isArray(rel) ? rel[0]?.name : rel?.name;
}

export async function POST(req: NextRequest) {
  const session = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!(await verifySessionToken(session))) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const token: string | undefined = body?.token;
  if (!token) {
    return NextResponse.json({ error: "token mancante" }, { status: 400 });
  }
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ result: "not_found" }, { status: 404 });
  }

  const db = supabaseAdmin();

  const { data: reg, error } = await db
    .from("registrations")
    .select("id, status, email, full_name, scanned_at, event:events(name)")
    .eq("id", token)
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "errore db" }, { status: 500 });
  }
  if (!reg) {
    return NextResponse.json({ result: "not_found" }, { status: 404 });
  }
  if (reg.status === "scanned") {
    return NextResponse.json({
      result: "already_scanned",
      full_name: reg.full_name,
      email: reg.email,
      event_name: eventNameOf(reg),
      scanned_at: reg.scanned_at,
    });
  }
  if (reg.status === "void") {
    return NextResponse.json({ result: "void" }, { status: 200 });
  }

  const { error: updateErr } = await db
    .from("registrations")
    .update({ status: "scanned", scanned_at: new Date().toISOString() })
    .eq("id", token)
    .eq("status", "valid"); // guardia extra anti doppia-scansione in concorrenza

  if (updateErr) {
    console.error(updateErr);
    return NextResponse.json({ error: "errore aggiornamento" }, { status: 500 });
  }

  return NextResponse.json({
    result: "ok",
    full_name: reg.full_name,
    email: reg.email,
    event_name: eventNameOf(reg),
  });
}
