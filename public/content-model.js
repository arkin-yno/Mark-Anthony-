// Upgrade older saved content in memory. The owner saves these additions through
// the editor; opening the website never rewrites the database or existing text.
export function normalizeContent(input) {
  const c = structuredClone(input);
  if (!c || typeof c !== 'object') return c;
  if (Array.isArray(c.tools)) c.tools = c.tools.map((tool, i) =>
    typeof tool === 'string'
      ? { id: `tool-${i + 1}`, name: tool, logo: '', description: '', url: '' }
      : { id: `tool-${i + 1}`, logo: '', description: '', url: '', ...tool });
  if (Array.isArray(c.services)) c.services = c.services.map((service, i) =>
    ({ id: `service-${i + 1}`, ...service }));
  if (Array.isArray(c.testimonials)) c.testimonials = c.testimonials.map(testimonial =>
    ({ ...testimonial, serviceIds: testimonial.serviceIds ?? [] }));
  c.portfolio ??= [];
  c.aboutPhotos ??= [];
  c.toolGroups ??= [];
  // Keep the original three profile links intact and bring them into the
  // flexible social editor only when no new-style social list has been saved.
  c.socialLinks ??= ['linkedin', 'facebook', 'instagram']
    .filter(name => c.profile?.[name])
    .map(name => ({ id: `social-${name}`, label: { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram' }[name], url: c.profile[name], logo: '' }));
  return c;
}

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
