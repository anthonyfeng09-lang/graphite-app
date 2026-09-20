// Creates a new email/password account. Passwords are hashed with bcrypt
// before ever touching storage - the plaintext password is used once, in
// memory, to compute the hash, and then discarded.

const bcrypt = require('bcryptjs');
const { redisConfig, redisCmd } = require('../_lib/redis');
const { genToken, setSessionCookie } = require('../_lib/session');
const { isValidEmail, normalizeEmail, getUser, saveUser, publicUser } = require('../_lib/users');

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

    var name = (body.name || '').toString().trim().slice(0, 80);
    var email = normalizeEmail(body.email);
    var password = (body.password || '').toString();
    var birthday = (body.birthday || '').toString().slice(0, 10); // YYYY-MM-DD

    if (!name) { res.status(400).json({ ok: false, error: 'Please enter your name' }); return; }
    if (!isValidEmail(email)) { res.status(400).json({ ok: false, error: 'Please enter a valid email address' }); return; }
    if (password.length < 8) { res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' }); return; }

    var existing = await getUser(redisCmd, cfg, email);
    if (existing) {
      res.status(409).json({ ok: false, error: existing.provider === 'google'
        ? 'That email already has a Google account - use "Continue with Google" instead.'
        : 'An account with that email already exists' });
      return;
    }

    var passwordHash = await bcrypt.hash(password, 10);
    var user = { name: name, email: email, passwordHash: passwordHash, birthday: birthday || null, provider: 'password', createdAt: Date.now() };
    await saveUser(redisCmd, cfg, user);

    var token = genToken();
    await redisCmd(cfg, ['SET', 'graphite:session:' + token, email, 'EX', 60 * 60 * 24 * 30]);
    setSessionCookie(res, token);

    res.status(200).json({ ok: true, user: publicUser(user) });
  } catch (err) {
    res.status(200).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
};
