import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Supabase SQL enforces owner access and keeps unpublished posts private', async () => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key,email text);
      insert into auth.users values ('${owner}','owner@example.test'),('${other}','other@example.test');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id integer generated always as identity,bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      grant usage on all sequences in schema storage to authenticated;
    `);
    const raw=await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8');
    // This matches the one email substitution the owner makes in SQL Editor.
    const sql=raw.replace("owner_email text := 'YOUR_OWNER_EMAIL_HERE'", "owner_email text := 'owner@example.test'");
    await db.exec(sql);
    await db.query(`update public.portfolio_content set data = jsonb_set(data,'{posts}', '[{"id":"private","published":false},{"id":"public","published":true}]'::jsonb)`);
    await db.exec('set role anon');
    const pub=await db.query('select public.portfolio_public() as content');
    assert.deepEqual(pub.rows[0].content.posts,[{id:'public',published:true}]);
    await assert.rejects(db.query('select data from public.portfolio_content'),/permission denied/);
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${other}'`);
    assert.equal((await db.query('select data from public.portfolio_content')).rows.length,0);
    assert.equal((await db.query("update public.portfolio_content set data = jsonb_set(data,'{profile,name}','\"Unauthorized\"') returning id")).rows.length,0);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('portfolio-images','bad.png')"),/row-level security/);
    await db.exec(`set request.jwt.claim.sub = '${owner}'`);
    const before=(await db.query('select updated_at::text as updated_at from public.portfolio_content')).rows[0].updated_at;
    assert.equal((await db.query('select data from public.portfolio_content')).rows[0].data.posts.length,2);
    assert.equal((await db.query("update public.portfolio_content set data = jsonb_set(data,'{profile,name}','\"Updated Owner\"') returning id")).rows.length,1);
    const after=(await db.query('select updated_at::text as updated_at from public.portfolio_content')).rows[0].updated_at;
    assert.notEqual(String(before),String(after));
    await db.query("insert into storage.objects(bucket_id,name) values('portfolio-images','good.png')");
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('another-bucket','bad.png')"),/row-level security/);
    await db.exec('reset role');
    await db.exec(sql);
    assert.equal((await db.query('select data from public.portfolio_content')).rows[0].data.profile.name,'Updated Owner');
    assert.equal((await db.query('select data from public.portfolio_content')).rows[0].data.posts.length,2);
  } finally {await db.close();}
});
