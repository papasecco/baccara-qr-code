import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ v: process.env.VERCEL_GIT_COMMIT_SHA ?? null });
}
