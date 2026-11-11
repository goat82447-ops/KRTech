const { authenticatedUser, sendError, supabaseRest } = require("../_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const user = await authenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Sign in required." });
    const admins = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
    const profile = await supabaseRest(
      `profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`,
    );
    if (!admins.includes(user.id) && profile?.[0]?.is_admin !== true) {
      return res.status(403).json({ error: "Administrator access required." });
    }
    const { userId, tier, active } = req.body || {};
    if (
      typeof userId !== "string" ||
      !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(userId) ||
      !["L1", "L2", "L3", "Pro"].includes(tier) ||
      typeof active !== "boolean"
    ) {
      return res.status(400).json({ error: "Provide a target user, valid tier, and active boolean." });
    }
    const records = await supabaseRest(
      `entitlements?user_id=eq.${encodeURIComponent(userId)}&tier=eq.${tier}&select=id`,
    );
    const current = records?.[0];
    if (current) {
      await supabaseRest(`entitlements?id=eq.${current.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          active,
          revoked_at: active ? null : new Date().toISOString(),
        }),
      });
    } else if (active) {
      await supabaseRest("entitlements", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: userId, tier, active: true, granted_at: new Date().toISOString() }),
      });
    } else {
      return res.status(404).json({ error: "No entitlement exists for that user and tier." });
    }
    return res.status(200).json({ userId, tier, active });
  } catch (error) {
    return sendError(res, error);
  }
};
