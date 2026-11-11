const { getEntitlements, hasLocalProAccess, sendError, supabaseRest, supabaseUrl } = require("./_shared");

const COMPANY = "React";
const TOPIC = "React Machine Coding";

function sessionCookie(req) {
  const raw = req.headers.cookie || "";
  const value = raw.split(";").map(item => item.trim())
    .find(item => item.startsWith("visual_pro_session="))
    ?.slice("visual_pro_session=".length);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

async function userFromCookie(req) {
  const token = sessionCookie(req);
  if (!token) return null;
  const response = await fetch(supabaseUrl("/auth/v1/user"), {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.id === "string" ? user : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await userFromCookie(req);
    const entitlements = user ? await getEntitlements(user.id) : [];
    const isPro = entitlements.some(item => item.tier === "Pro" && item.active !== false) || hasLocalProAccess(req);
    const questions = await supabaseRest(
      `questions?company=eq.${encodeURIComponent(COMPANY)}&topic=eq.${encodeURIComponent(TOPIC)}&select=id,company,topic,question,answer,example,is_free&order=question.asc`,
    );
    const freeQuestions = questions.filter(question => question.is_free).slice(0, 10);
    const freeIds = new Set(freeQuestions.map(question => question.id));
    const premiumQuestions = questions.filter(question => !freeIds.has(question.id));
    const visibleQuestions = isPro ? [...freeQuestions, ...premiumQuestions] : freeQuestions;
    const locked = isPro ? [] : premiumQuestions.map(({ id }) => ({ id }));

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    return res.status(200).json({
      questions: visibleQuestions,
      locked,
      total: questions.length,
      freeCount: freeQuestions.length,
      access: { signedIn: Boolean(user), premium: isPro },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
