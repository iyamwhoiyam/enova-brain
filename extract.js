// Vercel serverless function — POST /api/extract
// ------------------------------------------------------------------
// Server-side proxy for Enova Brain Studio's formulation intake, so the
// Anthropic API key NEVER ships inside the client HTML. The app posts
// { model, max_tokens, messages } here; this forwards to Anthropic with the
// server-held key and returns the response verbatim (the app parses content[]).
//
// SET THIS IN VERCEL → Project → Settings → Environment Variables:
//   ANTHROPIC_API_KEY   (required)  your Anthropic key
//   ANTHROPIC_MODEL     (optional)  a model id valid for your account
//
// The app is pointed here by putting  /api/extract  in the intake ⚙ AI Settings.
// (Function timeout is set in vercel.json so large uploads don't get cut off.)

export default async function handler(req, res) {
  // Same-origin needs no CORS, but stay permissive in case the app is hosted elsewhere.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'enova-extract-proxy',
      keyConfigured: !!process.env.ANTHROPIC_API_KEY });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server misconfigured: ANTHROPIC_API_KEY is not set.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request: "messages" array is required.' });
  }

  const payload = {
    model: process.env.ANTHROPIC_MODEL || body.model || 'claude-sonnet-4-5',
    max_tokens: Math.min(Number(body.max_tokens) || 2500, 8000),
    messages: body.messages,
  };
  if (body.system) payload.system = body.system;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();           // pass Anthropic's body through verbatim
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (err) {
    return res.status(502).json({
      error: 'Upstream request failed.',
      detail: String((err && err.message) || err).slice(0, 300),
    });
  }
}
