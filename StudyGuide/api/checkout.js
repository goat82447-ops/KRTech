const {
  authenticatedUser,
  paypalAmountMinor,
  required,
  sendError,
  supabaseRest,
  tierAmount,
} = require("./_shared");

async function createRazorpayLink({ tier, user, paymentId }) {
  const keyId = required("RAZORPAY_KEY_ID");
  const keySecret = required("RAZORPAY_KEY_SECRET");
  const amount = tierAmount(tier);
  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      description: `${tier} study guide access`,
      reference_id: paymentId,
      customer: { email: user.email },
      notify: { email: true, sms: false },
      callback_url: `${required("PUBLIC_APP_URL").replace(/\/$/, "")}/Company-Interviews.html?payment=pending&tier=${encodeURIComponent(tier)}`,
      callback_method: "get",
      notes: { payment_id: paymentId, user_id: user.id, tier },
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.short_url) throw new Error(`Razorpay checkout creation failed: ${JSON.stringify(payload)}`);
  return { url: payload.short_url, reference: payload.id };
}

async function createStripeSession({ tier, user, paymentId }) {
  const secret = required("STRIPE_SECRET_KEY");
  const amount = tierAmount(tier);
  const fields = {
    mode: "payment",
    success_url: `${required("PUBLIC_APP_URL").replace(/\/$/, "")}/Company-Interviews.html?payment=pending&tier=${encodeURIComponent(tier)}`,
    cancel_url: `${required("PUBLIC_APP_URL").replace(/\/$/, "")}/Company-Interviews.html?payment=cancelled`,
    "line_items[0][price_data][currency]": "inr",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": `${tier} study guide access`,
    "line_items[0][quantity]": "1",
    "metadata[payment_id]": paymentId,
    "metadata[user_id]": user.id,
    "metadata[tier]": tier,
  };
  if (user.email) fields.customer_email = user.email;
  const body = new URLSearchParams(fields);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json();
  if (!response.ok || !payload.url) throw new Error(`Stripe checkout creation failed: ${JSON.stringify(payload)}`);
  return { url: payload.url, reference: payload.id };
}

async function paypalAccessToken() {
  const base = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";
  const credentials = Buffer.from(`${required("PAYPAL_CLIENT_ID")}:${required("PAYPAL_CLIENT_SECRET")}`).toString("base64");
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error("PayPal authentication failed.");
  return { base, token: payload.access_token };
}

async function createPayPalOrder({ tier, user, paymentId }) {
  const { base, token } = await paypalAccessToken();
  const amount = process.env[`PAYPAL_${tier.toUpperCase()}_USD`];
  paypalAmountMinor(tier);
  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: paymentId,
        custom_id: `${user.id}:${tier}`,
        description: `${tier} study guide access`,
        amount: { currency_code: "USD", value: amount },
      }],
      application_context: {
        return_url: `${required("PUBLIC_APP_URL").replace(/\/$/, "")}/Company-Interviews.html?payment=pending&tier=${encodeURIComponent(tier)}`,
        cancel_url: `${required("PUBLIC_APP_URL").replace(/\/$/, "")}/Company-Interviews.html?payment=cancelled`,
      },
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`PayPal checkout creation failed: ${JSON.stringify(payload)}`);
  const approval = payload.links?.find(link => link.rel === "approve")?.href;
  if (!approval) throw new Error("PayPal did not return an approval URL.");
  return { url: approval, reference: payload.id };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const user = await authenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Sign in before checkout." });
    const { tier, provider } = req.body || {};
    if (!["L1", "L2", "L3", "Pro"].includes(tier)) {
      return res.status(400).json({ error: "Choose a valid access tier." });
    }
    if (!["razorpay", "stripe", "paypal"].includes(provider)) {
      return res.status(400).json({ error: "Choose a supported payment provider." });
    }
    if (provider === "razorpay") {
      required("RAZORPAY_KEY_ID");
      required("RAZORPAY_KEY_SECRET");
      required("RAZORPAY_WEBHOOK_SECRET");
    } else if (provider === "stripe") {
      required("STRIPE_SECRET_KEY");
      required("STRIPE_WEBHOOK_SECRET");
    } else {
      required("PAYPAL_CLIENT_ID");
      required("PAYPAL_CLIENT_SECRET");
      required("PAYPAL_WEBHOOK_ID");
      paypalAmountMinor(tier);
    }
    const currency = provider === "paypal" ? "USD" : "INR";
    const expectedAmount = provider === "paypal" ? paypalAmountMinor(tier) : tierAmount(tier);
    const pending = await supabaseRest("payments", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: user.id,
        tier,
        provider,
        status: "pending",
        amount_minor: expectedAmount,
        currency,
      }),
    });
    const payment = pending?.[0];
    if (!payment) throw new Error("Could not create a pending purchase record.");
    const create = {
      razorpay: createRazorpayLink,
      stripe: createStripeSession,
      paypal: createPayPalOrder,
    }[provider];
    let checkout;
    try {
      checkout = await create({ tier, user, paymentId: payment.id });
    } catch (error) {
      await supabaseRest(`payments?id=eq.${payment.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "failed" }),
      });
      throw error;
    }
    await supabaseRest(`payments?id=eq.${payment.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ provider_reference: checkout.reference }),
    });
    return res.status(200).json({ checkoutUrl: checkout.url });
  } catch (error) {
    return sendError(res, error);
  }
};
