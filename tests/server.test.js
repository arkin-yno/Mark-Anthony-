import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defaultContent } from '../content.js';

test('authentication, content persistence, draft privacy, uploads, and password rotation', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'portfolio-test-'));
  const port = 3100 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  let child;
  const start = async () => {
    child = spawn(process.execPath, ['scripts/local-server.js'], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir }, stdio: ['ignore','pipe','pipe'] });
    await new Promise((resolve,reject) => { const timeout=setTimeout(()=>reject(new Error('Startup timed out')),10000); child.stdout.once('data',()=>{clearTimeout(timeout);resolve();}); child.once('exit',code=>{clearTimeout(timeout);reject(new Error('Server exited '+code));}); });
  };
  const stop = async () => { if(child && child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;} };
  let cookie='';
  const req = async (p, method='GET', data, headers={}) => fetch(base+p,{method,headers:{'Content-Type':'application/json',Cookie:cookie,...headers},body:data===undefined?undefined:JSON.stringify(data)});
  try {
    await start();
    assert.equal((await req('/api/admin/content')).status,401);
    assert.equal((await req('/api/admin/content','PUT',defaultContent)).status,401);
    assert.equal((await req('/api/login','POST',{password:'wrong'})).status,401);
    const password=(await readFile(path.join(dir,'admin-password.txt'),'utf8')).trim();
    const login=await req('/api/login','POST',{password});
    assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'),/HttpOnly/);
    const c=structuredClone(defaultContent); c.profile.headline='Persisted headline';
    c.posts=[{id:'draft',title:'Private draft',excerpt:'',date:'2026-10-13',cover:'',published:false,blocks:[]},{id:'live',title:'Published story',excerpt:'A story',date:'2026-10-13',cover:'',published:true,blocks:[{type:'text',text:'Hello reader',image:'',caption:''}]}];
    assert.equal((await req('/api/admin/content','PUT',c,{Origin:'https://other.example'})).status,403);
    assert.equal((await req('/api/admin/content','PUT',{...c,services:[{}]})).status,400);
    assert.equal((await req('/api/admin/content','PUT',c)).status,200);
    const pub=await (await req('/api/content')).json();
    assert.equal(pub.profile.headline,'Persisted headline');assert.deepEqual(pub.posts.map(p=>p.id),['live']);
    assert.equal((await (await req('/api/admin/content')).json()).posts.length,2);
    assert.equal((await req('/api/admin/upload','POST',{data:Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')})).status,400);
    const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1cAAAAASUVORK5CYII=';
    const upload=await req('/api/admin/upload','POST',{data:png});assert.equal(upload.status,201);
    const image=await upload.json();const response=await req(image.url);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
    assert.equal((await req('/uploads/not-valid.png')).status,404);
    for(const p of ['/','#admin','/services','/styles.css','/app.js'])assert.equal((await req(p)).status,200);
    await stop();await start();cookie='';
    assert.equal((await (await req('/api/content')).json()).profile.headline,'Persisted headline');
    const again=await req('/api/login','POST',{password});cookie=again.headers.get('set-cookie').split(';')[0];
    const newPassword='A-long-test-password-4826';
    assert.equal((await req('/api/admin/password','POST',{password:newPassword})).status,200);
    assert.equal((await req('/api/admin/content')).status,401);
    assert.equal((await req('/api/login','POST',{password})).status,401);
    assert.equal((await req('/api/login','POST',{password:newPassword})).status,200);
  } finally {await stop();await rm(dir,{recursive:true,force:true});}
});
