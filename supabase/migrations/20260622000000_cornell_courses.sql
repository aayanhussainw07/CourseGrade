-- Cornell Class Roster mirror: metadata backbone for course autofill + code validation.
-- Source: classes.cornell.edu/api/2.0/ (official, <=1 req/sec). Weights are NOT here.

create table if not exists public.cornell_rosters (
  code text primary key,            -- 'FA25' (API "slug")
  descr text,                       -- 'Fall 2025'
  year integer not null,
  term text not null,               -- 'FA' | 'SP' | 'SU' | 'WI'
  is_active boolean not null default false,
  fetched_at timestamptz not null default now()
);

create table if not exists public.cornell_subjects (
  roster text not null references public.cornell_rosters(code) on delete cascade,
  code text not null,               -- 'CS'
  descr text,
  primary key (roster, code)
);

create table if not exists public.cornell_courses (
  id bigint generated always as identity primary key,
  roster text not null references public.cornell_rosters(code) on delete cascade,
  subject text not null,            -- 'CS'
  catalog_nbr text not null,        -- '2110'
  code_norm text not null,          -- 'cs2110' (lowercased, no space) for fast match
  title_long text,
  title_short text,
  description text,
  credits_min numeric,
  credits_max numeric,
  grading_basis text,
  prereqs text,
  distr_reqs text,
  acad_career text,
  instructors text[] not null default '{}',   -- dedup'd 'First Last' for the term
  fetched_at timestamptz not null default now(),
  unique (roster, subject, catalog_nbr)
);

create index if not exists cornell_courses_code_norm_idx on public.cornell_courses (code_norm);
create index if not exists cornell_courses_subject_nbr_idx on public.cornell_courses (subject, catalog_nbr);
