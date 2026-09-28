import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const totals = data.reduce(
    (acc, row) => {
      acc.total_registered += row.total_registered ?? 0;
      acc.total_scanned += row.total_scanned ?? 0;
      return acc;
    },
    { total_registered: 0, total_scanned: 0 }
  );

  return NextResponse.json({ events: data, totals });
}
