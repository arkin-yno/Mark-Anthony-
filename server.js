import http from 'node:http';
import { readFile, writeFile, mkdir, rename, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { defaultContent } from './content.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, '.data'));
await mkdir(path.join(dataDir, 'uploads'), { recursive: true, mode: 0o700 });
const contentPath = path.join(dataDir, 'content.json');
let content;
try { content = JSON.parse(await readFile(contentPath, 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') throw e; content = structuredClone(defaultContent); await writeFile(contentPath, JSON.stringify(content, null, 2), { mode: 0o600 }); }
const authPath = path.join(dataDir, 'auth.json');
let auth;
try { auth = JSON.parse(await readFile(authPath, 'utf8')); }
catch (e) {
  if (e.code !== 'ENOENT') throw e;
  const password = process.env.ADMIN_PASSWORD || randomBytes(24).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  auth = { salt, hash: scryptSync(password, salt, 64).toString('hex') };
  await writeFile(authPath, JSON.stringify(auth), { mode: 0o600 });
  if (!process.env.ADMIN_PASSWORD) await writeFile(path.join(dataDir, 'admin-password.txt'), password + '\n', { mode: 0o600 });
}
const sessions = new Map();
const attempts = new Map();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon' };
function send(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
async function body(req, limit = 15_000_000) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw Object.assign(new Error('File or request is too large.'), { status: 413 }); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}
function session(req) {
  const token = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  const s = sessions.get(token);
  if (!s || s.expires < Date.now()) { if (token) sessions.delete(token); return null; }
  return s;
}
function secureCookie(req) { return process.env.COOKIE_SECURE === 'true' || req.socket.encrypted; }
function cookie(req, token, age) { return `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secureCookie(req) ? '; Secure' : ''}`; }
function validateContent(c) {
  if (!c || typeof c.profile !== 'object' || !c.profile || Array.isArray(c.profile)) return false;
  const strings = Object.keys(defaultContent.profile);
  if (!strings.every(k => typeof c.profile[k] === 'string' && c.profile[k].length <= 20000)) return false;
  if (!['tools','services','projects','testimonials','posts','faqs'].every(k => Array.isArray(c[k]) && c[k].length <= 500)) return false;
  if (!c.tools.every(t => typeof t === 'string' && t.length <= 200)) return false;
  const shape = (rows, fields) => rows.every(r => r && fields.every(k => typeof r[k] === 'string' && r[k].length <= 100000));
  if (!shape(c.services,['title','category','icon','description','details']) || !c.services.every(r => typeof r.featured === 'boolean')) return false;
  if (!shape(c.projects,['title','description','category','image','url'])) return false;
  if (!shape(c.testimonials,['name','role','quote','image'])) return false;
  if (!shape(c.faqs,['question','answer'])) return false;
  if (!shape(c.posts,['id','title','excerpt','date','cover']) || !c.posts.every(p => typeof p.published === 'boolean' && Array.isArray(p.blocks) && shape(p.blocks,['type','text','image','caption']) && p.blocks.every(b => ['text','image'].includes(b.type)))) return false;
  return new Set(c.posts.map(p => p.id)).size === c.posts.length;
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (p.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (!['GET','HEAD'].includes(req.method)) {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) return send(res, 403, { error: 'Cross-origin request rejected.' });
        if (req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, { error: 'Cross-site request rejected.' });
      }
      if (p === '/api/config' && req.method === 'GET') return send(res,200,{mode:'local'});
      if (p === '/api/health' && req.method === 'GET') return send(res,200,{status:'ok'});
      if (p === '/api/content' && req.method === 'GET') return send(res,200,{...content, posts:content.posts.filter(p => p.published)});
      if (p === '/api/login' && req.method === 'POST') {
        const ip = req.socket.remoteAddress;
        const a = attempts.get(ip) || { count:0, until:Date.now()+900000 };
        if (a.until < Date.now()) { a.count=0; a.until=Date.now()+900000; }
        if (a.count >= 10) return send(res,429,{error:'Too many attempts. Please try again in 15 minutes.'});
        const b = await body(req, 4096);
        const password = typeof b.password === 'string' ? b.password : '';
        const check = scryptSync(password,auth.salt,64);
        if (!timingSafeEqual(check,Buffer.from(auth.hash,'hex'))) { a.count++; attempts.set(ip,a); return send(res,401,{error:'Incorrect password.'}); }
        attempts.delete(ip);
        const token = randomBytes(32).toString('hex');
        sessions.set(token,{expires:Date.now()+28800000});
        res.setHeader('Set-Cookie',cookie(req,token,28800)); return send(res,200,{ok:true});
      }
      if (!session(req)) return send(res,401,{error:'Please sign in to continue.'});
      if (p === '/api/logout' && req.method === 'POST') {
        const token = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie || '')?.[1]; sessions.delete(token);
        res.setHeader('Set-Cookie',cookie(req,'',0)); return send(res,200,{ok:true});
      }
      if (p === '/api/admin/content' && req.method === 'GET') return send(res,200,content);
      if (p === '/api/admin/content' && req.method === 'PUT') {
        const c = await body(req, 2_000_000);
        if (!validateContent(c)) return send(res,400,{error:'Content format is invalid. Check the fields and try again.'});
        const tmp = contentPath + '.' + randomBytes(8).toString('hex') + '.tmp';
        await writeFile(tmp,JSON.stringify(c,null,2),{mode:0o600}); await rename(tmp,contentPath); content=c;
        return send(res,200,{ok:true});
      }
      if (p === '/api/admin/password' && req.method === 'POST') {
        const b = await body(req,4096);
        if (typeof b.password !== 'string' || b.password.length<12 || b.password.length>256) return send(res,400,{error:'Use a password between 12 and 256 characters.'});
        const salt=randomBytes(16).toString('hex'); const next={salt,hash:scryptSync(b.password,salt,64).toString('hex')};
        await writeFile(authPath,JSON.stringify(next),{mode:0o600}); auth=next;
        await unlink(path.join(dataDir,'admin-password.txt')).catch(e=>{if(e.code!=='ENOENT')throw e;});
        sessions.clear(); res.setHeader('Set-Cookie',cookie(req,'',0)); return send(res,200,{ok:true});
      }
      if (p === '/api/admin/upload' && req.method === 'POST') {
        const b=await body(req);
        if (typeof b.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(b.data)) return send(res,400,{error:'Invalid image.'});
        const bytes=Buffer.from(b.data,'base64');
        if (bytes.length>10_000_000) return send(res,413,{error:'Images must be under 10 MB.'});
        let ext;
        if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ext='.png';
        else if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) ext='.jpg';
        else if (bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') ext='.webp';
        else if (['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))) ext='.gif';
        else return send(res,400,{error:'Upload a PNG, JPG, WebP, or GIF image.'});
        const name=randomBytes(16).toString('hex')+ext;
        await writeFile(path.join(dataDir,'uploads',name),bytes,{mode:0o600});
        return send(res,201,{url:'/uploads/'+name});
      }
      return send(res,404,{error:'Not found.'});
    }
    if (!['GET','HEAD'].includes(req.method)) return send(res,405,{error:'Method not allowed.'});
    let file;
    if (p.startsWith('/uploads/')) {
      if (!/^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp|gif)$/.test(p)) return send(res,404,{error:'Not found.'});
      file=path.join(dataDir,'uploads',path.basename(p));
    } else {
      const publicRoot=path.join(root,'public');
      file=path.resolve(publicRoot,'.'+decodeURIComponent(p));
      if (!file.startsWith(publicRoot+path.sep) && file !== publicRoot) return send(res,403,{error:'Forbidden.'});
      try { if (!(await stat(file)).isFile()) file=path.join(publicRoot,'index.html'); }
      catch(e) { if(e.code!=='ENOENT')throw e; if(path.extname(p))return send(res,404,{error:'Not found.'}); file=path.join(publicRoot,'index.html'); }
    }
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}); res.end(req.method==='HEAD'?undefined:bytes);
  } catch(e) { if(e.code==='ENOENT') return send(res,404,{error:'Not found.'}); send(res,e.status||400,{error:e.status?e.message:'Could not process request.'}); }
});
server.listen(Number(process.env.PORT)||3000,process.env.HOST||'0.0.0.0',()=>console.log(`Portfolio running on port ${Number(process.env.PORT)||3000}. Admin credentials: ${path.join(dataDir,'admin-password.txt')} (first run only).`));
