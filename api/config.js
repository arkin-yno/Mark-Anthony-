export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Website setup is incomplete. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel, then redeploy.' });
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) return res.status(503).json({ error: 'The Supabase Project URL is invalid.' });
  if (!key.startsWith('sb_publishable_')) return res.status(503).json({ error: 'Use the Supabase publishable key, not a secret or service-role key.' });
  return res.status(200).json({ mode: 'supabase', url: url.replace(/\/$/, ''), key });
}
