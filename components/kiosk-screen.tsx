"use client";

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

    setMessage(
      `${payload.studentName ?? "학생"}(${payload.studentNumber}) 출석 완료`,
    );
    setMessageTone("success");
    setInput("");

    window.setTimeout(() => {
      setMessage(`${roster.name} 출결 항목 준비 중`);
      setMessageTone("neutral");
    }, 2200);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">ATTEND KIOSK</p>
            <h1 className="mt-2 text-3xl font-bold">학생 출석 등록</h1>
            <p className="mt-2 text-sm text-slate-600 md:text-base">
              5자리 학번을 입력합니다. (예: 1학년 3반 1번이라면 10301 입력)
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-5 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">Current Date</div>
            <div className="mt-1 text-lg font-semibold">{formattedTime}</div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Selected item</p>
                <p className="mt-1 text-2xl font-bold text-emerald-100">
                  {roster?.name ?? "출결 항목 없음"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-6 py-6 text-center">
              <p className="mb-3 text-sm uppercase tracking-[0.35em] text-slate-400">Student No.</p>
              <div className="flex flex-nowrap justify-center gap-2 whitespace-nowrap text-6xl font-black text-white md:gap-4 md:text-7xl">
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index} className="w-[1ch] text-center">
                    {input[index] ?? "−"}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {keypad.flat().map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleKeyPress(value)}
                  className={`flex h-20 items-center justify-center rounded-2xl text-3xl font-bold transition-all ${
                    value === "✓"
                      ? "bg-emerald-500 text-white hover:bg-emerald-400"
                      : value === "C"
                        ? "bg-slate-700 text-white hover:bg-slate-600"
                        : "bg-slate-800 text-white hover:bg-slate-700"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.35em] text-violet-200">Status</p>
            <div
              className={`mt-4 rounded-2xl border px-5 py-6 text-2xl font-bold ${
                messageTone === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : messageTone === "error"
                    ? "border-red-500/40 bg-red-500/10 text-red-200"
                    : "border-slate-700 bg-slate-800/60 text-slate-100"
              }`}
            >
              {message}
            </div>

          </aside>
        </section>
      </div>
    </main>
  );
}
