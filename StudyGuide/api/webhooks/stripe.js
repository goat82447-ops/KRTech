const {
  markPaymentPaid,
  rawBody,
  required,
  safeEqualHex,
  sendError,
} = require("../_shared");
const crypto = require("node:crypto");

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed.");
  try {
    const body = await rawBody(req);
    const signatureHeader = req.headers["stripe-signature"] || "";
    const parts = Object.fromEntries(signatureHeader.split(",").map(item => item.split("=", 2)));
    const timestamp = parts.t;
    const signatures = signatureHeader.split(",").filter(part => part.startsWith("v1=")).map(part => part.slice(3));
    const timestampSeconds = Number(timestamp);
    if (
      !Number.isSafeInteger(timestampSeconds) ||
      !signatures.length ||
      Math.abs(Date.now() / 1000 - timestampSeconds) > 300
    ) {
      return res.status(401).send("Invalid or expired webhook signature.");
    }
    const expected = crypto.createHmac("sha256", required("STRIPE_WEBHOOK_SECRET"))
      .update(`${timestamp}.${body.toString("utf8")}`).digest("hex");
    if (!signatures.some(signature => safeEqualHex(signature, expected))) {
      return res.status(401).send("Invalid webhook signature.");
    }
    const event = JSON.parse(body.toString("utf8"));
    if (
      ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type) &&
      event.data?.object?.payment_status === "paid"
    ) {
      const session = event.data.object;
      if (!Number.isSafeInteger(session.amount_total) || typeof session.currency !== "string") {
        return res.status(400).send("Stripe payment amount is missing.");
      }
      await markPaymentPaid(
        "stripe",
        session.id,
        session.metadata?.payment_id,
        session.metadata?.tier,
        session.metadata?.user_id,
        session.amount_total,
        session.currency.toUpperCase(),
      );
    }
    return res.status(200).send("ok");
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
