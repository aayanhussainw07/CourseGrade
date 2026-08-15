-- Roster search that merges the same course across terms into one row.
-- Groups cornell_courses by code_norm and returns a terms[] array (newest
-- first) so the UI can show one card per course with a term picker inside.
-- total_count is a window count of distinct courses for pagination.

create or replace function public.roster_courses_grouped(
  p_rosters text[] default null,
  p_subjects text[] default null,
  p_q text default null,
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
  with filtered as (
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
    where (p_rosters is null or array_length(p_rosters, 1) is null or c.roster = any (p_rosters))
      and (p_subjects is null or array_length(p_subjects, 1) is null or c.subject = any (p_subjects))
      and (
        p_q is null or p_q = ''
        or c.code_norm ilike '%' || lower(regexp_replace(p_q, '\s+', '', 'g')) || '%'
        or c.title_long ilike '%' || p_q || '%'
      )
  ),
  grouped as (
    select
      f.code_norm,
      min(f.subject)      as subject,
      min(f.catalog_nbr)  as catalog_nbr,
      (array_agg(f.title_long order by f.roster_year desc, f.term_rank desc))[1] as title_long,
      min(f.credits_min)  as credits_min,
      max(f.credits_max)  as credits_max,
      count(*)            as offered_count,
      jsonb_agg(
        jsonb_build_object(
          'roster',       f.roster,
          'roster_descr', f.roster_descr,
          'year',         f.roster_year,
          'term',         f.roster_term,
          'title_long',   f.title_long,
          'credits_min',  f.credits_min,
          'credits_max',  f.credits_max,
          'instructors',  f.instructors,
          'description',  f.description,
          'prereqs',      f.prereqs,
          'distr_reqs',   f.distr_reqs
        )
        order by f.roster_year desc, f.term_rank desc
      ) as terms
    from filtered f
    group by f.code_norm
  ),
  counted as (
    select g.*, count(*) over () as total_count
    from grouped g
  )
  select
    code_norm, subject, catalog_nbr, title_long, credits_min, credits_max,
    offered_count, terms, total_count
  from counted
  order by subject, catalog_nbr
  limit p_limit offset p_offset;
$$;
