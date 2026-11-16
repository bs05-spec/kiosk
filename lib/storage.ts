import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase";

export type StudentRow = {
  studentNumber: string;
  name: string;
};

export type RosterRecord = {
  id: string;
  name: string;
  students: StudentRow[];
  createdAt: string;
  updatedAt: string;
};

export type AttendanceRecord = {
  id: string;
  rosterId: string;
  studentNumber: string;
  date: string;
  status: "present" | "absent";
  timestamp: string;
};

type DatabaseStudent = {
  student_number: string;
  name: string;
};

type DatabaseRoster = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  students: DatabaseStudent[] | null;
};

type DatabaseAttendance = {
  id: string;
  roster_id: string;
  student_number: string;
  attendance_date: string;
  status: "present" | "absent";
  marked_at: string;
};

function getDatabase() {
  const database = getSupabaseServerClient();
  if (!database) {
    throw new Error("Supabase server configuration is missing.");
  }

  return database;
}

function throwDatabaseError(operation: string, message: string): never {
  throw new Error(`Supabase ${operation} failed: ${message}`);
}

function toRoster(row: DatabaseRoster): RosterRecord {
  return {
    id: row.id,
    name: row.name,
    students: (row.students ?? []).map((student) => ({
      studentNumber: student.student_number,
      name: student.name,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAttendance(row: DatabaseAttendance): AttendanceRecord {
  return {
    id: row.id,
    rosterId: row.roster_id,
    studentNumber: row.student_number,
    date: row.attendance_date,
    status: row.status,
    timestamp: row.marked_at,
  };
}

const rosterSelection =
  "id,name,created_at,updated_at,students(student_number,name)";

export async function listRosters(): Promise<RosterRecord[]> {
  const { data, error } = await getDatabase()
    .from("rosters")
    .select(rosterSelection)
    .order("created_at", { ascending: true });

  if (error) {
    throwDatabaseError("roster list", error.message);
  }

  return ((data ?? []) as DatabaseRoster[]).map(toRoster);
}

export async function getRosterById(rosterId: string): Promise<RosterRecord | null> {
  const { data, error } = await getDatabase()
    .from("rosters")
    .select(rosterSelection)
    .eq("id", rosterId)
    .maybeSingle();

  if (error) {
    throwDatabaseError("roster lookup", error.message);
  }

  return data ? toRoster(data as DatabaseRoster) : null;
}

export async function getDailySummary(rosterId: string, date: string) {
  const roster = await getRosterById(rosterId);
  if (!roster) {
    return null;
  }

  const { data, error } = await getDatabase()
    .from("attendance_records")
    .select("student_number")
    .eq("roster_id", rosterId)
    .eq("attendance_date", date)
    .eq("status", "present");

  if (error) {
    throwDatabaseError("attendance summary", error.message);
  }

  const presentNumbers = new Set(
    ((data ?? []) as Array<{ student_number: string }>).map(
      (record) => record.student_number,
    ),
  );
  const present = roster.students.filter((student) =>
    presentNumbers.has(student.studentNumber),
  );
  const absent = roster.students.filter(
    (student) => !presentNumbers.has(student.studentNumber),
  );

  return {
    rosterName: roster.name,
    present,
    absent,
    attendanceRate:
      roster.students.length === 0
        ? 0
        : Number(((present.length / roster.students.length) * 100).toFixed(1)),
  };
}

export async function markAttendanceForStudent(
  rosterId: string,
  studentNumber: string,
  date: string,
) {
  const database = getDatabase();
  const { data, error } = await database
    .from("attendance_records")
    .insert({
      roster_id: rosterId,
      student_number: studentNumber,
      attendance_date: date,
      status: "present",
    })
    .select("id,roster_id,student_number,attendance_date,status,marked_at")
    .single();

  if (error?.code === "23505") {
    const { data: existing, error: lookupError } = await database
      .from("attendance_records")
      .select("id,roster_id,student_number,attendance_date,status,marked_at")
      .eq("roster_id", rosterId)
      .eq("student_number", studentNumber)
      .eq("attendance_date", date)
      .single();

    if (lookupError) {
      throwDatabaseError("existing attendance lookup", lookupError.message);
    }

    return {
      status: "already_present" as const,
      record: toAttendance(existing as DatabaseAttendance),
    };
  }

  if (error) {
    throwDatabaseError("attendance registration", error.message);
  }

  return {
    status: "present" as const,
    record: toAttendance(data as DatabaseAttendance),
  };
}

export async function upsertRosterByName(
  name: string,
  students: StudentRow[],
): Promise<RosterRecord> {
  const { data, error } = await getDatabase().rpc("upsert_roster_with_students", {
    p_name: name,
    p_students: students.map((student) => ({
      student_number: student.studentNumber,
      name: student.name,
    })),
  });

  if (error) {
    throwDatabaseError("roster upload", error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | Pick<DatabaseRoster, "id">
    | null;
  if (!row?.id) {
    throwDatabaseError("roster upload", "The database returned no roster.");
  }

  const roster = await getRosterById(row.id);
  if (!roster) {
    throwDatabaseError("roster lookup after upload", "The saved roster was not found.");
  }

  return roster;
}
