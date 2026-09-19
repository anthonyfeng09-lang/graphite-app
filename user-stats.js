// Returns anonymous, aggregate user counts (total / this year / this month /
// today) for display inside the app. No per-user or personal data is ever
// returned, just counts. Backed by the same Redis-compatible REST store as
// track-visit.js.

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
    var cfg = redisConfig();
    if (!cfg.url || !cfg.token) {
      res.status(200).json({ ok: false, error: 'Analytics store not configured on the server' });
      return;
    }

    var now = new Date();
    var y = now.getUTCFullYear();
    var m = pad(now.getUTCMonth() + 1);
    var d = pad(now.getUTCDate());
    var dayKey = 'graphite:visits:day:' + y + '-' + m + '-' + d;
    var monthKey = 'graphite:visits:month:' + y + '-' + m;
    var yearKey = 'graphite:visits:year:' + y;
    var totalKey = 'graphite:visits:total';

    var results = await redisPipeline(cfg, [
      ['SCARD', totalKey],
      ['SCARD', yearKey],
      ['SCARD', monthKey],
      ['SCARD', dayKey]
    ]);

    var counts = results.map(function (r) { return (r && typeof r.result === 'number') ? r.result : 0; });

    res.status(200).json({
      ok: true,
      total: counts[0] || 0,
      year: counts[1] || 0,
      month: counts[2] || 0,
      day: counts[3] || 0
    });
  } catch (err) {
    res.status(200).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
};
