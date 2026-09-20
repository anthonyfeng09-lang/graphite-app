const bcrypt = require('bcryptjs');
const { redisConfig, redisCmd } = require('../_lib/redis');
const { genToken, setSessionCookie } = require('../_lib/session');
const { normalizeEmail, getUser, publicUser } = require('../_lib/users');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST only' }); return; }

    var cfg = redisConfig();
    if (!cfg.url || !cfg.token) {
      res.status(200).json({ ok: false, error: 'Accounts are not set up on the server yet' });
      return;
    }

    var body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    var email = normalizeEmail(body.email);
    var password = (body.password || '').toString();

    var user = await getUser(redisCmd, cfg, email);
    if (!user) { res.status(401).json({ ok: false, error: 'Incorrect email or password' }); return; }
    if (!user.passwordHash) {
      res.status(401).json({ ok: false, error: 'That account uses Google sign-in - use "Continue with Google" instead.' });
      return;
    }

    var match = await bcrypt.compare(password, user.passwordHash);
    if (!match) { res.status(401).json({ ok: false, error: 'Incorrect email or password' }); return; }

    var token = genToken();
    await redisCmd(cfg, ['SET', 'graphite:session:' + token, email, 'EX', 60 * 60 * 24 * 30]);
    setSessionCookie(res, token);

    res.status(200).json({ ok: true, user: publicUser(user) });
  } catch (err) {
    res.status(200).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
};
