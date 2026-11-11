const crypto = require("node:crypto");
const {
  hasLocalProAccess,
  isLocalDevelopmentRequest,
  localProCookieValue,
} = require("./_shared");

const COOKIE_NAME = "kr7_local_pro";
const ACCESS_TTL_SECONDS = 8 * 60 * 60;

function setCookie(res, value, maxAge) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`);
}

function safeEqualText(actual, expected) {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Host");
  const enabled = isLocalDevelopmentRequest(req)
    && Boolean(process.env.LOCAL_PRO_ACCESS_PIN)
    && Boolean(process.env.LOCAL_PRO_ACCESS_SECRET)
    && process.env.LOCAL_PRO_ACCESS_SECRET.length >= 32;
  if (!enabled) {
    if (req.method === "GET") return res.status(404).json({ enabled: false });
    return res.status(404).json({ error: "Local testing unlock is only available on a configured local development server." });
  }

  if (req.method === "GET") {
    return res.status(200).json({ enabled: true, active: hasLocalProAccess(req) });
  }
  if (req.method === "DELETE") {
    setCookie(res, "", 0);
    return res.status(200).json({ enabled: false });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const pin = req.body?.pin;
  if (typeof pin !== "string" || !safeEqualText(pin, process.env.LOCAL_PRO_ACCESS_PIN)) {
    return res.status(401).json({ error: "The testing PIN is incorrect." });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TTL_SECONDS;
  setCookie(res, localProCookieValue(expiresAt), ACCESS_TTL_SECONDS);
  return res.status(200).json({ enabled: true, expiresAt });
};
