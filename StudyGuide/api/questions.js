const { authenticatedUser, getEntitlements, hasLocalProAccess, sendError, supabaseRest } = require("./_shared");

const PRO_TIER = "Pro";
const FREE_QUESTIONS_PER_TOPIC = 10;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
  try {
    const user = await authenticatedUser(req);
    const entitlements = user ? await getEntitlements(user.id) : [];
    const grantedTiers = new Set(entitlements.filter(item => item.active !== false).map(item => item.tier));
    const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
    const profile = user
      ? await supabaseRest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`)
      : [];
    const result = await supabaseRest(
      "questions?select=id,company,topic,question,answer,example,access_level,is_free&order=topic.asc,company.asc,id.asc",
    );
    const hasPro = grantedTiers.has(PRO_TIER) || hasLocalProAccess(req);
    const topicCounts = new Map();
    const freeIds = new Set();
    for (const item of result) {
      const count = topicCounts.get(item.topic) || 0;
      if (count < FREE_QUESTIONS_PER_TOPIC) freeIds.add(item.id);
      topicCounts.set(item.topic, count + 1);
    }
    const visible = result.filter(item =>
      hasPro || freeIds.has(item.id),
    );
    const locked = result
      .filter(item => !visible.includes(item))
      .map(({ id, company, topic }) => ({ id, company, topic }));

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    return res.status(200).json({
      questions: visible.map(({ access_level, is_free, ...question }) => question),
      locked,
      access: {
        signedIn: Boolean(user),
        tiers: hasPro ? [...new Set([...grantedTiers, PRO_TIER])] : [...grantedTiers],
        premium: hasPro,
        isAdmin: adminIds.includes(user?.id) || profile?.[0]?.is_admin === true,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
