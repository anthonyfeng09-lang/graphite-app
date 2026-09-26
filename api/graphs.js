// Saved graphs for the signed-in account, so they show up on every device.
// GET returns the account's saved graphs, PUT replaces them. Stored in the
// same Redis store as accounts, at graphite:graphs:<email>.

const { redisConfig, redisCmd } = require('./_lib/redis');
const { parseCookies, SESSION_COOKIE } = require('./_lib/session');
const { normalizeEmail } = require('./_lib/users');

const MAX_BYTES = 900 * 1024; // stays under Upstash's 1 MB request limit

async function sessionEmail(cfg, req) {
  var token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  var sess = await redisCmd(cfg, ['GET', 'graphite:session:' + token]);
  return sess && sess.result ? normalizeEmail(sess.result) : null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    var cfg = redisConfig();
    if (!cfg.url || !cfg.token) { res.status(503).json({ ok: false, error: 'Accounts are not set up on the server yet.' }); return; }
    var email = await sessionEmail(cfg, req);
    if (!email) { res.status(401).json({ ok: false, error: 'Please sign in.' }); return; }
    var key = 'graphite:graphs:' + email;

    if (req.method === 'GET') {
      var rec = await redisCmd(cfg, ['GET', key]);
      var data = { items: [], folders: [] };
      if (rec && rec.result) { try { data = JSON.parse(rec.result); } catch (e) {} }
      res.status(200).json({ ok: true, data: data });
      return;
    }
    if (req.method === 'PUT') {
      var body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      var payload = body && body.data;
      if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items) || !Array.isArray(payload.folders)) {
        res.status(400).json({ ok: false, error: 'Bad saved graphs data.' }); return;
      }
      var json = JSON.stringify(payload);
      if (json.length > MAX_BYTES) {
        res.status(413).json({ ok: false, error: 'Your saved graphs are too big to sync (pictures take a lot of space). Delete a few and try again.' }); return;
      }
      await redisCmd(cfg, ['SET', key, json]);
      res.status(200).json({ ok: true });
      return;
    }
    res.setHeader('Allow', 'GET, PUT');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Could not reach your saved graphs.' });
  }
};
