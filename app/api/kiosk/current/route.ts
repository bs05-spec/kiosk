import { NextResponse } from "next/server";

import { getSelectedRosterId } from "@/lib/session";
import { getRosterById } from "@/lib/storage";

export async function GET() {
  const rosterId = await getSelectedRosterId();
  if (!rosterId) {
    return NextResponse.json({ roster: null }, { status: 404 });
  }

  const roster = await getRosterById(rosterId);
  if (!roster) {
    return NextResponse.json({ roster: null }, { status: 404 });
  }

  return NextResponse.json({ roster: { id: roster.id, name: roster.name, students: roster.students } });
}
