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
    c.testimonials=[{name:'Service client',role:'Owner',quote:'A real review fixture',image:'',serviceIds:[c.services[0].id,c.services[1].id]}];
    c.portfolio=[{id:'website',title:'Website',category:'Design',description:'Portfolio sample',image:'',url:'https://example.com',serviceIds:[c.services[0].id]}];
    c.projects=[{id:'sample',title:'Project',category:'SMM',description:'Project sample',image:'',url:'',serviceIds:[c.services[0].id]}];
    c.services[0].overview='Detailed service information';
    c.services[0].blocks=[{id:'section',type:'text',title:'More about this service',text:'Additional details',image:'',caption:'',url:''}];
    c.process.steps[0].title='My discovery step';
    c.process.workflows=[{id:'smm-process',serviceId:c.services[0].id,heading:'My social media process',intro:'A complete workflow',steps:[{id:'smm-audit',title:'Audit social channels',description:'Review the existing channels and plan next steps.',icon:'target'}]}];
    c.experiences=[{id:'client-experience',name:'Example company',kind:'company',role:'Marketing support',period:'2024–2025',location:'Remote',description:'Work history',highlights:'Campaign planning',image:'',url:'https://example.com',
      serviceIds:[c.services[0].id],portfolioIds:['website'],projectIds:['sample'],toolIds:[c.tools[0].id],testimonialIds:['testimonial-1'],processStepIds:['smm-audit'],postIds:['live'],links:[{id:'company-link',label:'Company website',url:'https://example.com'}]}];
    c.posts=[{id:'draft',title:'Private draft',excerpt:'',date:'2026-10-13',cover:'',published:false,blocks:[]},{id:'live',title:'Published story',excerpt:'A story',date:'2026-10-13',cover:'',published:true,blocks:[{type:'text',text:'Hello reader',image:'',caption:''}]}];
    c.gallery=[{id:'shared-photo',title:'Campaign photo',caption:'My original caption',image:'/uploads/example.png',sectionIds:['home','portfolio','blog'],
      serviceIds:[c.services[0].id],portfolioIds:['website'],projectIds:['sample'],postIds:['live'],experienceIds:['client-experience'],toolIds:[c.tools[0].id],processIds:['general','smm-process']}];
    assert.equal((await req('/api/admin/content','PUT',c,{Origin:'https://other.example'})).status,403);
    assert.equal((await req('/api/admin/content','PUT',{...c,services:[{}]})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,testimonials:[{...c.testimonials[0],serviceIds:'invalid'}]})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,process:{...c.process,steps:'invalid'}})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,process:{...c.process,steps:[{...c.process.steps[0],serviceIds:'invalid'}]}})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,process:{...c.process,steps:[{...c.process.steps[0],serviceIds:null}]}})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,process:{...c.process,workflows:'invalid'}})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,process:{...c.process,workflows:[{...c.process.workflows[0],serviceId:null}]}})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,process:{...c.process,workflows:[{...c.process.workflows[0],steps:'invalid'}]}})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,process:{...c.process,workflows:[c.process.workflows[0],c.process.workflows[0]]}})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,process:{...c.process,workflows:[{...c.process.workflows[0],steps:[{...c.process.steps[0]}]}]}})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,process:{...c.process,workflows:[{...c.process.workflows[0],steps:Array.from({length:101},(_,i)=>({...c.process.workflows[0].steps[0],id:'over-limit-'+i}))}]}})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,experiences:[c.experiences[0],c.experiences[0]]})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,experiences:[{...c.experiences[0],kind:'invalid'}]})).status,400);
    for(const relation of ['serviceIds','portfolioIds','projectIds','toolIds','testimonialIds','processStepIds','postIds']) {
      assert.equal((await req('/api/admin/content','PUT',{...c,experiences:[{...c.experiences[0],[relation]:'invalid'}]})).status,400);
    }
    assert.equal((await req('/api/admin/content','PUT',{...c,experiences:[{...c.experiences[0],toolIds:null}]})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,experiences:[{...c.experiences[0],links:'invalid'}]})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,experiences:[{...c.experiences[0],links:[{label:'Missing URL'}]}]})).status,400);
    assert.equal((await req('/api/admin/content','PUT',{...c,portfolio:[c.portfolio[0],c.portfolio[0]]})).status,400);
    for(const gallery of [null,'invalid',{},[null],[[]],[false],[c.gallery[0],c.gallery[0]],
      [{...c.gallery[0],title:3}],[{...c.gallery[0],caption:null}],[{...c.gallery[0],image:[]}],
      [{...c.gallery[0],id:null}],[{...c.gallery[0],id:3}],[{...c.gallery[0],id:''}],
      [{...c.gallery[0],caption:'x'.repeat(100001)}],[{...c.gallery[0],sectionIds:['unknown-section']}],
      Array.from({length:501},(_,i)=>({...c.gallery[0],id:'photo-'+i}))]) {
      assert.equal((await req('/api/admin/content','PUT',{...c,gallery})).status,400,'Reject malformed gallery content');
    }
    for(const relation of ['sectionIds','serviceIds','portfolioIds','projectIds','postIds','experienceIds','toolIds','processIds']) {
      for(const invalid of ['invalid',null,[''],[false],Array.from({length:501},()=> 'target')]) {
        assert.equal((await req('/api/admin/content','PUT',{...c,gallery:[{...c.gallery[0],[relation]:invalid}]})).status,400,'Reject malformed gallery '+relation);
      }
    }
    const legacy=structuredClone(c);delete legacy.experiences;delete legacy.gallery;delete legacy.process.workflows;legacy.process.steps.forEach(step=>delete step.serviceIds);
    assert.equal((await req('/api/admin/content','PUT',legacy)).status,200);
    assert.deepEqual((await (await req('/api/content')).json()).gallery,[]);
    assert.equal((await req('/api/admin/content','PUT',c)).status,200);
    const pub=await (await req('/api/content')).json();
    assert.equal(pub.profile.headline,'Persisted headline');assert.deepEqual(pub.posts.map(p=>p.id),['live']);
    assert.deepEqual(pub.testimonials[0].serviceIds,c.testimonials[0].serviceIds);
    assert.deepEqual(pub.portfolio,c.portfolio);
    assert.deepEqual(pub.services[0].blocks,c.services[0].blocks);
    assert.deepEqual(pub.experiences,c.experiences);
    assert.deepEqual(pub.process.workflows,c.process.workflows);
    assert.deepEqual(pub.gallery,c.gallery);
    assert.equal((await req('/api/admin/content','PUT',{...c,gallery:[{...c.gallery[0],sectionIds:['bad']}]})).status,400);
    assert.deepEqual((await (await req('/api/admin/content')).json()).gallery,c.gallery);
    assert.equal((await (await req('/api/admin/content')).json()).posts.length,2);
    assert.equal((await req('/api/admin/upload','POST',{data:Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')})).status,400);
    const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1cAAAAASUVORK5CYII=';
    const upload=await req('/api/admin/upload','POST',{data:png});assert.equal(upload.status,201);
    const image=await upload.json();const response=await req(image.url);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
    c.gallery[0].image=image.url;c.portfolio[0].image=image.url;
    assert.equal((await req('/api/admin/content','PUT',c)).status,200);
    assert.equal((await req('/api/admin/content','PUT',{...c,gallery:[]})).status,200);
    assert.equal((await req(image.url)).status,200,'Removing a gallery entry retains the uploaded file');
    assert.equal((await (await req('/api/content')).json()).portfolio[0].image,image.url);
    assert.equal((await req('/api/admin/content','PUT',c)).status,200);
    assert.equal((await req('/uploads/not-valid.png')).status,404);
    for(const p of ['/','#admin','/services','/styles.css','/app.js'])assert.equal((await req(p)).status,200);
    await stop();await start();cookie='';
    assert.equal((await (await req('/api/content')).json()).profile.headline,'Persisted headline');
    assert.deepEqual((await (await req('/api/content')).json()).testimonials[0].serviceIds,c.testimonials[0].serviceIds);
    const restored=await (await req('/api/content')).json();
    assert.deepEqual(restored.projects,c.projects);
    assert.equal(restored.process.steps[0].title,'My discovery step');
    assert.deepEqual(restored.process.workflows,c.process.workflows);
    assert.deepEqual(restored.experiences,c.experiences);
    assert.deepEqual(restored.gallery,c.gallery);
    const again=await req('/api/login','POST',{password});cookie=again.headers.get('set-cookie').split(';')[0];
    const newPassword='A-long-test-password-4826';
    assert.equal((await req('/api/admin/password','POST',{password:newPassword})).status,200);
    assert.equal((await req('/api/admin/content')).status,401);
    assert.equal((await req('/api/login','POST',{password})).status,401);
    assert.equal((await req('/api/login','POST',{password:newPassword})).status,200);
  } finally {await stop();await rm(dir,{recursive:true,force:true});}
});
