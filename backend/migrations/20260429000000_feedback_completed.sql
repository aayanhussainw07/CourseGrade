alter table feedback
add column if not exists completed boolean not null default false;
