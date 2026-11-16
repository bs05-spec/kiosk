import { NextResponse } from "next/server";

import { isAdminAuthenticated, setSelectedRosterId } from "@/lib/session";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const text = await request.text();
  const body = text ? (JSON.parse(text) as { rosterId?: string }) : { rosterId: "" };
  const rosterId = body.rosterId;

  if (!rosterId) {
    return NextResponse.json({ ok: false, message: "출결 항목이 선택되지 않았습니다." }, { status: 400 });
  }

  await setSelectedRosterId(rosterId);
  return NextResponse.json({ ok: true });
}
