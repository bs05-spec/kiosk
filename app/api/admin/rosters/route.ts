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

  const roster = await upsertRosterByName(name, cleanedStudents);
  return NextResponse.json({ ok: true, roster });
}
