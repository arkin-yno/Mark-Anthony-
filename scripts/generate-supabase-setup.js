import {writeFile} from 'node:fs/promises';
import {defaultContent} from '../content.js';
const seed=JSON.stringify(defaultContent).replaceAll("'","''");
const sql=`-- Run this whole file in Supabase > SQL Editor > New query.
-- FIRST create your user in Authentication > Users > Add user > Create new user.
-- Replace YOUR_OWNER_EMAIL_HERE below with that exact email address.
-- No passwords or API secret keys belong in this script.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.portfolio_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null references auth.users(id)
);
revoke all on private.portfolio_owner from public, anon, authenticated;
do $owner$
declare
  owner_email text := 'YOUR_OWNER_EMAIL_HERE';
  owner_id uuid;
  existing_id uuid;
begin
  if owner_email = 'YOUR_OWNER_EMAIL_HERE' then
    raise exception 'Replace YOUR_OWNER_EMAIL_HERE with the email of the user you created in Authentication > Users.';
  end if;
  select id into owner_id from auth.users where lower(email) = lower(owner_email);
  if owner_id is null then
    raise exception 'Owner user not found. First create this email in Authentication > Users.';
  end if;
  select user_id into existing_id from private.portfolio_owner where singleton = true;
  if existing_id is not null and existing_id <> owner_id then
    raise exception 'This website already has a different owner. Setup will not replace them.';
  end if;
  insert into private.portfolio_owner(singleton,user_id) values (true,owner_id) on conflict(singleton) do nothing;
end $owner$;
create or replace function public.portfolio_is_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.portfolio_owner where user_id = (select auth.uid())); $$;
revoke all on function public.portfolio_is_owner() from public, anon;
grant execute on function public.portfolio_is_owner() to authenticated;
create table if not exists public.portfolio_content (
  id integer primary key check (id = 1),
  data jsonb not null check (jsonb_typeof(data) = 'object' and jsonb_typeof(data->'posts') = 'array'),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.portfolio_content enable row level security;
revoke all on public.portfolio_content from public, anon, authenticated;
grant select, update on public.portfolio_content to authenticated;
drop policy if exists "Owner can read website content" on public.portfolio_content;
create policy "Owner can read website content" on public.portfolio_content for select to authenticated using ((select public.portfolio_is_owner()));
drop policy if exists "Owner can update website content" on public.portfolio_content;
create policy "Owner can update website content" on public.portfolio_content for update to authenticated using ((select public.portfolio_is_owner())) with check ((select public.portfolio_is_owner()));
create or replace function public.portfolio_touch_content()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := clock_timestamp(); return new; end; $$;
revoke all on function public.portfolio_touch_content() from public, anon, authenticated;
drop trigger if exists portfolio_content_updated on public.portfolio_content;
create trigger portfolio_content_updated before update on public.portfolio_content for each row execute function public.portfolio_touch_content();
insert into public.portfolio_content(id,data) values (1,'${seed}'::jsonb) on conflict(id) do nothing;
-- Visitors get only published posts; the full content table is never public.
create or replace function public.portfolio_public()
returns jsonb language sql stable security definer set search_path = ''
as $$ select data || jsonb_build_object('posts',coalesce((select jsonb_agg(post order by position) from jsonb_array_elements(data->'posts') with ordinality as items(post,position) where post->>'published' = 'true'),'[]'::jsonb)) from public.portfolio_content where id = 1; $$;
revoke all on function public.portfolio_public() from public;
grant execute on function public.portfolio_public() to anon, authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('portfolio-images','portfolio-images',true,3000000,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict(id) do update set public=true, file_size_limit=3000000, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Portfolio owner uploads images" on storage.objects;
create policy "Portfolio owner uploads images" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio-images' and (select public.portfolio_is_owner()));
drop policy if exists "Portfolio owner reads images" on storage.objects;
create policy "Portfolio owner reads images" on storage.objects for select to authenticated using (bucket_id = 'portfolio-images' and (select public.portfolio_is_owner()));
drop policy if exists "Portfolio owner updates images" on storage.objects;
create policy "Portfolio owner updates images" on storage.objects for update to authenticated using (bucket_id = 'portfolio-images' and (select public.portfolio_is_owner())) with check (bucket_id = 'portfolio-images' and (select public.portfolio_is_owner()));
drop policy if exists "Portfolio owner deletes images" on storage.objects;
create policy "Portfolio owner deletes images" on storage.objects for delete to authenticated using (bucket_id = 'portfolio-images' and (select public.portfolio_is_owner()));
commit;
`;
await writeFile('supabase/setup.sql',sql);
console.log('Generated Supabase setup with editable owner email. Existing content will be preserved when rerun.');
