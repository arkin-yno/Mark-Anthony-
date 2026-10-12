-- Run this whole file in Supabase > SQL Editor > New query.
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
insert into public.portfolio_content(id,data) values (1,'{"profile":{"name":"Mark Anthony","role":"Your all-around business partner","initials":"MA","photo":"","headline":"You’ve found me.","eyebrow":"Looking for someone who can do EVERYTHING for you or your business?","intro":"From marketing and sales to automation, design, and everyday operations — I help you get things done.","about":"I bring a versatile set of skills to the businesses I support. Whether you need to reach new customers, simplify your systems, or take everyday tasks off your plate, I’m here to help.\n\nMy experience spans social media, lead generation, paid advertising, automation, design, and executive assistance. Let’s find the right support for your next chapter.","location":"","email":"","bookingUrl":"","linkedin":"","facebook":"","instagram":"","contactHeading":"What’s taking up your time?","contactText":"Let’s take it off your plate. Tell me what you’re working on and where you could use a hand.","footer":"A little coffee. A lot of possibilities."},"tools":["Meta Ads","Google Ads","Google Workspace","Canva","CRM systems","AI & automation"],"services":[{"title":"Social media & marketing","category":"Marketing","icon":"spark","description":"Build a consistent presence and turn attention into meaningful connections.","details":"Social media management · Content calendars · Community engagement · Email marketing · SEO · Digital strategy","featured":true},{"title":"Lead generation & sales","category":"Sales","icon":"target","description":"Find the right people, start the conversation, and keep your pipeline moving.","details":"Prospect research · Cold email & LinkedIn outreach · Appointment setting · CRM management · Lead qualification · Sales closing","featured":true},{"title":"Paid ads & campaigns","category":"Marketing","icon":"chart","description":"Bring strategy, creativity, and thoughtful optimization to your advertising.","details":"Meta & Google Ads · Media buying · Campaign strategy · Audience research · Analytics & reporting","featured":true},{"title":"AI & workflow automation","category":"Automation","icon":"bolt","description":"Connect your tools and give repetitive work a smarter way to get done.","details":"AI-assisted workflows · Business automation · System integrations · Process documentation","featured":true},{"title":"Websites, funnels & design","category":"Design","icon":"layers","description":"Create clear, thoughtful digital experiences that guide people to take action.","details":"UI/UX · Website development · Funnel design & building · Graphic design · Branding · Presentations · Copywriting · Video & photo editing","featured":true},{"title":"Executive & virtual assistance","category":"Administration","icon":"calendar","description":"Get reliable support for the details that keep your business moving.","details":"Calendar & email management · Data entry · Spreadsheets · Research · Travel planning · Google Workspace · Executive & personal assistance","featured":true},{"title":"Customer care & technical support","category":"Support","icon":"chat","description":"Help your customers feel heard, supported, and confident in your business.","details":"Email & live chat support · Technical support · Order processing · Customer follow-ups · Complaint resolution · Meta administration","featured":false},{"title":"Business & team operations","category":"Operations","icon":"briefcase","description":"Bring structure to your projects, processes, and remote team.","details":"Project & operations management · Chief of staff support · Recruitment · Employee onboarding · Training · Quality assurance · Virtual events","featured":false},{"title":"Finance & administrative support","category":"Finance","icon":"chart","description":"Keep the numbers, records, and day-to-day financial tasks organized.","details":"Bookkeeping · Invoices · Expenses · Financial reporting · Accounts payable & receivable · Payroll administration · Budget monitoring","featured":false},{"title":"Specialized virtual assistance","category":"Administration","icon":"briefcase","description":"Flexible support shaped around your industry and how you work.","details":"E-commerce · Shopify · Amazon · Real estate · Nonclinical medical administration · Legal administration · Transcription · Online tutoring · Data & business analysis","featured":false}],"projects":[],"testimonials":[],"posts":[],"faqs":[{"question":"What can you help my business with?","answer":"I support marketing, lead generation, sales, automation, design, customer care, and business administration. Share your priorities and we can work out the right scope together."},{"question":"Can I work with you on more than one service?","answer":"Yes. We can combine services around your business needs, from an individual project to ongoing support."},{"question":"How do we get started?","answer":"Use the contact details on this page to introduce your business, your goals, and the tasks you need help with. We can then discuss scope, timing, and next steps."}]}'::jsonb) on conflict(id) do nothing;
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
