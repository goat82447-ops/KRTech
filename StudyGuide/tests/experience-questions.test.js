const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const experienceQuestionsHandler = require("../api/experience-questions");

const seedFile = path.join(__dirname, "..", "experience-questions-seed.sql");
const originalFetch = global.fetch;
const envNames = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));

function response(data, status = 200) {
  const text = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => text,
  };
}

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(value) { this.body = value; return this; },
  };
}

function fixtureQuestions() {
  return [
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `question-${index}`,
      topic: "C# / .NET",
      experience_band: "6-10 years",
      question: `Question ${index}`,
      answer: `Answer ${index}`,
      example: `Example ${index}`,
      company_tags: ["TCS", "Microsoft"],
      is_free: index >= 10,
    })),
    ...["Azure", "SQL"].map(topic => ({
      id: `${topic}-question`,
      topic,
      experience_band: "6-10 years",
      question: `${topic} question`,
      answer: `${topic} answer`,
      example: `${topic} example`,
      is_free: false,
    })),
  ];
}

function configure() {
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "anon-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
}

async function getQuestions({ tier = null, token = null, query = { topic: "C# / .NET", level: "6-10 years" }, fixture = fixtureQuestions() } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ parsed, options });
    if (parsed.pathname === "/auth/v1/user") return response({ id: "user-123" });
    if (parsed.pathname === "/rest/v1/entitlements") return response(tier ? [{ tier, active: true }] : []);
    if (parsed.pathname === "/rest/v1/experience_questions") {
      let questions = fixture;
      const topic = parsed.searchParams.get("topic");
      const level = parsed.searchParams.get("experience_band");
      if (topic) questions = questions.filter(question => question.topic === topic.replace(/^eq\./, ""));
      if (level) questions = questions.filter(question => question.experience_band === level.replace(/^eq\./, ""));
      return response(questions);
    }
    throw new Error(`Unexpected request ${options.method || "GET"} ${parsed.href}`);
  };
  const req = {
    method: "GET",
    query,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
  const res = mockResponse();
  await experienceQuestionsHandler(req, res);
  return { res, calls };
}

test.afterEach(() => {
  global.fetch = originalFetch;
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

test("experience seed applies the first-ten-per-topic preview policy", () => {
  const rows = fs.readFileSync(seedFile, "utf8").split(/\r?\n/)
    .filter(line => line.startsWith("('") && line.includes(" years', '"));
  const seed = fs.readFileSync(seedFile, "utf8");
  assert.equal(rows.length, 216);
  assert.match(seed, /company_tags text\[\] not null default '\{\}'/);
  assert.match(seed, /partition by topic, experience_band/i);
  assert.match(seed, /level_position asc/i);
  assert.match(seed, /partition by topic/i);
  assert.match(seed, /topic_position <= 10/);
  const topics = [
    "C# / .NET", "Angular", "Azure", "SQL", "System Design", "JavaScript / TypeScript",
    "EF Core", "LINQ", "Behavioral", "ASP.NET Core", "REST APIs", "Testing",
    "Data Structures & Algorithms", "DevOps", "Identity & Security", "Microservices",
  ];
  for (const topic of topics) {
    const topicRows = rows.filter(line => line.startsWith(`('${topic.replaceAll("'", "''")}',`));
    assert.ok([12, 16].includes(topicRows.length), `${topic} has a complete question bank`);
    for (const level of ["0-2 years", "3-5 years", "6-10 years", "10+ years"]) {
      const track = rows.filter(line => line.startsWith(`('${topic.replaceAll("'", "''")}', '${level}'`));
      assert.ok([3, 4].includes(track.length), `${topic} at ${level}`);
    }
  }
  assert.match(seed, /array\['TCS', 'Infosys', 'Accenture'\]/);
  assert.match(seed, /array\['Microsoft', 'Amazon', 'Google'\]/);
});

test("home page presents KR7Tech beginner-to-senior learning paths and keeps interview Q&A working", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const client = fs.readFileSync(path.join(__dirname, "..", "interview-experience.js"), "utf8");
  assert.match(html, /id="interview-qa"/);
  assert.match(html, /KR7Tech/);
  assert.match(html, /Students &amp; beginners/);
  assert.match(html, /Working engineers &amp; senior professionals/);
  assert.match(html, /Learn with Krishna at KR7Tech/);
  assert.match(html, /href="C%23Dotnet\.html"/);
  assert.match(html, /href="AZURECICD\.html"/);
  assert.match(html, /href="System-Design\.html"/);
  assert.match(html, /href="Company-Interviews\.html#access-heading"/);
  assert.match(html, /Live cohort schedules and separate course pricing are not yet published here\./);
  assert.match(html, /id="experience-company"/);
  for (const topic of ["EF Core", "LINQ", "Behavioral", "ASP.NET Core", "REST APIs", "Testing", "Data Structures &amp; Algorithms", "DevOps", "Identity &amp; Security", "Microservices"]) {
    assert.ok(html.includes(`<option>${topic}</option>`), `${topic} is selectable`);
  }
  assert.match(html, /not claims that an employer asked that exact question/);
  assert.match(client, /location\.protocol === "file:"/);
  assert.match(client, /experience-questions-seed\.sql/);
  assert.match(client, /experience-company-tags/);
  assert.match(client, /dataset\.localProUnlock/);
  assert.doesNotMatch(client, /const localBank\s*=/);
  assert.match(client, /experience-locked-preview/);
  assert.doesNotMatch(client, /function renderLocked\(question\)[\s\S]*?question\.question/);
});

test("anonymous users receive the first ten questions per topic but not later answers", async () => {
  configure();
  const { res, calls } = await getQuestions();
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.deepEqual(res.body.questions.map(question => question.id), ["question-0", "question-1", "question-10", "question-11", "question-2", "question-3", "question-4", "question-5", "question-6", "question-7"]);
  assert.deepEqual(res.body.questions[0].company_tags, ["TCS", "Microsoft"]);
  assert.deepEqual(res.body.locked, [
    { id: "question-8", topic: "C# / .NET", company_tags: ["TCS", "Microsoft"] },
    { id: "question-9", topic: "C# / .NET", company_tags: ["TCS", "Microsoft"] },
  ]);
  assert.equal(JSON.stringify(res.body).includes("Question 8"), false);
  assert.equal(JSON.stringify(res.body).includes("Answer 8"), false);
  const query = calls.find(call => call.parsed.pathname === "/rest/v1/experience_questions")?.parsed;
  assert.equal(query.searchParams.get("topic"), "eq.C# / .NET");
  assert.equal(query.searchParams.has("experience_band"), false);
});

test("the free preview includes questions from every experience level", async () => {
  configure();
  const levels = ["0-2 years", "3-5 years", "6-10 years", "10+ years"];
  const fixture = levels.flatMap(level => Array.from({ length: 3 }, (_, index) => ({
    id: `${level}-${index}`,
    topic: "C# / .NET",
    experience_band: level,
    question: `Question ${index + 1}`,
    answer: `Answer ${index + 1}`,
    example: `Example ${index + 1}`,
    company_tags: ["TCS"],
  })));
  const { res } = await getQuestions({ fixture, query: { topic: "C# / .NET", level: "10+ years" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.questions.length, 2);
  assert.equal(res.body.locked.length, 1);
  assert.deepEqual(res.body.locked[0], {
    id: "10+ years-2",
    topic: "C# / .NET",
    company_tags: ["TCS"],
  });
});

test("Pro members receive all experience-specific answers", async () => {
  configure();
  const { res } = await getQuestions({ tier: "Pro", token: "valid-token" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.questions.map(question => question.id), ["question-0", "question-1", "question-10", "question-11", "question-2", "question-3", "question-4", "question-5", "question-6", "question-7", "question-8", "question-9"]);
  assert.deepEqual(res.body.locked, []);
  assert.equal(res.body.access.premium, true);
});

test("All subjects returns every question for the selected experience level across topics", async () => {
  configure();
  const { res, calls } = await getQuestions({ query: { topic: "All subjects", level: "6-10 years" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.questions.length, 12);
  assert.deepEqual(new Set(res.body.questions.map(question => question.topic)), new Set(["C# / .NET", "Azure", "SQL"]));
  assert.deepEqual(res.body.locked.map(question => question.topic), ["C# / .NET", "C# / .NET"]);
  const query = calls.find(call => call.parsed.pathname === "/rest/v1/experience_questions")?.parsed;
  assert.equal(query.searchParams.has("topic"), false);
  assert.equal(query.searchParams.has("experience_band"), false);
});

test("non-Pro tiers cannot unlock experience-specific premium answers", async () => {
  configure();
  const { res } = await getQuestions({ tier: "L1", token: "valid-token" });
  assert.deepEqual(res.body.questions.map(question => question.id), ["question-0", "question-1", "question-10", "question-11", "question-2", "question-3", "question-4", "question-5", "question-6", "question-7"]);
  assert.equal(res.body.locked.length, 2);
  assert.equal(res.body.access.premium, false);
});

test("experience question API rejects invalid topic, level, and method", async () => {
  configure();
  for (const topic of [
    "C# / .NET", "Angular", "Azure", "SQL", "System Design", "JavaScript / TypeScript",
    "EF Core", "LINQ", "Behavioral", "ASP.NET Core", "REST APIs", "Testing",
    "Data Structures & Algorithms", "DevOps", "Identity & Security", "Microservices",
  ]) {
    const supported = await getQuestions({ query: { topic, level: "0-2 years" } });
    assert.equal(supported.res.statusCode, 200, topic);
  }

  const invalid = mockResponse();
  await experienceQuestionsHandler({ method: "GET", headers: {}, query: { topic: "Unknown", level: "6-10 years" } }, invalid);
  assert.equal(invalid.statusCode, 400);

  const invalidLevel = mockResponse();
  await experienceQuestionsHandler({ method: "GET", headers: {}, query: { topic: "Azure", level: "expert" } }, invalidLevel);
  assert.equal(invalidLevel.statusCode, 400);

  const method = mockResponse();
  await experienceQuestionsHandler({ method: "POST", headers: {} }, method);
  assert.equal(method.statusCode, 405);
  assert.equal(method.headers.Allow, "GET");
});
