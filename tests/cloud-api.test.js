import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/config.js';
import { defaultContent } from '../content.js';

test('hosted configuration exposes only a publishable key and rejects privileged keys', () => {
  const originalUrl=process.env.SUPABASE_URL, originalKey=process.env.SUPABASE_PUBLISHABLE_KEY;
  const run=()=>{let status,body;const res={setHeader(){},status(n){status=n;return this;},json(v){body=v;}};handler({method:'GET'},res);return {status,body};};
  try {
    delete process.env.SUPABASE_URL;delete process.env.SUPABASE_PUBLISHABLE_KEY;
    assert.equal(run().status,503);
    process.env.SUPABASE_URL='https://example-project.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_secret_not-a-real-key';
    assert.equal(run().status,503);
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test-only';
    assert.equal(run().status,200);
    assert.deepEqual(Object.keys(run().body).sort(),['key','mode','url']);
  } finally {
    if(originalUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=originalUrl;
    if(originalKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=originalKey;
  }
});

test('cloud adapter logs in, refreshes sessions, protects drafts, uploads images and detects editing conflicts', async () => {
  const originalFetch=globalThis.fetch,originalStorage=globalThis.localStorage;
  const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
  let current=structuredClone(defaultContent),revision='2026-10-13T00:00:00+00:00',refreshes=0;
  const base='https://example-project.supabase.co';
  globalThis.fetch=async (url,options={})=>{
    if(url==='/api/config')return Response.json({mode:'supabase',url:base,key:'sb_publishable_test-only'});
    const p=new URL(url).pathname,headers=options.headers||{};
    if(p==='/auth/v1/token') {if(url.includes('refresh_token'))refreshes++;return Response.json({access_token:'owner-test-token',refresh_token:'refresh-test-token',expires_in:3600});}
    if(p==='/rest/v1/rpc/portfolio_public')return Response.json({...current,posts:current.posts.filter(p=>p.published)});
    if(headers.Authorization!=='Bearer owner-test-token')return Response.json({message:'Not authorized'},{status:401});
    if(p==='/rest/v1/portfolio_content'){
      if(options.method==='PATCH'){
        if(new URL(url).searchParams.get('updated_at')!=='eq.'+revision)return Response.json([]);
        current=JSON.parse(options.body).data;revision='2026-10-13T01:00:00+00:00';return Response.json([{data:current,updated_at:revision}]);
      }
      return Response.json([{data:current,updated_at:revision}]);
    }
    if(p.startsWith('/storage/v1/object/')) {assert.equal(headers['Content-Type'],'image/png');assert.ok(options.body instanceof Uint8Array);return Response.json({Key:'uploaded-image'});}
    if(p==='/auth/v1/logout'||p==='/auth/v1/user')return Response.json({});
    throw new Error('Unexpected request '+p);
  };
  try {
    const {portfolioApi:api}=await import('../public/cloud-api.js?test='+Date.now());
    await assert.rejects(api('/api/admin/content'),/sign in/);
    await api('/api/login',{method:'POST',body:JSON.stringify({email:'owner@example.test',password:'test'})});
    const c=await api('/api/admin/content');
    c.posts=[{id:'draft',published:false},{id:'published',published:true}];
    await api('/api/admin/content',{method:'PUT',body:JSON.stringify(c)});
    assert.deepEqual((await api('/api/content')).posts.map(p=>p.id),['published']);
    revision='2026-10-13T02:00:00+00:00';
    await assert.rejects(api('/api/admin/content',{method:'PUT',body:JSON.stringify(c)}),/another session/);
    const upload=await api('/api/admin/upload',{method:'POST',body:JSON.stringify({data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1cAAAAASUVORK5CYII='})});
    assert.ok(upload.url.startsWith(base+'/storage/v1/object/public/portfolio-images/'));
    await assert.rejects(api('/api/admin/upload',{method:'POST',body:JSON.stringify({data:btoa('<svg/>')})}),/PNG/);
    const stored=JSON.parse(store.get('portfolio-owner-session-v1'));stored.expires_at=0;store.set('portfolio-owner-session-v1',JSON.stringify(stored));
    await api('/api/admin/content');assert.equal(refreshes,1);
    await api('/api/logout',{method:'POST'});assert.equal(store.size,0);
  } finally {globalThis.fetch=originalFetch;if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;}
});
