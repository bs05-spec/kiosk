import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { setAdminSession } from "@/lib/session";

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const { password } = body as { password?: string };
    const supplied = String(password ?? "");
    const configuredHash = process.env.ADMIN_PASSWORD_HASH;
    if (!configuredHash) {
      console.error("ADMIN_PASSWORD_HASH is not configured.");
      return NextResponse.json(
        { ok: false, message: "관리자 비밀번호 해시를 환경 변수에 설정해 주세요." },
        { status: 500 },
      );
    }

    const isValid = await bcrypt.compare(supplied, configuredHash);
    if (!isValid) {
      return NextResponse.json(
        { ok: false, message: "비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    await setAdminSession();
    return NextResponse.json({ ok: true, message: "관리자 인증 완료" });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { ok: false, message: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
