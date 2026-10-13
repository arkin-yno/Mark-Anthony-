import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeContent, toolsForService, testimonialsForService, workForService, serviceTasks, externalWebsiteUrl, processStepsForService, experiencesForService, removeContentItem} from '../public/content-model.js';

test('existing saved content upgrades without mutating text, photos, projects, or posts', () => {
  const before={profile:{name:'Existing owner',photo:'/original.png',linkedin:'https://linkedin.com/in/owner',facebook:'',instagram:''},tools:['Canva','Meta Ads'],services:[{title:'SMM'}],projects:[{title:'Existing project'}],posts:[{title:'Existing blog'}],testimonials:[],faqs:[]};
  const original=structuredClone(before),after=normalizeContent(before);
  assert.deepEqual(before,original);
  assert.deepEqual(after.profile,original.profile);
  assert.deepEqual(after.projects,[{...original.projects[0],id:'project-1',serviceIds:[]}]);
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

test('service portfolio/project links retain their targets through renames and reordering', () => {
  const c=normalizeContent({profile:{},tools:[],services:[{title:'SMM',details:''},{title:'Design',details:''}],portfolio:[{title:'Legacy site',url:'https://example.com'}],projects:[{title:'Legacy sample'}],testimonials:[]});
  const serviceId=c.services[0].id;
  c.portfolio[0].serviceIds=[serviceId];c.projects[0].serviceIds=[serviceId,c.services[1].id];
  c.services.reverse();c.services.find(service=>service.id===serviceId).title='Renamed SMM';
  const after=normalizeContent(c);
  assert.equal(workForService(after,'portfolio',serviceId)[0].url,'https://example.com');
  assert.equal(workForService(after,'projects',serviceId)[0].title,'Legacy sample');
  assert.deepEqual(workForService(after,'portfolio',c.services[0].id),[]);
  assert.deepEqual(normalizeContent(after),after);
});

test('new record IDs avoid existing IDs and intentionally deleted process steps stay deleted', () => {
  const c=normalizeContent({profile:{},tools:[],services:[{title:'Legacy'},{id:'service-1',title:'Existing'}],portfolio:[{title:'Legacy'},{id:'portfolio-1',title:'Existing'}],projects:[{title:'Legacy'},{id:'project-1',title:'Existing'}]});
  for(const collection of ['services','portfolio','projects'])assert.notEqual(c[collection][0].id,c[collection][1].id);
  assert.equal(c.process.steps.length,4);
  assert.deepEqual(normalizeContent(c),c);
  c.process.steps=[];
  assert.deepEqual(normalizeContent(c).process.steps,[]);
  assert.deepEqual(serviceTasks({details:'Content calendars · Reporting\nCustomer engagement\n\n'}),['Content calendars','Reporting','Customer engagement']);
});

test('legacy process, testimonial, and experience records receive stable IDs without overwriting existing data', () => {
  const before={profile:{},tools:['Canva',{id:'tool-1',name:'Existing tool'}],services:[{id:'smm',title:'SMM'}],testimonials:[{name:'Legacy reviewer',quote:'Original feedback'},{id:'testimonial-1',name:'Existing reviewer'}],
    process:{heading:'My own process',intro:'Original introduction',steps:[{title:'Legacy discovery',description:'Original step',icon:'target'},{id:'process-1',title:'Existing step',description:'Existing description',icon:'chart'}]},
    experiences:[{name:'Original client',description:'Original work'},{id:'experience-1',kind:'person',name:'Existing person',serviceIds:['smm'],links:[{label:'Profile',url:'https://example.com'}]}]};
  const original=structuredClone(before),c=normalizeContent(before);
  assert.deepEqual(before,original);
  for(const key of ['tools','testimonials','experiences'])assert.notEqual(c[key][0].id,c[key][1].id);
  assert.notEqual(c.process.steps[0].id,c.process.steps[1].id);
  assert.equal(c.process.heading,'My own process');
  assert.equal(c.process.steps[0].description,'Original step');
  assert.equal(c.experiences[0].description,'Original work');
  assert.deepEqual(c.process.steps[0].serviceIds,[]);
  assert.deepEqual(c.experiences[0].serviceIds,[]);
  assert.deepEqual(c.experiences[0].postIds,[]);
  assert.deepEqual(c.experiences[1].links,before.experiences[1].links);
  assert.deepEqual(normalizeContent(c),c);
  c.testimonials.reverse();c.process.steps.reverse();c.experiences.reverse();
  const reordered=normalizeContent(c);
  assert.equal(reordered.testimonials[1].name,'Legacy reviewer');
  assert.equal(reordered.process.steps[1].id,c.process.steps[1].id);
  assert.equal(reordered.experiences[1].id,c.experiences[1].id);
  c.experiences=[];c.process.steps=[];
  assert.deepEqual(normalizeContent(c).experiences,[]);
  assert.deepEqual(normalizeContent(c).process.steps,[]);
});

test('process search and service filters combine without reordering steps or including unassigned legacy steps', () => {
  const c=normalizeContent({profile:{},tools:[],services:[{id:'smm',title:'Social Media Management'},{id:'ads',title:'Paid Ads'}],
    process:{heading:'Process',intro:'',steps:[
      {id:'legacy',title:'General introduction',description:'Original step',icon:'target'},
      {id:'smm-discover',title:'Discover',description:'Audit social channels',icon:'target',serviceIds:['smm']},
      {id:'shared-plan',title:'Plan',description:'Build a campaign calendar',icon:'layers',serviceIds:['smm','ads']},
      {id:'ads-execute',title:'Execute',description:'Launch paid campaigns',icon:'bolt',serviceIds:['ads']}
    ]},experiences:[{id:'legacy-client',name:'Legacy client'},{id:'smm-client',name:'SMM client',serviceIds:['smm']},{id:'shared-client',name:'Shared client',serviceIds:['smm','ads']}]});
  assert.deepEqual(processStepsForService(c).map(step=>step.id),['legacy','smm-discover','shared-plan','ads-execute']);
  assert.deepEqual(processStepsForService(c,'smm').map(step=>step.id),['smm-discover','shared-plan']);
  assert.deepEqual(processStepsForService(c,'ads','  CAMPAIGN  ').map(step=>step.id),['shared-plan','ads-execute']);
  assert.deepEqual(processStepsForService(c,'','social media').map(step=>step.id),['smm-discover','shared-plan']);
  assert.deepEqual(processStepsForService(c,'smm','paid ads').map(step=>step.id),['shared-plan']);
  assert.deepEqual(processStepsForService(c,'smm','no matches'),[]);
  assert.deepEqual(experiencesForService(c).map(item=>item.id),['legacy-client','smm-client','shared-client']);
  assert.deepEqual(experiencesForService(c,'ads').map(item=>item.id),['shared-client']);
  c.services[0].title='Renamed social service';
  assert.deepEqual(processStepsForService(c,'smm','renamed').map(step=>step.id),['smm-discover','shared-plan']);
  assert.deepEqual(processStepsForService(c,'smm','social media'),[]);
});

test('deleting related content removes only its associations and preserves all other experience data', () => {
  const fixture=()=>normalizeContent({profile:{},tools:[{id:'tool',name:'Canva'}],services:[{id:'smm',title:'SMM'},{id:'ads',title:'Ads'}],
    portfolio:[{id:'website',title:'Website',serviceIds:['smm','ads']}],projects:[{id:'project',title:'Project',serviceIds:['smm']}],
    testimonials:[{id:'review',name:'Client',serviceIds:['smm','ads']}],posts:[{id:'post',title:'Post'}],toolGroups:[{id:'group',title:'SMM Tools',toolIds:['tool'],serviceIds:['smm','ads']}],
    process:{heading:'Process',intro:'',steps:[{id:'step',title:'Discover',description:'Audit',icon:'target',serviceIds:['smm','ads']}]},
    experiences:[{id:'client',name:'Client',description:'Keep my work history',serviceIds:['smm','ads'],portfolioIds:['website'],projectIds:['project'],toolIds:['tool'],testimonialIds:['review'],processStepIds:['step'],postIds:['post'],links:[{label:'Independent link',url:'https://example.com'}]}]});
  const c=fixture(),removed=removeContentItem(c,'services',0);
  assert.equal(removed.id,'smm');
  assert.deepEqual(c.services.map(row=>row.id),['ads']);
  for(const key of ['portfolio','projects','toolGroups','testimonials','experiences'])assert.ok(c[key].every(row=>!row.serviceIds.includes('smm')));
  assert.deepEqual(c.process.steps[0].serviceIds,['ads']);
  assert.deepEqual(c.experiences[0].serviceIds,['ads']);
  assert.equal(c.experiences[0].description,'Keep my work history');
  for(const [collection,relation] of [['portfolio','portfolioIds'],['projects','projectIds'],['tools','toolIds'],['testimonials','testimonialIds'],['process.steps','processStepIds'],['posts','postIds']]) {
    const content=fixture(),before=structuredClone(content.experiences[0]);
    removeContentItem(content,collection,0);
    assert.deepEqual(content.experiences[0],{...before,[relation]:[]});
    if(collection==='tools')assert.deepEqual(content.toolGroups[0].toolIds,[]);
  }
  const original=structuredClone(c);
  for(const index of [-1,1,0.5,NaN])assert.equal(removeContentItem(c,'experiences',index),undefined);
  assert.deepEqual(c,original);
  removeContentItem(c,'experiences',0);
  assert.equal(c.experiences.length,0);
  assert.deepEqual(c.portfolio,original.portfolio);
});
