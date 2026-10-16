import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { eventNameOf, personOf, ticketTypeOf } from "@/lib/registration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 1000;
const MAX_RESULTS = 20;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export async function GET(req: NextRequest) {
  const session = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!(await verifySessionToken(session))) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3) {
    return NextResponse.json({ results: [], truncated: false });
  }

  const digits = q.replace(/\D/g, "");
  const looksLikePhone = digits.length >= 4 && digits.length >= q.replace(/[\s+]/g, "").length - 1;
  const tokens = norm(q).split(/\s+/).filter(Boolean);

  const db = supabaseAdmin();
  const matches: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await db
      .from("registrations")
      .select("id, email, full_name, status, scanned_at, created_at, raw_answers, event:events(name)")
      .neq("status", "void")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error(error);
      return NextResponse.json({ error: "errore db" }, { status: 500 });
    }
    for (const reg of page ?? []) {
      const { fullName, phone } = personOf(reg);
      let hit: boolean;
      if (looksLikePhone) {
        hit = (phone ?? "").replace(/\D/g, "").includes(digits);
      } else {
        const hay = norm(`${fullName} ${reg.email}`);
        hit = tokens.every((t) => hay.includes(t));
      }
      if (hit) {
        matches.push({
          id: reg.id,
          full_name: fullName || reg.full_name,
          email: reg.email,
          phone,
          event_name: eventNameOf(reg),
          ticket_type: ticketTypeOf(reg),
          status: reg.status,
          scanned_at: reg.scanned_at,
        });
      }
    }
    if (!page || page.length < PAGE) break;
  }

  return NextResponse.json({
    results: matches.slice(0, MAX_RESULTS),
    truncated: matches.length > MAX_RESULTS,
  });
}
