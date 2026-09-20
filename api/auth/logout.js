const { redisConfig, redisCmd } = require('../_lib/redis');
const { parseCookies, clearSessionCookie, SESSION_COOKIE } = require('../_lib/session');

module.exports = async (req, res) => {
  try {
    var cookies = parseCookies(req);
    var token = cookies[SESSION_COOKIE];
    var cfg = redisConfig();
    if (token && cfg.url && cfg.token) {
      await redisCmd(cfg, ['DEL', 'graphite:session:' + token]);
    }
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  } catch (err) {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  }
};
