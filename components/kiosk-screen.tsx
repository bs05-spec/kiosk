"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Student = {
  studentNumber: string;
  name: string;
};

type Roster = {
  id: string;
  name: string;
  students: Student[];
};

const keypad = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["C", "0", "✓"]];

export function KioskScreen() {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("학번을 입력해 주세요.");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">(
    "neutral",
  );
  const [completionMessage, setCompletionMessage] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  const loadCurrentRoster = async () => {
    const response = await fetch("/api/kiosk/current", { cache: "no-store" });
    if (!response.ok) {
      setRoster(null);
      setMessage("관리자가 먼저 출결 항목을 선택해 주세요.");
      setMessageTone("neutral");
      return;
    }

    const payload = (await response.json()) as { roster: Roster | null };
    setRoster(payload.roster);
    if (payload.roster) {
      setMessage(`${payload.roster.name} 출결 항목이 선택됨`);
      setMessageTone("neutral");
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCurrentRoster();
  }, []);

  const formattedTime = useMemo(
    () =>
      now
        ? new Intl.DateTimeFormat("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(now)
        : "로딩 중...",
    [now],
  );

  const handleKeyPress = (value: string) => {
    if (completionMessage) {
      return;
    }

    if (value === "C") {
      setInput("");
      setMessage("학번을 다시 입력해 주세요.");
      setMessageTone("neutral");
      return;
    }

    if (value === "✓") {
      void submitAttendance();
      return;
    }

    if (input.length >= 5) {
      return;
    }

    setInput((prev) => prev + value);
  };

  const submitAttendance = async () => {
    if (completionMessage) {
      return;
    }

    if (!roster) {
      setMessage("관리자가 먼저 출결 항목을 선택해 주세요.");
      setMessageTone("error");
      return;
    }

    if (input.length !== 5) {
      setMessage("5자리 학번을 입력해 주세요.");
      setMessageTone("error");
      return;
    }

    const response = await fetch("/api/kiosk/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentNumber: input }),
    });

    const payload = (await response.json()) as {
      ok: boolean;
      message: string;
      studentNumber?: string;
      studentName?: string;
    };

    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "출석 등록에 실패했습니다.");
      setMessageTone("error");
      return;
    }

    setCompletionMessage(
      `${payload.studentName ?? "학생"}(${payload.studentNumber}) 출결이 완료되었습니다.`,
    );
    setMessageTone("neutral");
  };

  return (
    <main className="kiosk-page flex min-h-screen flex-col bg-slate-950 px-5 py-8 text-white md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        <header className="kiosk-header flex items-center justify-between gap-6">
          <div>
            <p className="kiosk-brand text-xs uppercase tracking-[0.3em] text-cyan-300">ATTEND KIOSK</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">학생 출석 등록</h1>
            <p className="mt-3 text-sm text-slate-600 md:text-base">
              5자리 학번을 입력합니다. (예: 1학년 3반 1번이라면 10301 입력)
            </p>
          </div>
          <div className="kiosk-clock text-right">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">현재 시간</div>
            <div className="mt-2 text-base font-semibold tabular-nums md:text-lg">{formattedTime}</div>
          </div>
        </header>

        <section className="w-full">
          <div className="kiosk-entry mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl md:p-10">
            <div className="kiosk-roster mb-8 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">출결 항목</p>
                <p className="mt-1 text-lg font-semibold text-emerald-100 md:text-xl">
                  {roster?.name ?? "출결 항목 없음"}
                </p>
              </div>
            </div>

            <div className="kiosk-number-panel rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-1 text-center md:py-2">
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-400">학생 번호</p>
              <div className="flex flex-nowrap justify-center gap-2 whitespace-nowrap text-6xl font-semibold tabular-nums tracking-tight text-white md:gap-5 md:text-7xl">
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index} className="w-[1ch] text-center">
                    {input[index] ?? "−"}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 md:gap-4">
              {keypad.flat().map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleKeyPress(value)}
                  data-action={value === "✓" ? "confirm" : value === "C" ? "clear" : "digit"}
                  className="kiosk-key flex h-16 items-center justify-center rounded-2xl text-5xl font-semibold md:h-20 md:text-6xl"
                >
                  {value === "C" ? (
                    <span className="text-xl tracking-tight md:text-[2rem]">지우기</span>
                  ) : (
                    value
                  )}
                </button>
              ))}
            </div>
            {messageTone !== "neutral" ? (
              <p
                aria-live="polite"
                data-tone={messageTone}
                className={`kiosk-feedback mt-4 rounded-xl px-4 py-3 text-center font-semibold ${
                  messageTone === "success" ? "text-[2rem]" : "text-base"
                }`}
              >
                {message}
              </p>
            ) : null}
          </div>
        </section>
      </div>
      {completionMessage ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="attendance-complete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4"
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-2xl">
            <h2 id="attendance-complete-title" className="text-xl font-semibold text-slate-500">
              출결 완료
            </h2>
            <p className="mt-4 text-[2rem] font-bold text-emerald-700">
              {completionMessage}
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => {
                setCompletionMessage("");
                setInput("");
                setMessage("학번을 입력해 주세요.");
                setMessageTone("neutral");
              }}
              className="mt-8 w-full rounded-2xl bg-cyan-500 px-6 py-4 text-xl font-bold text-white hover:bg-cyan-400"
            >
              확인
            </button>
          </div>
        </div>
      ) : null}
      <footer className="mt-auto pt-10 text-center">
        <Link
          href="/admin"
          className="kiosk-admin-link text-xs font-medium tracking-[0.18em] transition-colors"
        >
          ADMIN
        </Link>
      </footer>
    </main>
  );
}
