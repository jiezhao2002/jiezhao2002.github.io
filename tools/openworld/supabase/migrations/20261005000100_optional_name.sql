-- For projects that have already run the original schema.
alter table public.residents drop constraint residents_name_check;
alter table public.residents add constraint residents_name_check check (length(btrim(name)) between 0 and 30);
