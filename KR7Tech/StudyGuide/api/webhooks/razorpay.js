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
    const supplied = req.headers["x-razorpay-signature"] || "";
    const expected = crypto.createHmac("sha256", required("RAZORPAY_WEBHOOK_SECRET")).update(body).digest("hex");
    if (!safeEqualHex(supplied, expected)) return res.status(401).send("Invalid webhook signature.");
    const event = JSON.parse(body.toString("utf8"));
    if (event.event === "payment_link.paid") {
      const link = event.payload?.payment_link?.entity;
      const notes = link?.notes || {};
      if (link?.status !== "paid" || !Number.isSafeInteger(link.amount_paid)) {
        return res.status(400).send("Razorpay payment link is not fully paid.");
      }
      if (link.reference_id !== notes.payment_id) {
        return res.status(400).send("Razorpay purchase references do not match.");
      }
      await markPaymentPaid(
        "razorpay",
        link.id,
        notes.payment_id,
        notes.tier,
        notes.user_id,
        link.amount_paid,
        link.currency,
      );
    }
    return res.status(200).send("ok");
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
