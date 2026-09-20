// Tells the app whether the current browser has a valid, live session -
// checked against the server-side session record, never trusting anything
// the client claims about itself.

const { redisConfig, redisCmd } = require('../_lib/redis');
const { parseCookies, SESSION_COOKIE } = require('../_lib/session');
const { getUser, publicUser } = require('../_lib/users');

module.exports = async (req, res) => {
  try {
    var cfg = redisConfig();
    if (!cfg.url || !cfg.token) { res.status(200).json({ ok: true, user: null }); return; }

    var cookies = parseCookies(req);
    var token = cookies[SESSION_COOKIE];
    if (!token) { res.status(200).json({ ok: true, user: null }); return; }

    var sess = await redisCmd(cfg, ['GET', 'graphite:session:' + token]);
    if (!sess || !sess.result) { res.status(200).json({ ok: true, user: null }); return; }

    var user = await getUser(redisCmd, cfg, sess.result);
    if (!user) { res.status(200).json({ ok: true, user: null }); return; }

    res.status(200).json({ ok: true, user: publicUser(user) });
  } catch (err) {
    res.status(200).json({ ok: true, user: null });
  }
};
