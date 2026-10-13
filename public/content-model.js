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
  const storedSteps = [...(Array.isArray(c.process.steps) ? c.process.steps : []),
    ...(Array.isArray(c.process.workflows) ? c.process.workflows.flatMap(workflow => Array.isArray(workflow.steps) ? workflow.steps : []) : [])];
  const usedStepIds = new Set(storedSteps.filter(step => typeof step?.id === 'string' && step.id).map(step => step.id));
  if (Array.isArray(c.process.steps)) c.process.steps = collectionWithIds(c.process.steps, 'process', usedStepIds);
  // Older content assigned individual steps to several services. Convert those
  // assignments once into independent complete workflows, retaining the order
  // and text and expanding experience links to the independently editable copies.
  const migratedStepIds = new Map();
  if (c.process.workflows === undefined) {
    c.process.workflows = [];
    if (Array.isArray(c.process.steps)) {
      const general = [], workflows = new Map();
      for (const step of c.process.steps) {
        const services = (c.services || []).filter(service => Array.isArray(step.serviceIds) && step.serviceIds.includes(service.id));
        const copy = { ...step };
        if (step.serviceIds === undefined || (Array.isArray(step.serviceIds) && step.serviceIds.every(id => typeof id === 'string' && id))) delete copy.serviceIds;
        if (!services.length) { general.push(copy); continue; }
        const copies = [];
        services.forEach((service, index) => {
          if (!workflows.has(service.id)) workflows.set(service.id, { id: `workflow-${service.id}`, serviceId: service.id, heading: '', intro: '', steps: [] });
          const id = index === 0 ? step.id : availableId(`${step.id}-${service.id}`, usedStepIds);
          workflows.get(service.id).steps.push({ ...copy, id });
          copies.push(id);
        });
        migratedStepIds.set(step.id, copies);
      }
      c.process.steps = general;
      c.process.workflows = (c.services || []).flatMap(service => workflows.has(service.id) ? [workflows.get(service.id)] : []);
    }
  }
  if (Array.isArray(c.process.workflows)) c.process.workflows = collectionWithIds(c.process.workflows, 'workflow')
    .map(workflow => ({ heading: '', intro: '', steps: [], ...workflow,
      ...(Array.isArray(workflow.steps) ? { steps: collectionWithIds(workflow.steps, `process-${workflow.id}`, usedStepIds) } : {}) }));
  c.experiences ??= [];
  if (Array.isArray(c.experiences)) c.experiences = collectionWithIds(c.experiences, 'experience')
    .map(item => ({ name: '', kind: 'company', role: '', period: '', location: '', description: '', highlights: '', image: '', url: '',
      serviceIds: [], portfolioIds: [], projectIds: [], toolIds: [], testimonialIds: [], processStepIds: [], postIds: [], links: [], ...item }));
  if (migratedStepIds.size && Array.isArray(c.experiences)) c.experiences.forEach(item => {
    if (Array.isArray(item.processStepIds)) item.processStepIds = [...new Set(item.processStepIds.flatMap(id => migratedStepIds.get(id) || [id]))];
  });
  return c;
}

function availableId(base, used) {
  let id = base, suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

function collectionWithIds(rows, prefix, reserved = new Set()) {
  const used = new Set([...reserved, ...rows.filter(row => typeof row?.id === 'string' && row.id).map(row => row.id)]);
  return rows.map((row, i) => {
    if (typeof row?.id === 'string' && row.id) return row;
    const id = availableId(`${prefix}-${i + 1}`, used);
    reserved.add(id);
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

export function processWorkflows(content, serviceId = '', query = '') {
  const search = String(query).trim().toLocaleLowerCase();
  const general = { id: 'general', serviceId: '', heading: 'General process', intro: '', steps: content.process.steps };
  const workflows = [...(!serviceId && general.steps.length ? [general] : []), ...content.process.workflows.filter(workflow =>
    workflow.steps.length && content.services.some(service => service.id === workflow.serviceId) && (!serviceId || workflow.serviceId === serviceId))];
  return workflows.filter(workflow => !search || [workflow.heading, workflow.intro,
    content.services.find(service => service.id === workflow.serviceId)?.title,
    ...workflow.steps.flatMap(step => [step.title, step.description])].join(' ').toLocaleLowerCase().includes(search));
}

export function processStepsForService(content, serviceId = '', query = '') {
  return processWorkflows(content, serviceId, query).flatMap(workflow => workflow.steps);
}

export function allProcessSteps(content) {
  return [...content.process.steps, ...content.process.workflows.flatMap(workflow => workflow.steps)];
}

export function experiencesForService(content, serviceId = '') {
  return serviceId
    ? content.experiences.filter(experience => experience.serviceIds.includes(serviceId))
    : content.experiences;
}

// Remove the record and its connections together so renaming/reordering never
// turns a saved association into a link to a different item.
export function removeContentItem(content, collection, index) {
  const workflowSteps = /^process\.workflows\.(\d+)\.steps$/.exec(collection);
  const rows = collection === 'process.steps' ? content.process?.steps
    : collection === 'process.workflows' ? content.process?.workflows
    : workflowSteps ? content.process?.workflows?.[Number(workflowSteps[1])]?.steps : content[collection];
  if (!Array.isArray(rows) || !Number.isInteger(index) || index < 0 || index >= rows.length) return;
  const [removed] = rows.splice(index, 1);
  if (!removed?.id) return removed;
  const unlink = (items, key, removedIds = new Set([removed.id])) => {
    if (Array.isArray(items)) items.forEach(item => {
      if (Array.isArray(item[key])) item[key] = item[key].filter(id => !removedIds.has(id));
    });
  };
  if (collection === 'services') {
    for (const key of ['portfolio', 'projects', 'toolGroups', 'testimonials', 'experiences']) unlink(content[key], 'serviceIds');
    unlink(content.process?.steps, 'serviceIds');
    if (Array.isArray(content.process?.workflows)) {
      const removedSteps = new Set(content.process.workflows.filter(workflow => workflow.serviceId === removed.id).flatMap(workflow => workflow.steps.map(step => step.id)));
      content.process.workflows = content.process.workflows.filter(workflow => workflow.serviceId !== removed.id);
      unlink(content.experiences, 'processStepIds', removedSteps);
    }
  }
  if (collection === 'process.workflows') unlink(content.experiences, 'processStepIds', new Set(removed.steps.map(step => step.id)));
  if (workflowSteps) unlink(content.experiences, 'processStepIds');
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
