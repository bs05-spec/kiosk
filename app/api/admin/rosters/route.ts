import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/session";
import { listRosters, upsertRosterByName } from "@/lib/storage";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ rosters: [] }, { status: 401 });
  }

  const rosters = await listRosters();
  return NextResponse.json({ rosters });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const text = await request.text();
  const body = text ? (JSON.parse(text) as { name?: string; students?: Array<{ studentNumber: string; name: string }> }) : { name: "", students: [] };
  const name = String(body.name ?? "").trim();
  const students = Array.isArray(body.students) ? body.students : [];

  if (!name) {
    return NextResponse.json({ ok: false, message: "출결 항목 이름이 필요합니다." }, { status: 400 });
  }

  const cleanedStudents = students
    .map((student) => ({
      studentNumber: String(student.studentNumber ?? "").replace(/[^0-9]/g, ""),
      name: String(student.name ?? "").trim(),
    }))
    .filter((student) => student.studentNumber && student.name);

  const seen = new Set<string>();
  for (const student of cleanedStudents) {
    if (!/^\d{5}$/.test(student.studentNumber)) {
      return NextResponse.json(
        { ok: false, message: `학번은 5자리 숫자여야 합니다: ${student.studentNumber || "없음"}` },
        { status: 400 },
      );
    }

    if (seen.has(student.studentNumber)) {
      return NextResponse.json(
        { ok: false, message: `중복 학번이 포함되어 있습니다: ${student.studentNumber}` },
        { status: 400 },
      );
    }

    seen.add(student.studentNumber);
  }

  if (cleanedStudents.length === 0) {
    return NextResponse.json(
      { ok: false, message: "저장할 학생 데이터가 없습니다. 엑셀 명단을 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const roster = await upsertRosterByName(name, cleanedStudents);
    return NextResponse.json({ ok: true, roster });
  } catch (error) {
    console.error("Roster upload failed:", error);
    const details = error instanceof Error ? error.message : String(error);
    const missingFunction =
      details.includes("PGRST202") ||
      details.includes("Could not find the function public.upsert_roster_with_students");

    return NextResponse.json(
      {
        ok: false,
        message: missingFunction
          ? "Supabase에 명단 저장 함수가 없습니다. 최신 supabase/schema.sql을 SQL Editor에서 다시 실행해 주세요."
          : "명단 저장 중 오류가 발생했습니다. 서버 로그를 확인해 주세요.",
      },
      { status: 500 },
    );
  }
}
