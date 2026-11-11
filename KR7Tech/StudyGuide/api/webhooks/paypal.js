const { markPaymentPaid, required, sendError } = require("../_shared");

function paypalBase() {
  return process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";
}

async function paypalToken(base) {
  const credentials = Buffer.from(
    `${required("PAYPAL_CLIENT_ID")}:${required("PAYPAL_CLIENT_SECRET")}`,
  ).toString("base64");
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error("Could not authenticate with PayPal.");
  return payload.access_token;
}

async function verifyPayPalWebhook(req, event, base, token) {
  const response = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: req.headers["paypal-auth-algo"],
      cert_url: req.headers["paypal-cert-url"],
      transmission_id: req.headers["paypal-transmission-id"],
      transmission_sig: req.headers["paypal-transmission-sig"],
      transmission_time: req.headers["paypal-transmission-time"],
      webhook_id: required("PAYPAL_WEBHOOK_ID"),
      webhook_event: event,
    }),
  });
  const result = await response.json();
  return response.ok && result.verification_status === "SUCCESS";
}

function amountToMinor(amount) {
  if (!amount || !/^\d+\.\d{2}$/.test(amount.value || "")) {
    throw new Error("PayPal returned an invalid captured amount.");
  }
  return Math.round(Number(amount.value) * 100);
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed.");
  try {
    const event = req.body;
    if (!event) return res.status(400).send("Missing PayPal webhook event.");
    const base = paypalBase();
    const token = await paypalToken(base);
    if (!(await verifyPayPalWebhook(req, event, base, token))) {
      return res.status(401).send("Invalid webhook signature.");
    }

    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const capture = event.resource;
      const orderId = capture?.supplementary_data?.related_ids?.order_id;
      if (!orderId || capture?.status !== "COMPLETED") {
        return res.status(400).send("Missing or incomplete PayPal capture.");
      }
      const orderResponse = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok || order.status !== "COMPLETED") {
        return res.status(400).send("PayPal order is not completed.");
      }
      const units = order.purchase_units || [];
      if (units.length !== 1) return res.status(400).send("Unexpected PayPal purchase units.");
      const purchase = units[0];
      const [userId, tier] = (purchase.custom_id || "").split(":");
      const captureRecord = purchase.payments?.captures?.find(item => item.id === capture.id);
      if (!userId || !purchase.reference_id || !captureRecord || captureRecord.status !== "COMPLETED") {
        return res.status(400).send("Invalid PayPal purchase metadata.");
      }
      const amountMinor = amountToMinor(capture.amount);
      if (
        captureRecord.amount?.value !== capture.amount.value ||
        captureRecord.amount?.currency_code !== capture.amount.currency_code
      ) {
        return res.status(400).send("PayPal capture data does not match the order.");
      }
      await markPaymentPaid(
        "paypal",
        orderId,
        purchase.reference_id,
        tier,
        userId,
        amountMinor,
        capture.amount.currency_code,
      );
    }
    return res.status(200).send("ok");
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = handler;
