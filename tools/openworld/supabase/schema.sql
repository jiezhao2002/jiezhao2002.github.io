-- Run once in Supabase SQL editor. Pixel arrays are the canonical image data:
-- 50×50, 100×100, 150×150 or 200×200 entries; null is transparent.
create or replace function public.valid_pixel_canvas(p jsonb, minimum integer)
returns boolean language sql immutable set search_path = '' as $$
 select case when jsonb_typeof(p) <> 'array' then false
 when jsonb_array_length(p) not in (2500,10000,22500,40000) then false
 else (select count(*) filter(where v <> 'null'::jsonb) >= minimum
 and bool_and(v = 'null'::jsonb or (jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^#[0-9a-fA-F]{6}$')) from jsonb_array_elements(p) as t(v)) end
$$;
create or replace function public.valid_dialogues(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
 select case when jsonb_typeof(p) <> 'array' then false
 when jsonb_array_length(p) not between 1 and 15 then false
 else (select bool_and(coalesce(jsonb_typeof(v)='object'
 and jsonb_typeof(v->'text')='string' and length(btrim(v->>'text')) between 1 and 500
 and jsonb_typeof(v->'soundcloud')='string'
 and ((v->>'soundcloud')='' or (v->>'soundcloud') ~ '^https://(www\.)?soundcloud\.com/[^/?#[:space:]]+/[^/?#[:space:]]+([?#][^[:space:]]*)?$'),false))
 from jsonb_array_elements(p) as t(v)) end
$$;
create table public.residents (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (length(btrim(name)) between 0 and 30),
 avatar jsonb not null check (public.valid_pixel_canvas(avatar,10)),
 scenery jsonb not null check (public.valid_pixel_canvas(scenery,10) or (public.valid_pixel_canvas(scenery,0) and not jsonb_path_exists(scenery,'$[*] ? (@ != null)'))),
 messages jsonb not null check (public.valid_dialogues(messages)),
 x double precision not null check (x between 5 and 95),
 y double precision not null check (y between 10 and 90),
 scenery_x double precision check (scenery_x between 5 and 95),
 scenery_y double precision check (scenery_y between 10 and 90),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.residents enable row level security;
create policy "Anyone can meet residents" on public.residents for select to anon, authenticated using (true);
create policy "Users create only themselves" on public.residents for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users edit only themselves" on public.residents for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.residents from anon, authenticated;
grant select on public.residents to anon;
grant select, insert, update on public.residents to authenticated;
create or replace function public.touch_resident() returns trigger language plpgsql set search_path = '' as $$
begin new.created_at := old.created_at; new.updated_at := now(); return new; end $$;
create trigger resident_updated before update on public.residents for each row execute function public.touch_resident();
-- Realtime: Supabase projects normally already have this publication.
alter publication supabase_realtime add table public.residents;
