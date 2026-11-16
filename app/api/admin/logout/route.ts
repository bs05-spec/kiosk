import { NextResponse } from "next/server";

import { clearAdminSession, clearSelectedRosterId } from "@/lib/session";

export async function POST() {
  await clearAdminSession();
  await clearSelectedRosterId();
  return NextResponse.json({ ok: true });
}
