// Shared user-record helpers, backed by the same Redis-compatible store as
// everything else. A user record lives at graphite:user:<lowercased email> as
// a JSON blob: { name, email, passwordHash?, birthday?, provider, createdAt }.
// passwordHash is only present for password accounts; Google accounts never
// have one, and the plain password itself is never stored anywhere.

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email);
}

function normalizeEmail(email) {
  return (email || '').toString().trim().toLowerCase().slice(0, 160);
}

function userKey(email) {
  return 'graphite:user:' + normalizeEmail(email);
}

async function getUser(redisCmd, cfg, email) {
  var rec = await redisCmd(cfg, ['GET', userKey(email)]);
  if (!rec || !rec.result) return null;
  try { return JSON.parse(rec.result); } catch (e) { return null; }
}

async function saveUser(redisCmd, cfg, user) {
  await redisCmd(cfg, ['SET', userKey(user.email), JSON.stringify(user)]);
}

function publicUser(user) {
  if (!user) return null;
  return { name: user.name, email: user.email, birthday: user.birthday || null, provider: user.provider };
}

module.exports = {
  isValidEmail: isValidEmail,
  normalizeEmail: normalizeEmail,
  userKey: userKey,
  getUser: getUser,
  saveUser: saveUser,
  publicUser: publicUser
};
