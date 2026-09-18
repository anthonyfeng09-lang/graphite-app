// Starts a real Stripe Checkout session for one of the three AI plans and
// redirects the browser straight to Stripe's hosted payment page. Nothing
// card-related ever touches this code or this server - Stripe handles all
// of that on its own page.
//
// Requires these Vercel project environment variables (Project Settings ->
// Environment Variables), set from your own Stripe account:
//   STRIPE_SECRET_KEY      - your Stripe secret key (starts with sk_live_ or sk_test_)
//   STRIPE_PRICE_CASUAL    - the Price ID for the Casual plan (starts with price_)
//   STRIPE_PRICE_REGULAR   - the Price ID for the Regular plan
//   STRIPE_PRICE_UNLIMITED - the Price ID for the Unlimited plan
//
// Each Price must be a recurring monthly price on a Product you create in
// the Stripe Dashboard (Product catalog -> Add product).

const Stripe = require('stripe');

const PRICE_ENV_BY_PLAN = {
  casual: 'STRIPE_PRICE_CASUAL',
  regular: 'STRIPE_PRICE_REGULAR',
  unlimited: 'STRIPE_PRICE_UNLIMITED'
};

module.exports = async (req, res) => {
  try {
    const plan = String(req.query.plan || '').toLowerCase();
    const priceEnvName = PRICE_ENV_BY_PLAN[plan];
    if (!priceEnvName) {
      res.status(400).send('Unknown plan "' + plan + '". Expected casual, regular, or unlimited.');
      return;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env[priceEnvName];
    if (!secretKey || !priceId) {
      res.status(500).send(
        'This deployment is missing ' + (!secretKey ? 'STRIPE_SECRET_KEY' : priceEnvName) +
        ' in its Vercel environment variables. Add it in Project Settings -> Environment Variables, then redeploy.'
      );
      return;
    }

    const stripe = Stripe(secretKey);
    const origin = 'https://' + req.headers.host;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: origin + '/?session_id={CHECKOUT_SESSION_ID}&plan=' + encodeURIComponent(plan),
      cancel_url: origin + '/?checkout=cancelled'
    });

    res.writeHead(303, { Location: session.url });
    res.end();
  } catch (err) {
    res.status(500).send('Could not start checkout: ' + (err && err.message ? err.message : String(err)));
  }
};
