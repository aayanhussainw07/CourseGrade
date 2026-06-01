alter table semesters
add column if not exists ignored boolean not null default false;
