-- Run this in the Supabase SQL editor for your project.

create table if not exists players (
  id bigint generated always as identity primary key,
  socket_id text,
  name text,
  browser text,
  os text,
  device_type text,
  screen_w integer,
  screen_h integer,
  language text,
  timezone text,
  ip text,
  page_load_at bigint,
  joined_at bigint,
  join_order integer,
  time_on_join_screen_ms integer,
  useragent_raw text,
  created_at timestamptz default now()
);

create table if not exists answers (
  id bigint generated always as identity primary key,
  player_id bigint references players(id),
  question_id integer,
  answer_index integer,
  correct boolean,
  answer_time_ms integer,
  submitted_at bigint,
  created_at timestamptz default now()
);

-- Optional: allow service role full access (default). Keep RLS off for service-role inserts,
-- or add policies if you enable RLS. Do NOT expose the service role key to browsers.
