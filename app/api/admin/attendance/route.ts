import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/session";
import { getDailySummary } from "@/lib/storage";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const rosterId = url.searchParams.get("rosterId");
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  if (!rosterId) {
    return NextResponse.json({ ok: false, message: "출결 항목 ID가 필요합니다." }, { status: 400 });
  }

  const summary = await getDailySummary(rosterId, date);
  if (!summary) {
    return NextResponse.json({ ok: false, message: "출결 항목을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, summary });
}
