const { required, sendError } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  try {
    const paypalAmounts = {
      L1: process.env.PAYPAL_L1_USD || null,
      L2: process.env.PAYPAL_L2_USD || null,
      L3: process.env.PAYPAL_L3_USD || null,
      Pro: process.env.PAYPAL_PRO_USD || null,
    };
    const providerReady = {
      razorpay: Boolean(
        process.env.RAZORPAY_KEY_ID &&
        process.env.RAZORPAY_KEY_SECRET &&
        process.env.RAZORPAY_WEBHOOK_SECRET,
      ),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      paypal: Boolean(
        process.env.PAYPAL_CLIENT_ID &&
        process.env.PAYPAL_CLIENT_SECRET &&
        process.env.PAYPAL_WEBHOOK_ID &&
        Object.values(paypalAmounts).every(amount => amount && /^\d+\.\d{2}$/.test(amount)),
      ),
    };
    return res.status(200).json({
      supabaseUrl: required("SUPABASE_URL"),
      supabaseAnonKey: required("SUPABASE_ANON_KEY"),
      providers: providerReady,
      plans: { L1: 500, L2: 500, L3: 500, Pro: 1500 },
      paypalAmounts,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
