import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 1000;

// Inizio della giornata corrente in ora italiana, espresso come istante UTC.
function startOfTodayRome(now: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const romeAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = Math.round((romeAsUtc - now.getTime()) / 60000) * 60000;
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset;
}

export async function GET() {
  const session = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!(await verifySessionToken(session))) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("event_stats")
    .select("*")
    .order("event_name", { ascending: true });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "errore db" }, { status: 500 });
  }

  // Clienti unici per mail: leggo tutte le registrazioni a pagine (PostgREST taglia a 1000 righe).
  const rows: { event_id: string; email: string; status: string; created_at: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: pageErr } = await db
      .from("registrations")
      .select("event_id, email, status, created_at")
      .neq("status", "void")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (pageErr) {
      console.error(pageErr);
      return NextResponse.json({ error: "errore db" }, { status: 500 });
    }
    rows.push(...(page ?? []));
    if (!page || page.length < PAGE) break;
  }

  const now = new Date();
  const todayStart = startOfTodayRome(now);
  const hourAgo = now.getTime() - 60 * 60 * 1000;
  let registeredToday = 0;
  let registeredLastHour = 0;
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (t >= todayStart) registeredToday++;
    if (t >= hourAgo) registeredLastHour++;
  }

  const norm = (e: string) => e.trim().toLowerCase();
  const allEmails = new Set<string>();
  const scannedEmails = new Set<string>();
  const perEvent = new Map<string, Set<string>>();
  for (const r of rows) {
    const e = norm(r.email);
    allEmails.add(e);
    if (r.status === "scanned") scannedEmails.add(e);
    if (!perEvent.has(r.event_id)) perEvent.set(r.event_id, new Set());
    perEvent.get(r.event_id)!.add(e);
  }

  const events = data.map((row) => ({
    ...row,
    total_unique: perEvent.get(row.event_id)?.size ?? 0,
  }));

  const totals = data.reduce(
    (acc, row) => {
      acc.total_registered += row.total_registered ?? 0;
      acc.total_scanned += row.total_scanned ?? 0;
      return acc;
    },
    {
      total_registered: 0,
      total_scanned: 0,
      total_unique: allEmails.size,
      total_unique_scanned: scannedEmails.size,
      registered_today: registeredToday,
      registered_last_hour: registeredLastHour,
    }
  );

  return NextResponse.json({ events, totals });
}
