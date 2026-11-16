-- Attendance kiosk schema.
-- Server-side access uses the Supabase secret key; no public RLS policies are
-- created, so the publishable key cannot read or modify attendance data.

create table if not exists public.rosters (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.rosters(id) on delete cascade,
  student_number text not null
    check (student_number ~ '^[0-9]{5}$'),
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (roster_id, student_number)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.rosters(id) on delete cascade,
  student_number text not null,
  attendance_date date not null default current_date,
  status text not null default 'present'
    check (status in ('present', 'absent')),
  marked_at timestamptz not null default now(),
  constraint attendance_records_once_per_day
    unique (roster_id, student_number, attendance_date)
);

alter table public.attendance_records
  drop constraint if exists attendance_records_student_fk;

alter table public.attendance_records
  drop constraint if exists attendance_records_roster_fk;

alter table public.attendance_records
  add constraint attendance_records_roster_fk
  foreign key (roster_id) references public.rosters(id) on delete cascade;

create index if not exists attendance_records_roster_date_idx
  on public.attendance_records (roster_id, attendance_date);

create or replace function public.update_roster_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists rosters_updated_at on public.rosters;
create trigger rosters_updated_at
before update on public.rosters
for each row
execute function public.update_roster_updated_at();

create or replace function public.upsert_roster_with_students(
  p_name text,
  p_students jsonb
)
returns public.rosters
language plpgsql
set search_path = ''
as $$
declare
  saved_roster public.rosters;
begin
  if pg_catalog.length(pg_catalog.btrim(p_name)) = 0 then
    raise exception 'Roster name is required';
  end if;

  if pg_catalog.jsonb_typeof(p_students) is distinct from 'array' then
    raise exception 'Students must be a JSON array';
  end if;

  insert into public.rosters (name)
  values (pg_catalog.btrim(p_name))
  on conflict (name)
  do update set updated_at = pg_catalog.now()
  returning * into saved_roster;

  delete from public.students
  where roster_id = saved_roster.id;

  insert into public.students (roster_id, student_number, name)
  select saved_roster.id, student.student_number, student.name
  from pg_catalog.jsonb_to_recordset(p_students)
    as student(student_number text, name text);

  return saved_roster;
end;
$$;

revoke all on function public.upsert_roster_with_students(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_roster_with_students(text, jsonb)
  to service_role;

alter table public.rosters enable row level security;
alter table public.students enable row level security;
alter table public.attendance_records enable row level security;

notify pgrst, 'reload schema';
