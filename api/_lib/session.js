// Shared session/cookie helpers for the account system. Sessions are opaque
// random tokens stored server-side in Redis (graphite:session:<token> -> email),
// never a JWT the client could tamper with. The cookie itself only carries the
// token, is HttpOnly + Secure + SameSite=Lax, and is meaningless without the
// matching server-side record. Excluded from Vercel's function build by the
// leading underscore on this folder.

const crypto = require('crypto');

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Fallback cookie parser - Vercel's Node runtime usually populates req.cookies
// already, but this keeps things working even if that's ever not the case.
function parseCookies(req) {
  if (req.cookies && typeof req.cookies === 'object') return req.cookies;
  var header = (req.headers && req.headers.cookie) || '';
  var out = {};
  header.split(';').forEach(function (pair) {
    var idx = pair.indexOf('=');
    if (idx === -1) return;
    var k = pair.slice(0, idx).trim();
    var v = pair.slice(idx + 1).trim();
    if (k) { try { out[k] = decodeURIComponent(v); } catch (e) { out[k] = v; } }
  });
  return out;
}

function cookieString(name, value, maxAgeSeconds) {
  var parts = [name + '=' + value, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax'];
  parts.push('Max-Age=' + maxAgeSeconds);
  return parts.join('; ');
}

const SESSION_COOKIE = 'graphite_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function setSessionCookie(res, token, extraCookies) {
  var cookies = [cookieString(SESSION_COOKIE, token, SESSION_MAX_AGE)];
  if (extraCookies) cookies = cookies.concat(extraCookies);
  res.setHeader('Set-Cookie', cookies);
}

function clearSessionCookie(res, extraCookies) {
  var cookies = [cookieString(SESSION_COOKIE, '', 0)];
  if (extraCookies) cookies = cookies.concat(extraCookies);
  res.setHeader('Set-Cookie', cookies);
}

module.exports = {
  genToken: genToken,
  parseCookies: parseCookies,
  cookieString: cookieString,
  setSessionCookie: setSessionCookie,
  clearSessionCookie: clearSessionCookie,
  SESSION_COOKIE: SESSION_COOKIE,
  SESSION_MAX_AGE: SESSION_MAX_AGE
};

