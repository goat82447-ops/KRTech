const { authenticatedUser, required, sendError, supabaseRest } = require("../_shared");

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
  if (!response.ok || !payload.access_token) throw new Error("PayPal authentication failed.");
  return payload.access_token;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const user = await authenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Sign in before completing PayPal checkout." });
    const { orderId } = req.body || {};
    if (typeof orderId !== "string" || !/^[A-Z0-9-]{10,40}$/i.test(orderId)) {
      return res.status(400).json({ error: "A valid PayPal order ID is required." });
    }

    const purchases = await supabaseRest(
      `payments?provider=eq.paypal&provider_reference=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,status,amount_minor,currency`,
    );
    const purchase = purchases?.[0];
    if (!purchase) return res.status(404).json({ error: "No PayPal checkout belongs to this account." });
    if (purchase.status === "paid") return res.status(200).json({ status: "paid" });
    if (purchase.status !== "pending") return res.status(409).json({ error: "This PayPal purchase is not pending." });

    const base = paypalBase();
    const token = await paypalToken(base);
    const captureResponse = await fetch(
      `${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": purchase.id,
        },
        body: "{}",
      },
    );
    let order = await captureResponse.json();
    if (!captureResponse.ok) {
      const orderResponse = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      order = await orderResponse.json();
      if (!orderResponse.ok || order.status !== "COMPLETED") {
        throw new Error("PayPal could not complete this order capture.");
      }
    }
    if (order.status !== "COMPLETED") {
      return res.status(409).json({ error: "PayPal has not completed the order capture." });
    }

    const units = order.purchase_units || [];
    const captures = units.flatMap(unit => unit.payments?.captures || []);
    if (
      units.length !== 1 ||
      units[0].reference_id !== purchase.id ||
      captures.length !== 1 ||
      captures[0].status !== "COMPLETED" ||
      !/^\d+\.\d{2}$/.test(captures[0].amount?.value || "") ||
      Math.round(Number(captures[0].amount.value) * 100) !== purchase.amount_minor ||
      captures[0].amount.currency_code !== purchase.currency
    ) {
      throw new Error("Captured PayPal payment does not match the pending purchase.");
    }

    return res.status(200).json({ status: "captured", message: "Waiting for signed webhook verification." });
  } catch (error) {
    return sendError(res, error);
  }
};
