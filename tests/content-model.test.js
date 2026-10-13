import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeContent, toolsForService, testimonialsForService, externalWebsiteUrl} from '../public/content-model.js';

test('existing saved content upgrades without mutating text, photos, projects, or posts', () => {
  const before={profile:{name:'Existing owner',photo:'/original.png',linkedin:'https://linkedin.com/in/owner',facebook:'',instagram:''},tools:['Canva','Meta Ads'],services:[{title:'SMM'}],projects:[{title:'Existing project'}],posts:[{title:'Existing blog'}],testimonials:[],faqs:[]};
  const original=structuredClone(before),after=normalizeContent(before);
  assert.deepEqual(before,original);
  assert.deepEqual(after.profile,original.profile);
  assert.deepEqual(after.projects,original.projects);
  assert.deepEqual(after.posts,original.posts);
  assert.equal(after.tools[0].name,'Canva');
  assert.equal(after.socialLinks[0].url,original.profile.linkedin);
  assert.deepEqual(after.portfolio,[]);
  assert.deepEqual(after.aboutPhotos,[]);
  assert.deepEqual(normalizeContent(after),after);
});

test('reordering and renaming tools keeps group/service associations; intentionally deleted socials stay deleted', () => {
  const c=normalizeContent({profile:{linkedin:'https://linkedin.com/in/old'},tools:['Canva','Notion'],services:[{title:'SMM'},{title:'Support'}]});
  const toolId=c.tools[0].id,serviceId=c.services[0].id;
  c.toolGroups=[{id:'smm',title:'SMM Tools',toolIds:[toolId],serviceIds:[serviceId]}];
  c.tools.reverse();c.tools.find(t=>t.id===toolId).name='Canva Pro';c.services[0].title='Social Media Management';
  c.socialLinks=[];
  const after=normalizeContent(c);
  assert.deepEqual(toolsForService(after,serviceId).map(t=>t.name),['Canva Pro']);
  assert.deepEqual(toolsForService(after,c.services[1].id),[]);
  assert.deepEqual(after.socialLinks,[]);
});

test('website links accept real destinations and reject executable or non-web URLs', () => {
  assert.equal(externalWebsiteUrl('https://example.com/portfolio'),'https://example.com/portfolio');
  assert.equal(externalWebsiteUrl('example.com'),'https://example.com/');
  for(const input of ['javascript:alert(1)','data:text/html,test','mailto:a@example.com','ftp://example.com','/relative',''])assert.equal(externalWebsiteUrl(input),'');
});

test('testimonials filter by service, support multiple assignments, and retain legacy reviews under All services', () => {
  const legacy={name:'Legacy client',role:'Owner',quote:'Original feedback',image:''};
  const before={profile:{},tools:[],services:[{title:'Social Media Management'},{title:'Email Marketing'},{title:'Automation'}],testimonials:[legacy]};
  const c=normalizeContent(before),smm=c.services[0].id,email=c.services[1].id,automation=c.services[2].id;
  c.testimonials.push({name:'SMM client',serviceIds:[smm]},{name:'Shared client',serviceIds:[smm,email]});
  assert.deepEqual(before.testimonials,[legacy]);
  assert.deepEqual(c.testimonials[0].serviceIds,[]);
  assert.equal(testimonialsForService(c).length,3);
  assert.deepEqual(testimonialsForService(c,smm).map(t=>t.name),['SMM client','Shared client']);
  assert.deepEqual(testimonialsForService(c,email).map(t=>t.name),['Shared client']);
  assert.deepEqual(testimonialsForService(c,automation),[]);
  c.services.reverse();c.services.find(s=>s.id===smm).title='Renamed SMM service';
  assert.deepEqual(testimonialsForService(normalizeContent(c),smm).map(t=>t.name),['SMM client','Shared client']);
});
