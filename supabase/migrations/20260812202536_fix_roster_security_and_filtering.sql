-- Keep the Cornell mirror server-only. The Next.js routes authenticate users
-- and query with the service role; browser roles do not need direct Data API
-- access to the raw tables, materialized view, or maintenance function.
alter table public.cornell_rosters enable row level security;
alter table public.cornell_rosters force row level security;
alter table public.cornell_subjects enable row level security;
alter table public.cornell_subjects force row level security;
alter table public.cornell_courses enable row level security;
alter table public.cornell_courses force row level security;

revoke all on table public.cornell_rosters from public, anon, authenticated;
revoke all on table public.cornell_subjects from public, anon, authenticated;
revoke all on table public.cornell_courses from public, anon, authenticated;
revoke all on table public.cornell_courses_grouped_mv from public, anon, authenticated;
revoke all on sequence public.cornell_courses_id_seq from public, anon, authenticated;

grant select, insert, update, delete on table public.cornell_rosters to service_role;
grant select, insert, update, delete on table public.cornell_subjects to service_role;
grant select, insert, update, delete on table public.cornell_courses to service_role;
grant select on table public.cornell_courses_grouped_mv to service_role;
grant usage, select on sequence public.cornell_courses_id_seq to service_role;

-- The maintenance RPC needs the view owner's privileges, but is callable only
-- by the server-side service role. An empty search_path prevents object shadowing.
create or replace function public.refresh_roster_grouped()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  refresh materialized view concurrently public.cornell_courses_grouped_mv;
end;
$$;

revoke all on function public.refresh_roster_grouped() from public, anon, authenticated;
grant execute on function public.refresh_roster_grouped() to service_role;

-- Filter both the course match and the returned offerings. Previously a Fall
-- filter could match a course and then return its Spring/Summer/Winter rows too.
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
set search_path = ''
as $$
  with params as (
    select lower(regexp_replace(coalesce(p_q, ''), '\s+', '', 'g')) as needle
  ),
  visible as (
    select
      m.code_norm,
      m.subject,
      m.catalog_nbr,
      m.title_long,
      m.credits_min,
      m.credits_max,
      m.level_bucket,
      m.term_types,
      case
        when p_terms is null or array_length(p_terms, 1) is null then m.terms
        else coalesce(
          (
            select jsonb_agg(offering.value order by offering.ordinality)
            from jsonb_array_elements(m.terms) with ordinality as offering(value, ordinality)
            where offering.value ->> 'term' = any (p_terms)
          ),
          '[]'::jsonb
        )
      end as terms
    from public.cornell_courses_grouped_mv m
  ),
  filtered as (
    select
      v.code_norm,
      v.subject,
      v.catalog_nbr,
      v.title_long,
      v.credits_min,
      v.credits_max,
      jsonb_array_length(v.terms)::bigint as offered_count,
      v.terms,
      p.needle
    from visible v
    cross join params p
    where (p_terms is null or array_length(p_terms, 1) is null or v.term_types && p_terms)
      and (p_subjects is null or array_length(p_subjects, 1) is null or v.subject = any (p_subjects))
      and (p_levels is null or array_length(p_levels, 1) is null or v.level_bucket = any (p_levels))
      and (
        p.needle = ''
        or v.code_norm ilike '%' || p.needle || '%'
        or v.title_long ilike '%' || coalesce(p_q, '') || '%'
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
  limit greatest(1, least(coalesce(p_limit, 40), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.roster_courses_grouped(text[], text[], text, int[], int, int)
  from public, anon, authenticated;
grant execute on function public.roster_courses_grouped(text[], text[], text, int[], int, int)
  to service_role;

-- The syllabus quota is also a server-only control. Its original migration
-- left both the table and a privileged function on PostgreSQL's PUBLIC grants.
alter table public.syllabus_rate_limits enable row level security;
alter table public.syllabus_rate_limits force row level security;

revoke all on table public.syllabus_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.syllabus_rate_limits to service_role;

create or replace function public.consume_syllabus_import(
  p_user_id text,
  p_window_key text,
  p_limit integer
)
returns table(allowed boolean, request_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_count integer;
begin
  if p_user_id is null or length(p_user_id) = 0 or length(p_user_id) > 255 then
    raise exception 'invalid user id' using errcode = '22023';
  end if;
  if p_window_key is null or length(p_window_key) = 0 or length(p_window_key) > 64 then
    raise exception 'invalid window key' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;

  delete from public.syllabus_rate_limits
  where user_id = p_user_id
    and updated_at < now() - interval '1 hour';

  loop
    select s.request_count
    into current_count
    from public.syllabus_rate_limits s
    where s.user_id = p_user_id
      and s.window_key = p_window_key
    for update;

    if not found then
      begin
        insert into public.syllabus_rate_limits (
          user_id,
          window_key,
          request_count,
          updated_at
        )
        values (p_user_id, p_window_key, 1, now());

        allowed := true;
        request_count := 1;
        return next;
        return;
      exception when unique_violation then
        -- Another request inserted the row; loop and lock it.
      end;
    elsif current_count >= p_limit then
      allowed := false;
      request_count := current_count;
      return next;
      return;
    else
      update public.syllabus_rate_limits
      set request_count = current_count + 1,
          updated_at = now()
      where user_id = p_user_id
        and window_key = p_window_key;

      allowed := true;
      request_count := current_count + 1;
      return next;
      return;
    end if;
  end loop;
end;
$$;

revoke all on function public.consume_syllabus_import(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.consume_syllabus_import(text, text, integer)
  to service_role;
