-- Align the existing courses table with the application contract.
-- Every addition is idempotent, so this is safe for populated environments.

alter table public.courses
  add column if not exists title text,
  add column if not exists description text default '',
  add column if not exists thumbnail_url text,
  add column if not exists category_id text,
  add column if not exists category_name text,
  add column if not exists level text default 'all',
  add column if not exists instructor text,
  add column if not exists status text default 'draft',
  add column if not exists youtube_playlist_url text,
  add column if not exists youtube_url text,
  add column if not exists youtube_playlist_id text,
  add column if not exists external_url text,
  add column if not exists duration text,
  add column if not exists total_lessons integer default 0,
  add column if not exists created_by text,
  add column if not exists created_by_name text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists raw_data jsonb default '{}'::jsonb;

create index if not exists courses_status_idx on public.courses (status);
create index if not exists courses_category_id_idx on public.courses (category_id);
create index if not exists courses_created_by_idx on public.courses (created_by);
