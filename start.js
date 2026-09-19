// Kicks off Google's OAuth Authorization Code flow. Requires GOOGLE_CLIENT_ID
// and GOOGLE_CLIENT_SECRET to be set in the Vercel project's env vars (create
// an OAuth client in Google Cloud Console, "Web application" type, with
// https://<your-domain>/api/auth/google/callback added as an authorized
// redirect URI).

const crypto = require('crypto');

module.exports = async (req, res) => {
  var clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(200).send('Google sign-in is not set up on the server yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your Vercel project settings.');
    return;
  }

  var proto = req.headers['x-forwarded-proto'] || 'https';
  var redirectUri = proto + '://' + req.headers.host + '/api/auth/google/callback';
  var state = crypto.randomBytes(16).toString('hex');

  res.setHeader('Set-Cookie', 'graphite_oauth_state=' + state + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600');

  var params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: state,
    prompt: 'select_account'
  });

  res.writeHead(302, { Location: 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString() });
  res.end();
};
