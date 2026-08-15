-- Perf: the grouped roster search was re-aggregating the whole cornell_courses
-- table (one row per course-per-term) on every request just to return one page
-- plus a window count. Precompute the per-course grouping into a materialized
-- view so each request is a cheap filter + limit + count over a small table.

create materialized view if not exists public.cornell_courses_grouped_mv as
with base as (
  select
    c.code_norm,
    c.subject,
    c.catalog_nbr,
    c.title_long,
    c.credits_min,
    c.credits_max,
    c.instructors,
    c.description,
    c.prereqs,
    c.distr_reqs,
    c.roster,
    r.descr as roster_descr,
    r.year  as roster_year,
    r.term  as roster_term,
    case r.term
      when 'WI' then 1 when 'SP' then 2 when 'SU' then 3 when 'FA' then 4
      else 0
    end as term_rank
  from public.cornell_courses c
  join public.cornell_rosters r on r.code = c.roster
)
select
  b.code_norm,
  min(b.subject)     as subject,
  min(b.catalog_nbr) as catalog_nbr,
  case
    when nullif(regexp_replace(min(b.catalog_nbr), '\D', '', 'g'), '')::int >= 5000 then 5000
    else (nullif(regexp_replace(min(b.catalog_nbr), '\D', '', 'g'), '')::int / 1000) * 1000
  end as level_bucket,
  array_agg(distinct b.roster_term) as term_types,
  (array_agg(b.title_long order by b.roster_year desc, b.term_rank desc))[1] as title_long,
  min(b.credits_min) as credits_min,
  max(b.credits_max) as credits_max,
  count(*)           as offered_count,
  jsonb_agg(
    jsonb_build_object(
      'roster',       b.roster,
      'roster_descr', b.roster_descr,
      'year',         b.roster_year,
      'term',         b.roster_term,
      'title_long',   b.title_long,
      'credits_min',  b.credits_min,
      'credits_max',  b.credits_max,
      'instructors',  b.instructors,
      'description',  b.description,
      'prereqs',      b.prereqs,
      'distr_reqs',   b.distr_reqs
    )
    order by b.roster_year desc, b.term_rank desc
  ) as terms
from base b
group by b.code_norm;

-- Unique index → enables REFRESH ... CONCURRENTLY and dedups.
create unique index if not exists cornell_grouped_code_norm_idx
  on public.cornell_courses_grouped_mv (code_norm);
create index if not exists cornell_grouped_subject_nbr_idx
  on public.cornell_courses_grouped_mv (subject, catalog_nbr);
create index if not exists cornell_grouped_level_idx
  on public.cornell_courses_grouped_mv (level_bucket);
create index if not exists cornell_grouped_terms_idx
  on public.cornell_courses_grouped_mv using gin (term_types);

-- Refresh helper — call after a roster backfill to rebuild the view.
create or replace function public.refresh_roster_grouped()
returns void
language plpgsql
as $$
begin
  refresh materialized view concurrently public.cornell_courses_grouped_mv;
end;
$$;

-- Point the search RPC at the materialized view.
create or replace function public.roster_courses_grouped(
  p_terms text[] default null,
  p_subjects text[] default null,
  p_q text default null,
  p_levels int[] default null,
  p_limit int default 40,
  p_offset int default 0
)
returns table (
  code_norm text,
  subject text,
  catalog_nbr text,
  title_long text,
  credits_min numeric,
  credits_max numeric,
  offered_count bigint,
  terms jsonb,
  total_count bigint
)
language sql
stable
as $$
  with params as (
    select lower(regexp_replace(coalesce(p_q, ''), '\s+', '', 'g')) as needle
  ),
  filtered as (
    select
      m.code_norm,
      m.subject,
      m.catalog_nbr,
      m.title_long,
      m.credits_min,
      m.credits_max,
      m.offered_count,
      m.terms,
      p.needle
    from public.cornell_courses_grouped_mv m
    cross join params p
    where (p_terms is null or array_length(p_terms, 1) is null or m.term_types && p_terms)
      and (p_subjects is null or array_length(p_subjects, 1) is null or m.subject = any (p_subjects))
      and (p_levels is null or array_length(p_levels, 1) is null or m.level_bucket = any (p_levels))
      and (
        p.needle = ''
        or m.code_norm ilike '%' || p.needle || '%'
        or m.title_long ilike '%' || coalesce(p_q, '') || '%'
      )
  ),
  ranked as (
    select
      f.*,
      case
        when f.needle = '' then 0
        when f.code_norm = f.needle then 0
        when f.code_norm like f.needle || '%' then 1
        when f.code_norm like '%' || f.needle || '%' then 2
        else 3
      end as match_rank,
      count(*) over () as total_count
    from filtered f
  )
  select
    code_norm, subject, catalog_nbr, title_long, credits_min, credits_max,
    offered_count, terms, total_count
  from ranked
  order by match_rank, subject, catalog_nbr
  limit p_limit offset p_offset;
$$;
