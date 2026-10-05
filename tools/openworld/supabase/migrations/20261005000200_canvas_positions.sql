-- Existing 50×50 drawings stay valid. Empty scenery positions retain the
-- original placement until their owner saves or moves the scenery.
begin;

create or replace function public.valid_pixel_canvas(p jsonb, minimum integer)
returns boolean language sql immutable set search_path = '' as $$
 select case when jsonb_typeof(p) <> 'array' then false
 when jsonb_array_length(p) not in (2500,10000,22500,40000) then false
 else (select count(*) filter(where v <> 'null'::jsonb) >= minimum
 and bool_and(v = 'null'::jsonb or (jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^#[0-9a-fA-F]{6}$')) from jsonb_array_elements(p) as t(v)) end
$$;

alter table public.residents
 add column if not exists scenery_x double precision check (scenery_x between 5 and 95),
 add column if not exists scenery_y double precision check (scenery_y between 10 and 90);

commit;
