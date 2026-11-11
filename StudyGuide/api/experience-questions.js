const { authenticatedUser, getEntitlements, hasLocalProAccess, sendError, supabaseRest } = require("./_shared");

const TOPICS = new Set([
  "All subjects",
  "C# / .NET",
  "Angular",
  "Azure",
  "SQL",
  "System Design",
  "JavaScript / TypeScript",
  "EF Core",
  "LINQ",
  "Behavioral",
  "ASP.NET Core",
  "REST APIs",
  "Testing",
  "Data Structures & Algorithms",
  "DevOps",
  "Identity & Security",
  "Microservices",
]);
const LEVELS = new Set(["0-2 years", "3-5 years", "6-10 years", "10+ years"]);
const FREE_QUESTIONS_PER_TOPIC = 10;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const topic = typeof req.query?.topic === "string" ? req.query.topic : "";
  const level = typeof req.query?.level === "string" ? req.query.level : "";
  if (!TOPICS.has(topic) || !LEVELS.has(level)) {
    return res.status(400).json({ error: "Choose a supported technology and experience range." });
  }

  try {
    const user = await authenticatedUser(req);
    const entitlements = user ? await getEntitlements(user.id) : [];
    const isPro = entitlements.some(item => item.tier === "Pro" && item.active !== false) || hasLocalProAccess(req);
    const topicFilter = topic === "All subjects" ? "" : `topic=eq.${encodeURIComponent(topic)}&`;
    const query = `experience_questions?${topicFilter}select=id,topic,experience_band,question,answer,example,company_tags&order=topic.asc,question.asc,id.asc`;
    const results = await supabaseRest(query);
    const questionsByTopic = new Map();
    for (const question of results) {
      if (!questionsByTopic.has(question.topic)) questionsByTopic.set(question.topic, new Map());
      const byLevel = questionsByTopic.get(question.topic);
      if (!byLevel.has(question.experience_band)) byLevel.set(question.experience_band, []);
      byLevel.get(question.experience_band).push(question);
    }
    const orderedResults = [];
    for (const topicName of [...questionsByTopic.keys()].sort()) {
      const byLevel = questionsByTopic.get(topicName);
      for (const questions of byLevel.values()) {
        questions.sort((left, right) => left.question.localeCompare(right.question) || left.id.localeCompare(right.id));
      }
      const maxQuestionsAtLevel = Math.max(...[...byLevel.values()].map(questions => questions.length));
      for (let position = 0; position < maxQuestionsAtLevel; position++) {
        for (const levelName of LEVELS) {
          const question = byLevel.get(levelName)?.[position];
          if (question) orderedResults.push(question);
        }
      }
    }
    const topicCounts = new Map();
    const freeIds = new Set();
    for (const question of orderedResults) {
      const count = topicCounts.get(question.topic) || 0;
      if (count < FREE_QUESTIONS_PER_TOPIC) freeIds.add(question.id);
      topicCounts.set(question.topic, count + 1);
    }
    const selected = orderedResults.filter(question => question.experience_band === level);
    const available = selected
      .filter(question => isPro || freeIds.has(question.id))
      .map(question => ({ ...question, is_free: freeIds.has(question.id) }));
    const locked = isPro
      ? []
      : selected
        .filter(question => !freeIds.has(question.id))
        .map(({ id, topic, company_tags }) => ({ id, topic, company_tags }));

    return res.status(200).json({
      questions: available,
      locked,
      access: { signedIn: Boolean(user), premium: isPro },
      topic,
      level,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
