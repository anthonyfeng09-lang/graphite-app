// Shared Redis-compatible REST helper (Vercel KV or Upstash Redis, both expose
// this same REST/pipeline shape). Used by analytics AND accounts.
// Files under api/_lib/ are ignored by Vercel's serverless build (the leading
// underscore excludes them), so this is safe as a plain shared module.

function redisConfig() {
  var url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  var token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  return { url: url, token: token };
}

async function redisPipeline(cfg, commands) {
  var resp = await fetch(cfg.url + '/pipeline', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + cfg.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  });
  if (!resp.ok) throw new Error('Redis pipeline failed: ' + resp.status);
  return resp.json();
}

// Convenience wrapper for a single command, e.g. redisCmd(cfg, ['GET','k']).
async function redisCmd(cfg, command) {
  var results = await redisPipeline(cfg, [command]);
  return results[0];
}

module.exports = { redisConfig: redisConfig, redisPipeline: redisPipeline, redisCmd: redisCmd };

