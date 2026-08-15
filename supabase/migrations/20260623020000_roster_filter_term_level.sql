-- Sidebar filters: filter by semester TYPE (Fall/Spring/Summer/Winter) instead
-- of a specific roster code, and by course LEVEL (1000..5000+). Ranking from the
-- previous migration is preserved.
--
-- p_terms : term codes 'FA' | 'SP' | 'SU' | 'WI'
-- p_levels: bucket starts 1000,2000,3000,4000,5000 — where 5000 means "5000+".

drop function if exists public.roster_courses_grouped(text[], text[], text, int, int);

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
      end as term_rank,
      lower(regexp_replace(coalesce(p_q, ''), '\s+', '', 'g')) as needle
    from public.cornell_courses c
    join public.cornell_rosters r on r.code = c.roster
    where (p_terms is null or array_length(p_terms, 1) is null or r.term = any (p_terms))
      and (p_subjects is null or array_length(p_subjects, 1) is null or c.subject = any (p_subjects))
      and (
        p_levels is null or array_length(p_levels, 1) is null
        or (
          case
            when nullif(regexp_replace(c.catalog_nbr, '\D', '', 'g'), '')::int >= 5000 then 5000
            else (nullif(regexp_replace(c.catalog_nbr, '\D', '', 'g'), '')::int / 1000) * 1000
          end = any (p_levels)
        )
      )
      and (
        coalesce(p_q, '') = ''
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
      min(f.needle)       as needle,
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
  ranked as (
    select
      g.*,
      case
        when g.needle = '' then 0
        when g.code_norm = g.needle then 0
        when g.code_norm like g.needle || '%' then 1
        when g.code_norm like '%' || g.needle || '%' then 2
        else 3
      end as match_rank,
      count(*) over () as total_count
    from grouped g
  )
  select
    code_norm, subject, catalog_nbr, title_long, credits_min, credits_max,
    offered_count, terms, total_count
  from ranked
  order by match_rank, subject, catalog_nbr
  limit p_limit offset p_offset;
$$;
