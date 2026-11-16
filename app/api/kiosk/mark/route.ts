import { NextResponse } from "next/server";

import { getSelectedRosterId } from "@/lib/session";
import { getRosterById, markAttendanceForStudent } from "@/lib/storage";

export async function POST(request: Request) {
  const selectedRosterId = await getSelectedRosterId();
  if (!selectedRosterId) {
    return NextResponse.json(
      { ok: false, message: "관리자가 먼저 출결 항목을 선택해야 합니다." },
      { status: 403 },
    );
  }

  const text = await request.text();
  const body = text ? (JSON.parse(text) as { studentNumber?: string }) : { studentNumber: "" };
  const studentNumber = String(body.studentNumber ?? "").replace(/[^0-9]/g, "");

  if (!/^\d{5}$/.test(studentNumber)) {
    return NextResponse.json({ ok: false, message: "5자리 학번을 입력해 주세요." }, { status: 400 });
  }

  const roster = await getRosterById(selectedRosterId);
  if (!roster) {
    return NextResponse.json({ ok: false, message: "선택된 출결 항목이 없습니다." }, { status: 404 });
  }

  const matchedStudent = roster.students.find((student) => student.studentNumber === studentNumber);
  if (!matchedStudent) {
    return NextResponse.json(
      { ok: false, message: "등록되지 않은 학생입니다." },
      { status: 404 },
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const result = await markAttendanceForStudent(selectedRosterId, studentNumber, date);

  return NextResponse.json({
    ok: true,
    status: result.status,
    studentNumber,
    studentName: matchedStudent.name,
    message: "출석이 등록되었습니다.",
  });
}
