-- Per-grade GPA/color metadata and pass/fail presentation colors.

alter table if exists public.courses
  add column if not exists pass_color varchar(7),
  add column if not exists fail_color varchar(7);

do $$
begin
  if to_regclass('public.courses') is not null then
    update public.courses
    set pass_color = coalesce(pass_color, '#888888'),
        fail_color = coalesce(fail_color, '#8a8a8a');
  end if;
end $$;

alter table if exists public.grade_scales
  add column if not exists color varchar(7) not null default '#888888';

do $$
begin
  if to_regclass('public.grade_scales') is not null then
    alter table public.grade_scales alter column letter type varchar(8);
    alter table public.grade_scales drop constraint if exists grade_scales_gpa_value_range;
    alter table public.grade_scales drop constraint if exists grade_scales_gpa_value_nonnegative;
    alter table public.grade_scales add constraint grade_scales_gpa_value_nonnegative
      check (gpa_value >= 0);

    update public.grade_scales
    set color = case letter
      when 'A+' then '#e8756a' when 'A' then '#d9645a' when 'A-' then '#c5534a'
      when 'B+' then '#e8a068' when 'B' then '#d98e58' when 'B-' then '#c57e4a'
      when 'C+' then '#d9c058' when 'C' then '#c8ae48' when 'C-' then '#b59a3a'
      when 'D+' then '#9898d0' when 'D' then '#8484be' when 'D-' then '#7070ac'
      when 'F' then '#8a8a8a' else color
    end;
  end if;
end $$;
