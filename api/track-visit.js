// Records one anonymous visit toward total / yearly / monthly / daily unique
// visitor counts. No personal data: just a random id the browser made for
// itself (graphite.anonId in the app).

const { redisConfig, redisPipeline } = require('./_lib/redis');

function pad(n) { return n < 10 ? '0' + n : '' + n; }

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST only' }); return; }
    var cfg = redisConfig();
    if (!cfg.url || !cfg.token) { res.status(200).json({ ok: false, error: 'Analytics store not configured on the server' }); return; }

    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    var anonId = (body.anonId || '').toString().slice(0, 64);
    if (!anonId) { res.status(400).json({ ok: false, error: 'Missing anonId' }); return; }

    var now = new Date();
    var y = now.getUTCFullYear(), m = pad(now.getUTCMonth() + 1), d = pad(now.getUTCDate());
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
      ['EXPIRE', yearKey, 60 * 60 * 24 * 800]
    ]);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(200).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
};
