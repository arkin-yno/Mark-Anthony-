// Upgrade older saved content in memory. The owner saves these additions through
// the editor; opening the website never rewrites the database or existing text.
export function normalizeContent(input) {
  const c = structuredClone(input);
  if (!c || typeof c !== 'object') return c;
  if (Array.isArray(c.tools)) c.tools = c.tools.map((tool, i) =>
    typeof tool === 'string'
      ? { id: `tool-${i + 1}`, name: tool, logo: '', description: '', url: '' }
      : { id: `tool-${i + 1}`, logo: '', description: '', url: '', ...tool });
  if (Array.isArray(c.services)) c.services = collectionWithIds(c.services, 'service')
    .map(service => ({ overview: '', image: '', blocks: [], ...service }));
  if (Array.isArray(c.testimonials)) c.testimonials = c.testimonials.map(testimonial =>
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
