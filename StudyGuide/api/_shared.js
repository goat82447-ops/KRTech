const crypto = require("node:crypto");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}

function supabaseUrl(path) {
  return `${required("SUPABASE_URL").replace(/\/$/, "")}${path}`;
}

function serviceHeaders(extra = {}) {
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function supabaseRest(path, options = {}) {
  const response = await fetch(supabaseUrl(`/rest/v1/${path}`), {
    ...options,
    headers: serviceHeaders(options.headers || {}),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

async function authenticatedUser(req) {
  const authorization = req.headers.authorization || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const response = await fetch(supabaseUrl("/auth/v1/user"), {
    headers: {
      apikey: required("SUPABASE_ANON_KEY"),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

async function getEntitlements(userId) {
  return supabaseRest(
    `entitlements?user_id=eq.${encodeURIComponent(userId)}&active=eq.true&select=tier`,
  );
}

function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(Buffer.from(req.body));
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safeEqualHex(actual, expected) {
  if (!/^[\da-f]+$/i.test(actual) || !/^[\da-f]+$/i.test(expected)) return false;
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isLocalDevelopmentRequest(req) {
  if (
    process.env.NODE_ENV === "production"
    || process.env.VERCEL_ENV === "production"
    || process.env.LOCAL_PRO_ACCESS_ENABLED !== "true"
  ) return false;
  const host = req.headers.host;
  if (typeof host !== "string") return false;
  let hostname;
  try {
    hostname = new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return false;
  }
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function localProCookieValue(expiresAt) {
  const secret = process.env.LOCAL_PRO_ACCESS_SECRET;
  if (!secret || secret.length < 32) throw new Error("Local Pro access secret must contain at least 32 characters.");
  const signature = crypto.createHmac("sha256", secret).update(`local-pro:${expiresAt}`).digest("hex");
  return `${expiresAt}.${signature}`;
}

function hasLocalProAccess(req) {
  if (!isLocalDevelopmentRequest(req)) return false;
  const secret = process.env.LOCAL_PRO_ACCESS_SECRET;
  if (!secret || secret.length < 32) return false;
  const rawCookie = req.headers.cookie || "";
  const cookie = rawCookie.split(";").map(item => item.trim())
    .find(item => item.startsWith("kr7_local_pro="))
    ?.slice("kr7_local_pro=".length);
  if (!cookie) return false;
  const [expiresAtText, signature, ...rest] = cookie.split(".");
  if (rest.length || !/^\d+$/.test(expiresAtText || "") || !/^[\da-f]{64}$/i.test(signature || "")) return false;
  const expiresAt = Number(expiresAtText);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + 8 * 60 * 60) return false;
  return safeEqualHex(signature, crypto.createHmac("sha256", secret).update(`local-pro:${expiresAt}`).digest("hex"));
}

function sendError(res, error, status = 500) {
  console.error(error);
  return res.status(status).json({ error: status === 500 ? "Request could not be completed." : error });
}

function tierAmount(tier) {
  const amounts = { L1: 50000, L2: 50000, L3: 50000, Pro: 150000 };
  return amounts[tier] || null;
}

function paypalAmountMinor(tier) {
  const amount = process.env[`PAYPAL_${tier.toUpperCase()}_USD`];
  if (!amount || !/^\d+\.\d{2}$/.test(amount)) {
    throw new Error(`Set PAYPAL_${tier.toUpperCase()}_USD to the approved USD price before enabling PayPal.`);
  }
  const amountMinor = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor > 2147483647) {
    throw new Error(`PAYPAL_${tier.toUpperCase()}_USD exceeds the supported payment amount.`);
  }
  return amountMinor;
}

async function markPaymentPaid(provider, providerReference, paymentId, tier, userId, amountMinor, currency) {
  if (!providerReference || !paymentId || !userId || !tier || !Number.isSafeInteger(amountMinor) || !currency) {
    throw new Error("Verified payment details are incomplete.");
  }
  await supabaseRest("rpc/complete_verified_payment", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      p_provider: provider,
      p_provider_reference: providerReference,
      p_payment_id: paymentId,
      p_tier: tier,
      p_user_id: userId,
      p_amount_minor: amountMinor,
      p_currency: currency,
    }),
  });
}

module.exports = {
  authenticatedUser,
  getEntitlements,
  hasLocalProAccess,
  isLocalDevelopmentRequest,
  markPaymentPaid,
  localProCookieValue,
  paypalAmountMinor,
  rawBody,
  required,
  safeEqualHex,
  sendError,
  supabaseRest,
  supabaseUrl,
  tierAmount,
};
