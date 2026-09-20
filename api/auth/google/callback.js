// Google redirects back here with a one-time code. We exchange it for tokens,
// fetch the person's basic profile (name + email only), find-or-create their
// Graphite account, and start a normal session - after this point a Google
// account works exactly like a password account, just without a password.

const { redisConfig, redisCmd } = require('../../_lib/redis');
const { genToken, parseCookies, cookieString, SESSION_MAX_AGE } = require('../../_lib/session');
const { normalizeEmail, getUser, saveUser } = require('../../_lib/users');

module.exports = async (req, res) => {
  try {
    var clientId = process.env.GOOGLE_CLIENT_ID;
    var clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(200).send('Google sign-in is not set up on the server yet.');
      return;
    }

    var url = new URL(req.url, 'https://' + req.headers.host);
    var code = url.searchParams.get('code');
    var state = url.searchParams.get('state');
    var error = url.searchParams.get('error');
    var cookies = parseCookies(req);

    if (error) { res.writeHead(302, { Location: '/?authError=' + encodeURIComponent(error) }); res.end(); return; }
    if (!code || !state || state !== cookies.graphite_oauth_state) {
      res.writeHead(302, { Location: '/?authError=state_mismatch' }); res.end(); return;
    }

    var proto = req.headers['x-forwarded-proto'] || 'https';
    var redirectUri = proto + '://' + req.headers.host + '/api/auth/google/callback';

    var tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    if (!tokenResp.ok) { res.writeHead(302, { Location: '/?authError=token_exchange' }); res.end(); return; }
    var tokenData = await tokenResp.json();

    var profileResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token }
    });
    if (!profileResp.ok) { res.writeHead(302, { Location: '/?authError=profile_fetch' }); res.end(); return; }
    var profile = await profileResp.json();
    var email = normalizeEmail(profile.email);
    if (!email) { res.writeHead(302, { Location: '/?authError=no_email' }); res.end(); return; }

    var cfg = redisConfig();
    if (!cfg.url || !cfg.token) { res.status(200).send('Accounts are not set up on the server yet.'); return; }

    var user = await getUser(redisCmd, cfg, email);
    if (!user) {
      user = { name: profile.name || email.split('@')[0], email: email, provider: 'google', createdAt: Date.now() };
      await saveUser(redisCmd, cfg, user);
    }

    var token = genToken();
    await redisCmd(cfg, ['SET', 'graphite:session:' + token, email, 'EX', SESSION_MAX_AGE]);

    res.setHeader('Set-Cookie', [
      cookieString('graphite_session', token, SESSION_MAX_AGE),
      cookieString('graphite_oauth_state', '', 0)
    ]);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    res.writeHead(302, { Location: '/?authError=' + encodeURIComponent('unexpected') });
    res.end();
  }
};
