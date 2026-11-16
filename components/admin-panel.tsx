"use client";

import * as XLSX from "xlsx";
import { useEffect, useMemo, useState } from "react";

type StudentRow = {
  studentNumber: string;
  name: string;
};

type RosterEntry = {
  id: string;
  name: string;
  students: StudentRow[];
  createdAt: string;
  updatedAt: string;
};

type DailySummary = {
  rosterName: string;
  present: StudentRow[];
  absent: StudentRow[];
  attendanceRate: number;
};

export function AdminPanel() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [message, setMessage] = useState("");
  const [rosters, setRosters] = useState<RosterEntry[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [previewRows, setPreviewRows] = useState<StudentRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const currentRosterName = useMemo(
    () => rosters.find((item) => item.id === selectedRosterId)?.name ?? "",
    [rosters, selectedRosterId],
  );

  const loadRosters = async () => {
    const response = await fetch("/api/admin/rosters", { cache: "no-store" });
    if (response.status === 401) {
      setIsAuthenticated(false);
      setMessage("관리자 인증이 필요합니다.");
      return;
    }

    if (!response.ok) {
      setMessage("출결 목록을 불러오지 못했습니다.");
      return;
    }

    const payload = (await response.json()) as { rosters: RosterEntry[] };
    setRosters(payload.rosters);
    setIsAuthenticated(true);

    if (!selectedRosterId && payload.rosters[0]) {
      setSelectedRosterId(payload.rosters[0].id);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedDate(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    const resetAdminVisit = async () => {
      try {
        const response = await fetch("/api/admin/visit", { method: "POST" });
        if (!response.ok) {
          setMessage("관리자 인증 상태를 초기화하지 못했습니다. 페이지를 새로고침해 주세요.");
        }
      } catch {
        setMessage("관리자 인증 상태를 초기화하지 못했습니다. 페이지를 새로고침해 주세요.");
      } finally {
        setIsAuthenticated(false);
        setRosters([]);
        setSelectedRosterId(null);
        setSummary(null);
        setIsCheckingSession(false);
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsAuthenticated(false);
        setIsCheckingSession(true);
        setRosters([]);
        setSelectedRosterId(null);
        setSummary(null);
        void resetAdminVisit();
      }
    };

    void resetAdminVisit();
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    if (!selectedRosterId || !selectedDate) {
      return;
    }

    const syncSummary = async () => {
      const response = await fetch(
        `/api/admin/attendance?rosterId=${encodeURIComponent(selectedRosterId)}&date=${encodeURIComponent(selectedDate)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        setSummary(null);
        return;
      }

      const payload = (await response.json()) as { summary: DailySummary };
      setSummary(payload.summary);
    };

    void syncSummary();
  }, [selectedDate, selectedRosterId]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCheckingSession) {
      return;
    }

    setBusy(true);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const payload = (await response.json()) as { ok: boolean; message?: string };
    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "로그인에 실패했습니다.");
      setBusy(false);
      return;
    }

    setMessage("관리자 인증이 완료되었습니다.");
    setIsAuthenticated(true);
    setPassword("");
    await loadRosters();
    setBusy(false);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setIsAuthenticated(false);
    setSelectedRosterId(null);
    setMessage("로그아웃되었습니다.");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, {
      defval: "",
      raw: false,
    });

    const normalizedHeaders = Object.keys(rows[0] ?? {}).map((key) => key.trim());
    const studentNumberKey = normalizedHeaders.find((key) => key.includes("학번"));
    const studentNameKey = normalizedHeaders.find((key) => key.includes("이름"));

    if (!studentNumberKey || !studentNameKey) {
      setPreviewRows([]);
      setValidationErrors(["엑셀 파일에는 '학번'과 '이름' 컬럼이 꼭 있어야 합니다."]);
      return;
    }

    const validRows: StudentRow[] = [];
    const errors: string[] = [];

    rows.forEach((row, index) => {
      const rawStudentNumber = String(row[studentNumberKey] ?? "").trim();
      const rawName = String(row[studentNameKey] ?? "").trim();

      if (!rawStudentNumber && !rawName) {
        return;
      }

      const normalizedNumber = rawStudentNumber.replace(/[^0-9]/g, "");
      if (!/^\d{5}$/.test(normalizedNumber)) {
        errors.push(`${index + 2}행: 학번은 5자리 숫자여야 합니다.`);
        return;
      }

      const name = rawName.replace(/\s+/g, " ");
      if (!name) {
        errors.push(`${index + 2}행: 이름을 확인해 주세요.`);
        return;
      }

      if (validRows.some((student) => student.studentNumber === normalizedNumber)) {
        errors.push(`${index + 2}행: 학번이 중복됩니다 (${normalizedNumber}).`);
        return;
      }

      validRows.push({ studentNumber: normalizedNumber, name });
    });

    setPreviewRows(validRows);
    setValidationErrors(errors);
  };

  const saveRoster = async () => {
    if (previewRows.length === 0) {
      setMessage("저장할 학생 명단이 없습니다.");
      return;
    }

    const fileInput = document.getElementById("excel-file") as HTMLInputElement | null;
    const rosterName = fileInput?.value
      ? fileInput.value.split("\\").at(-1)?.replace(/\.[^.]+$/, "") ?? "새 출결 항목"
      : "새 출결 항목";

    const response = await fetch("/api/admin/rosters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: rosterName, students: previewRows }),
    });

    const payload = (await response.json()) as { ok: boolean; message?: string; roster?: RosterEntry };
    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "저장에 실패했습니다.");
      return;
    }

    setMessage(`${payload.roster?.name ?? rosterName} 출결 항목이 저장되었습니다.`);
    setPreviewRows([]);
    if (fileInput) {
      fileInput.value = "";
    }
    await loadRosters();
  };

  const handleSelectRoster = async (rosterId: string) => {
    setSelectedRosterId(rosterId);
    const response = await fetch("/api/admin/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rosterId }),
    });

    if (!response.ok) {
      setMessage("출결 항목 선택에 실패했습니다.");
      return;
    }

    setMessage(`${rosters.find((roster) => roster.id === rosterId)?.name ?? "출결 항목"}이 키오스크에 적용되었습니다.`);
  };

  const exportSummary = async () => {
    if (!selectedRosterId) {
      return;
    }

    const response = await fetch(
      `/api/admin/attendance?rosterId=${encodeURIComponent(selectedRosterId)}&date=${encodeURIComponent(selectedDate)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      setMessage("다운로드할 출결 현황을 불러오지 못했습니다.");
      return;
    }

    const payload = (await response.json()) as { summary: DailySummary };
    const rows = [
      { 상태: "출석", 학번: "", 이름: "" },
      ...payload.summary.present.map((student) => ({ 상태: "출석", 학번: student.studentNumber, 이름: student.name })),
      { 상태: "결석", 학번: "", 이름: "" },
      ...payload.summary.absent.map((student) => ({ 상태: "결석", 학번: student.studentNumber, 이름: student.name })),
    ];

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "출결현황");
    XLSX.writeFile(workbook, `${payload.summary.rosterName}_${selectedDate}.xlsx`);
  };

  if (!isAuthenticated) {
    return (
      <main className="admin-auth-page flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="admin-auth-card w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.38em] text-cyan-300">Admin access</p>
          <h1 className="mt-3 text-3xl font-bold">관리자 인증</h1>
          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <label className="block text-sm text-slate-300">
              비밀번호
              <input
                type="password"
                value={password}
                disabled={isCheckingSession}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-lg text-white outline-none ring-0"
                placeholder="관리자 비밀번호"
              />
            </label>
            <button
              type="submit"
              disabled={busy || isCheckingSession}
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-lg font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-65"
            >
              {isCheckingSession ? "접속 확인 중..." : busy ? "로그인 중..." : "로그인"}
            </button>
          </form>
          {message ? <p className="mt-4 text-sm text-amber-300">{message}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="admin-dashboard min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-slate-700 bg-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">ATTEND KIOSK</p>
            <h1 className="mt-2 text-3xl font-bold">관리자 페이지</h1>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 font-semibold text-slate-100 hover:bg-slate-700"
          >
            로그아웃
          </button>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="admin-section-card rounded-3xl border border-slate-700 bg-slate-900 p-5">
            <h2 className="text-xl font-bold">1. 학생 명렬 업로드</h2>
            <div className="mt-4 rounded-2xl border border-dashed border-slate-600 bg-slate-950/60 p-4">
              <input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-bold file:text-slate-950"
              />
            </div>

            {previewRows.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-sm text-emerald-200">유효한 학생 수: {previewRows.length}명</p>
                <div className="mt-3 max-h-52 overflow-auto rounded-xl bg-slate-950 p-3 text-sm text-slate-200">
                  {previewRows.slice(0, 10).map((student) => (
                    <div key={`${student.studentNumber}-${student.name}`} className="flex justify-between gap-4 border-b border-slate-800 py-2">
                      <span>{student.studentNumber}</span>
                      <span>{student.name}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={saveRoster}
                  className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950 hover:bg-emerald-400"
                >
                  최종 저장
                </button>
              </div>
            ) : null}

            {validationErrors.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                {validationErrors.map((error) => (
                  <p key={error} className="py-1">{error}</p>
                ))}
              </div>
            ) : null}
          </div>

          <div className="admin-section-card rounded-3xl border border-slate-700 bg-slate-900 p-5">
            <h2 className="text-xl font-bold">2. 출결 항목 관리</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {rosters.map((roster) => (
                <button
                  key={roster.id}
                  type="button"
                  onClick={() => void handleSelectRoster(roster.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    selectedRosterId === roster.id
                      ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                      : "border-slate-700 bg-slate-950 text-slate-100 hover:border-slate-500"
                  }`}
                >
                  <div className="text-lg font-bold">{roster.name}</div>
                  <div className="mt-2 text-sm text-slate-400">학생 {roster.students.length}명</div>
                </button>
              ))}
            </div>

            {currentRosterName ? (
              <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Selected</p>
                <p className="mt-2 text-2xl font-bold text-cyan-300">{currentRosterName}</p>
                <p className="mt-2 text-sm text-slate-300">선택된 출결 항목은 브라우저 세션 동안 유지됩니다.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="admin-section-card rounded-3xl border border-slate-700 bg-slate-900 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-bold">3. 날짜별 출결 현황</h2>
              <p className="mt-1 text-sm text-slate-400">출석자와 결석자를 확인하고 엑셀로 내려받을 수 있습니다.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-300">
                날짜
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="mt-1 ml-2 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-white"
                />
              </label>
              <button
                type="button"
                onClick={exportSummary}
                className="rounded-xl border border-cyan-500 bg-cyan-500/10 px-4 py-3 font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                엑셀 다운로드
              </button>
            </div>
          </div>

          {summary ? (
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">출석률</p>
                <p className="mt-3 text-4xl font-black text-emerald-300">{summary.attendanceRate}%</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">출석자</p>
                <p className="mt-3 text-4xl font-black text-cyan-300">{summary.present.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">결석자</p>
                <p className="mt-3 text-4xl font-black text-red-300">{summary.absent.length}</p>
              </div>

              <div className="md:col-span-3 grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                  <h3 className="text-lg font-bold text-emerald-300">출석자 목록</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-200">
                    {summary.present.length > 0 ? (
                      summary.present.map((student) => (
                        <div key={`${student.studentNumber}-present`} className="flex justify-between gap-3 border-b border-slate-800 py-2">
                          <span>{student.studentNumber}</span>
                          <span>{student.name}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400">출석자가 없습니다.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                  <h3 className="text-lg font-bold text-red-300">결석자 목록</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-200">
                    {summary.absent.length > 0 ? (
                      summary.absent.map((student) => (
                        <div key={`${student.studentNumber}-absent`} className="flex justify-between gap-3 border-b border-slate-800 py-2">
                          <span>{student.studentNumber}</span>
                          <span>{student.name}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400">결석자가 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/60 p-6 text-slate-300">
              출결 항목을 선택한 뒤 날짜를 선택해 주세요.
            </div>
          )}
        </section>

        {message ? <p className="text-sm text-amber-300">{message}</p> : null}
      </div>
    </main>
  );
}
