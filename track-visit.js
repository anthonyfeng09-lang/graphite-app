// Records one anonymous visit toward total / yearly / monthly / daily unique
// user counts. Uses a Redis-compatible REST store (Vercel KV or Upstash Redis
// both expose this same REST shape) so it works from a stateless serverless
// function. No personal data is stored, just a random id the browser already
// generated for itself (see graphite.anonId in the app).

function redisConfig() {
  var url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  var token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url: url, token: token };
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

async function redisPipeline(cfg, commands) {
  var resp = await fetch(cfg.url + '/pipeline', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + cfg.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  });
  if (!resp.ok) throw new Error('Redis pipeline failed: ' + resp.status);
  return resp.json();
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST only' }); return; }

    var cfg = redisConfig();
    if (!cfg.url || !cfg.token) {
      // No datastore configured yet - fail soft so the app itself never breaks.
      res.status(200).json({ ok: false, error: 'Analytics store not configured on the server' });
      return;
    }

    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    var anonId = (body.anonId || '').toString().slice(0, 64);
    if (!anonId) { res.status(400).json({ ok: false, error: 'Missing anonId' }); return; }

    var now = new Date();
    var y = now.getUTCFullYear();
    var m = pad(now.getUTCMonth() + 1);
    var d = pad(now.getUTCDate());
    var dayKey = 'graphite:visits:day:' + y + '-' + m + '-' + d;
    var monthKey = 'graphite:visits:month:' + y + '-' + m;
    var yearKey = 'graphite:visits:year:' + y;
    var totalKey = 'graphite:visits:total';

    await redisPipeline(cfg, [
      ['SADD', totalKey, anonId],
      ['SADD', yearKey, anonId],
      ['SADD', monthKey, anonId],
      ['SADD', dayKey, anonId],
      ['EXPIRE', dayKey, 60 * 60 * 24 * 45],
      ['EXPIRE', monthKey, 60 * 60 * 24 * 400],
      ['EXPIRE', yearKey, 60 * 60 * 24 * 400 * 2]
    ]);

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
};
