// Periodic re-check called from the app to confirm a previously-unlocked
// subscription is still active (e.g. the customer didn't cancel). Stripe
// itself is the source of truth here - nothing is stored in a database.

const Stripe = require('stripe');

function planPriceMap() {
  var map = {};
  if (process.env.STRIPE_PRICE_CASUAL) map[process.env.STRIPE_PRICE_CASUAL] = 'casual';
  if (process.env.STRIPE_PRICE_REGULAR) map[process.env.STRIPE_PRICE_REGULAR] = 'regular';
  if (process.env.STRIPE_PRICE_UNLIMITED) map[process.env.STRIPE_PRICE_UNLIMITED] = 'unlimited';
  return map;
}

module.exports = async (req, res) => {
  try {
    const customerId = req.query.customer_id;
    if (!customerId) { res.status(400).json({ ok: false, error: 'Missing customer_id' }); return; }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) { res.status(500).json({ ok: false, error: 'Missing STRIPE_SECRET_KEY on the server' }); return; }

    const stripe = Stripe(secretKey);
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 10 });

    if (!subs.data.length) {
      res.status(200).json({ ok: true, active: false });
      return;
    }

    const priceMap = planPriceMap();
    var plan = null;
    var sub = subs.data[0];
    var items = (sub.items && sub.items.data) || [];
    for (var i = 0; i < items.length; i++) {
      var priceId = items[i].price && items[i].price.id;
      if (priceId && priceMap[priceId]) { plan = priceMap[priceId]; break; }
    }

    res.status(200).json({ ok: true, active: true, plan: plan });
  } catch (err) {
    res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
};
