// Upgrade older saved content in memory. The owner saves these additions through
// the editor; opening the website never rewrites the database or existing text.
export function normalizeContent(input) {
  const c = structuredClone(input);
  if (!c || typeof c !== 'object') return c;
  if (Array.isArray(c.tools)) c.tools = collectionWithIds(c.tools.map(tool =>
    typeof tool === 'string'
      ? { name: tool, logo: '', description: '', url: '' }
      : { logo: '', description: '', url: '', ...tool }), 'tool');
  if (Array.isArray(c.services)) c.services = collectionWithIds(c.services, 'service')
    .map(service => ({ overview: '', image: '', blocks: [], ...service }));
  if (Array.isArray(c.testimonials)) c.testimonials = collectionWithIds(c.testimonials, 'testimonial').map(testimonial =>
    ({ ...testimonial, serviceIds: testimonial.serviceIds ?? [] }));
  c.portfolio ??= [];
  if (Array.isArray(c.portfolio)) c.portfolio = collectionWithIds(c.portfolio, 'portfolio')
    .map(item => ({ ...item, serviceIds: item.serviceIds ?? [] }));
  if (Array.isArray(c.projects)) c.projects = collectionWithIds(c.projects, 'project')
    .map(item => ({ ...item, serviceIds: item.serviceIds ?? [] }));
  c.aboutPhotos ??= [];
  c.toolGroups ??= [];
  // Keep the original three profile links intact and bring them into the
  // flexible social editor only when no new-style social list has been saved.
  c.socialLinks ??= ['linkedin', 'facebook', 'instagram']
    .filter(name => c.profile?.[name])
    .map(name => ({ id: `social-${name}`, label: { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram' }[name], url: c.profile[name], logo: '' }));
  c.process ??= structuredClone(starterProcess);
  if (Array.isArray(c.process.steps)) c.process.steps = collectionWithIds(c.process.steps, 'process')
    .map(step => ({ serviceIds: [], ...step }));
  c.experiences ??= [];
  if (Array.isArray(c.experiences)) c.experiences = collectionWithIds(c.experiences, 'experience')
    .map(item => ({ name: '', kind: 'company', role: '', period: '', location: '', description: '', highlights: '', image: '', url: '',
      serviceIds: [], portfolioIds: [], projectIds: [], toolIds: [], testimonialIds: [], processStepIds: [], postIds: [], links: [], ...item }));
  return c;
}

function collectionWithIds(rows, prefix) {
  const used = new Set(rows.filter(row => typeof row?.id === 'string' && row.id).map(row => row.id));
  return rows.map((row, i) => {
    if (typeof row?.id === 'string' && row.id) return row;
    const base = `${prefix}-${i + 1}`;
    let id = base, suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return { ...row, id };
  });
}

export const starterProcess = {
  heading: 'My Process',
  intro: 'A clear, collaborative way to turn your goals into work that moves your business forward.',
  steps: [
    { id: 'process-discover', title: 'Discover', description: 'Start with your business, your goals, and the areas where you need support.', icon: 'target' },
    { id: 'process-plan', title: 'Plan', description: 'Agree on priorities, tasks, timelines, and what a successful outcome looks like.', icon: 'layers' },
    { id: 'process-execute', title: 'Execute', description: 'Put the plan into action, with clear communication and visibility into progress.', icon: 'bolt' },
    { id: 'process-improve', title: 'Improve', description: 'Review the work, gather feedback, and refine the next steps together.', icon: 'chart' }
  ]
};

export function toolsForService(content, serviceId) {
  const ids = new Set(content.toolGroups
    .filter(group => group.serviceIds.includes(serviceId))
    .flatMap(group => group.toolIds));
  return content.tools.filter(tool => ids.has(tool.id));
}

export function testimonialsForService(content, serviceId = '') {
  return serviceId
    ? content.testimonials.filter(testimonial => testimonial.serviceIds.includes(serviceId))
    : content.testimonials;
}

export function workForService(content, collection, serviceId) {
  return content[collection].filter(item => item.serviceIds.includes(serviceId));
}

export function processStepsForService(content, serviceId = '', query = '') {
  const search = String(query).trim().toLocaleLowerCase();
  return content.process.steps.filter(step => {
    if (serviceId && !step.serviceIds.includes(serviceId)) return false;
    if (!search) return true;
    const services = content.services.filter(service => step.serviceIds.includes(service.id));
    return [step.title, step.description, ...services.map(service => service.title)]
      .join(' ').toLocaleLowerCase().includes(search);
  });
}

export function experiencesForService(content, serviceId = '') {
  return serviceId
    ? content.experiences.filter(experience => experience.serviceIds.includes(serviceId))
    : content.experiences;
}

// Remove the record and its connections together so renaming/reordering never
// turns a saved association into a link to a different item.
export function removeContentItem(content, collection, index) {
  const rows = collection === 'process.steps' ? content.process?.steps : content[collection];
  if (!Array.isArray(rows) || !Number.isInteger(index) || index < 0 || index >= rows.length) return;
  const [removed] = rows.splice(index, 1);
  if (!removed?.id) return removed;
  const unlink = (items, key) => {
    if (Array.isArray(items)) items.forEach(item => {
      if (Array.isArray(item[key])) item[key] = item[key].filter(id => id !== removed.id);
    });
  };
  if (collection === 'services') {
    for (const key of ['portfolio', 'projects', 'toolGroups', 'testimonials', 'experiences']) unlink(content[key], 'serviceIds');
    unlink(content.process?.steps, 'serviceIds');
  }
  if (collection === 'tools') unlink(content.toolGroups, 'toolIds');
  const relation = { services: 'serviceIds', portfolio: 'portfolioIds', projects: 'projectIds', tools: 'toolIds',
    testimonials: 'testimonialIds', 'process.steps': 'processStepIds', posts: 'postIds' }[collection];
  if (relation) unlink(content.experiences, relation);
  return removed;
}

export function serviceTasks(service) {
  return service.details.split(/\s*·\s*|\r?\n/).map(task => task.trim()).filter(Boolean);
}

export function externalWebsiteUrl(value) {
  const s = String(value || '').trim();
  const lower = s.toLowerCase();
  const absolute = lower.startsWith('https://') || lower.startsWith('http://');
  if (!s || (/^[a-z][a-z0-9+.-]*:/i.test(s) && !absolute)) return '';
  try {
    const u = new URL(absolute ? s : 'https://' + s);
    return ['https:', 'http:'].includes(u.protocol) && u.hostname.includes('.') ? u.href : '';
  } catch { return ''; }
}
