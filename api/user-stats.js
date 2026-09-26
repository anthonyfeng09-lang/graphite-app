// Returns anonymous visitor counts (total / this year / this month / today)
// for the Terms & Privacy tab. Only counts, never personal data.

const { redisConfig, redisPipeline } = require('./_lib/redis');

function pad(n) { return n < 10 ? '0' + n : '' + n; }

module.exports = async (req, res) => {
  try {
    var cfg = redisConfig();
    if (!cfg.url || !cfg.token) { res.status(200).json({ ok: false, error: 'Analytics store not configured on the server' }); return; }
    var now = new Date();
    var y = now.getUTCFullYear(), m = pad(now.getUTCMonth() + 1), d = pad(now.getUTCDate());
    var results = await redisPipeline(cfg, [
      ['SCARD', 'graphite:visits:total'],
      ['SCARD', 'graphite:visits:year:' + y],
      ['SCARD', 'graphite:visits:month:' + y + '-' + m],
      ['SCARD', 'graphite:visits:day:' + y + '-' + m + '-' + d]
    ]);
    var c = results.map(function (r) { return (r && typeof r.result === 'number') ? r.result : 0; });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, total: c[0], year: c[1], month: c[2], day: c[3] });
  } catch (err) {
    res.status(200).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
};
