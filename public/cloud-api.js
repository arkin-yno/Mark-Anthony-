// Only the public Supabase URL and publishable key reach the browser.
// Database and storage policies authorize the owner; no privileged key is used.
export let backend = { mode: 'local' };
let configPromise;
let contentRevision;
const sessionKey = 'portfolio-owner-session-v1';
export async function configureBackend() {
  if (!configPromise) configPromise = (async () => {
    const response = await fetch('/api/config', { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || 'Website configuration could not be loaded.');
    backend = config;
    return backend;
  })();
  return configPromise;
}
function getSession() { try { return JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch { return null; } }
function setSession(session) {
  if (!session) { localStorage.removeItem(sessionKey); return; }
  localStorage.setItem(sessionKey, JSON.stringify({ access_token:session.access_token, refresh_token:session.refresh_token, expires_at:Math.floor(Date.now()/1000)+session.expires_in }));
}
async function request(path, options = {}, token) {
  const res = await fetch(backend.url + path, { ...options, headers: { apikey:backend.key, ...(token ? { Authorization:'Bearer '+token } : {}), 'Content-Type':'application/json', ...options.headers } });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const text = data?.msg || data?.error_description || data?.message || data?.error || 'The request could not be completed.';
    if (res.status===401) throw new Error('Please sign in again.');
    if (text.includes('portfolio_public') || data?.code==='42P01') throw new Error('The database is not set up yet. Run supabase/setup.sql in the Supabase SQL Editor.');
    throw new Error(typeof text==='string' ? text : 'The request could not be completed.');
  }
  return data;
}
async function accessToken() {
  let s=getSession();
  if (!s?.access_token) throw new Error('Please sign in to continue.');
  if (s.expires_at < Math.floor(Date.now()/1000)+60) {
    try { const next=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:s.refresh_token})});setSession(next);s=getSession(); }
    catch {setSession(null);throw new Error('Please sign in again.');}
  }
  return s.access_token;
}
async function assertOwner(token) {
  const rows=await request('/rest/v1/portfolio_content?id=eq.1&select=updated_at',{method:'GET'},token);
  if (!rows?.length) throw new Error('This account is not the website owner. Check the owner email in your database setup.');
}
export async function portfolioApi(url, options={}) {
  await configureBackend();
  if (backend.mode==='local') {
    const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Something went wrong.');return data;
  }
  const method=options.method || 'GET';
  const body=options.body ? JSON.parse(options.body) : {};
  if(url==='/api/content') {
    const content=await request('/rest/v1/rpc/portfolio_public',{method:'POST',body:'{}'});
    if (!content?.profile) throw new Error('Website content is not initialized. Run supabase/setup.sql.');
    return content;
  }
  if(url==='/api/login') {
    const session=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:body.email,password:body.password})});
    try {await assertOwner(session.access_token);} catch(e) {await request('/auth/v1/logout?scope=local',{method:'POST'},session.access_token).catch(()=>{});throw e;}
    setSession(session);return {ok:true};
  }
  const token=await accessToken();
  if(url==='/api/logout') {try{await request('/auth/v1/logout?scope=local',{method:'POST'},token);}finally{setSession(null);}return {ok:true};}
  if(url==='/api/admin/content' && method==='GET') {
    const rows=await request('/rest/v1/portfolio_content?id=eq.1&select=data,updated_at',{},token);
    if(!rows?.length)throw new Error('This account is not authorized to edit this website.');
    contentRevision=rows[0].updated_at;return rows[0].data;
  }
  if(url==='/api/admin/content' && method==='PUT') {
    if(!contentRevision)throw new Error('Reload the editor before saving.');
    const rows=await request('/rest/v1/portfolio_content?id=eq.1&updated_at=eq.'+encodeURIComponent(contentRevision),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data:body})},token);
    if(!rows?.length)throw new Error('The content was changed in another session. Copy your edits, then reload before saving.');
    contentRevision=rows[0].updated_at;return {ok:true};
  }
  if(url==='/api/admin/password') {
    await assertOwner(token);
    if(typeof body.password!=='string'||body.password.length<12||body.password.length>256)throw new Error('Use a password between 12 and 256 characters.');
    await request('/auth/v1/user',{method:'PUT',body:JSON.stringify({password:body.password})},token);
    await request('/auth/v1/logout',{method:'POST'},token).catch(()=>{});setSession(null);return {ok:true};
  }
  if(url==='/api/admin/upload') {
    await assertOwner(token);
    const bytes=Uint8Array.from(atob(body.data),c=>c.charCodeAt(0));
    // Stay below Vercel's request limit too when using the local API.
    if(bytes.length>3_000_000)throw new Error('Please choose an image under 3 MB.');
    let ext,type;
    if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)){ext='png';type='image/png';}
    else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){ext='jpg';type='image/jpeg';}
    else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'){ext='webp';type='image/webp';}
    else if(['GIF87a','GIF89a'].includes(new TextDecoder().decode(bytes.slice(0,6)))){ext='gif';type='image/gif';}
    else throw new Error('Upload a PNG, JPG, WebP, or GIF image.');
    const name=crypto.randomUUID()+'.'+ext;
    await request('/storage/v1/object/portfolio-images/'+name,{method:'POST',body:bytes,headers:{'Content-Type':type,'x-upsert':'false'}},token);
    return {url:backend.url+'/storage/v1/object/public/portfolio-images/'+name};
  }
  throw new Error('Unknown website operation.');
}
