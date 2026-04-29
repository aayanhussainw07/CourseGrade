create table if not exists public.syllabus_rate_limits (
  user_id text not null,
  window_key text not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, window_key)
);

create or replace function public.consume_syllabus_import(
  p_user_id text,
  p_window_key text,
  p_limit integer
)
returns table(allowed boolean, request_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
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
        -- Another request created the row first. Loop and lock it.
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
