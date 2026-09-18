// Called by the app right after Stripe redirects a customer back from
// Checkout. Confirms with Stripe (server-to-server, using the secret key -
// never trust anything the browser itself claims about payment) that this
// specific session really was paid, and reports which plan was bought.

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
    const sessionId = req.query.session_id;
    if (!sessionId) { res.status(400).json({ ok: false, error: 'Missing session_id' }); return; }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) { res.status(500).json({ ok: false, error: 'Missing STRIPE_SECRET_KEY on the server' }); return; }

    const stripe = Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });

    if (session.status !== 'complete' || session.payment_status === 'unpaid') {
      res.status(200).json({ ok: false, error: 'This checkout was not completed.' });
      return;
    }

    const priceMap = planPriceMap();
    var plan = null;
    var items = (session.line_items && session.line_items.data) || [];
    for (var i = 0; i < items.length; i++) {
      var priceId = items[i].price && items[i].price.id;
      if (priceId && priceMap[priceId]) { plan = priceMap[priceId]; break; }
    }
    if (!plan) {
      res.status(200).json({ ok: false, error: 'Paid, but the price purchased did not match a known plan.' });
      return;
    }

    res.status(200).json({
      ok: true,
      plan: plan,
      customerId: session.customer || null
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
};
