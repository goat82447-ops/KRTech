const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const reactQuestionsHandler = require("../api/react-machine-coding");

const seedFile = path.join(__dirname, "..", "react-machine-coding-seed.sql");
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

function fixtures() {
  return Array.from({ length: 30 }, (_, index) => ({
    id: `react-${index + 1}`,
    company: "React",
    topic: "React Machine Coding",
    question: `Challenge ${String(index + 1).padStart(2, "0")}`,
    answer: `Detailed implementation for challenge ${index + 1}`,
    example: `Acceptance checks for challenge ${index + 1}`,
    is_free: index < 10,
  }));
}

function configure() {
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "anon-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
}

async function getQuestions({ tier = null, session = false } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push(parsed);
    if (parsed.pathname === "/auth/v1/user") return response({ id: "user-123" });
    if (parsed.pathname === "/rest/v1/entitlements") return response(tier ? [{ tier, active: true }] : []);
    if (parsed.pathname === "/rest/v1/questions") return response(fixtures());
    throw new Error(`Unexpected request ${options.method || "GET"} ${parsed.href}`);
  };
  const req = {
    method: "GET",
    headers: session ? { cookie: "visual_pro_session=valid-token" } : {},
  };
  const res = mockResponse();
  await reactQuestionsHandler(req, res);
  return { res, calls };
}

test.afterEach(() => {
  global.fetch = originalFetch;
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

test("the React seed defines thirty questions with exactly ten free previews", () => {
  const rows = fs.readFileSync(seedFile, "utf8").split(/\r?\n/)
    .filter(line => line.startsWith("('React', 'React Machine Coding'"));
  const free = rows.filter(line => /,\s*true\),?$/.test(line));
  const premium = rows.filter(line => /,\s*false\),?$/.test(line));
  assert.equal(rows.length, 30);
  assert.equal(free.length, 10);
  assert.equal(premium.length, 20);
});

test("anonymous users receive only ten free React challenges and no premium answers", async () => {
  configure();
  const { res, calls } = await getQuestions();
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.equal(res.body.questions.length, 10);
  assert.equal(res.body.locked.length, 20);
  assert.ok(res.body.questions.every(question => question.is_free));
  assert.ok(res.body.locked.every(question => !("question" in question)));
  assert.equal(JSON.stringify(res.body).includes("Challenge 11"), false);
  assert.equal(JSON.stringify(res.body).includes("Detailed implementation for challenge 11"), false);
  assert.equal(JSON.stringify(res.body).includes("Acceptance checks for challenge 11"), false);
  const dataQuery = calls.find(url => url.pathname === "/rest/v1/questions");
  assert.equal(dataQuery.searchParams.get("company"), "eq.React");
  assert.equal(dataQuery.searchParams.get("topic"), "eq.React Machine Coding");
});

test("only active Pro members receive the complete React question bank", async () => {
  configure();
  const { res } = await getQuestions({ tier: "Pro", session: true });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.questions.length, 30);
  assert.equal(res.body.locked.length, 0);
  assert.equal(res.body.access.premium, true);
  assert.equal(res.body.questions.some(question => question.answer.includes("challenge 30")), true);
});

test("non-Pro entitlements do not unlock React premium challenges", async () => {
  configure();
  const { res } = await getQuestions({ tier: "L1", session: true });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.questions.length, 10);
  assert.equal(res.body.locked.length, 20);
  assert.equal(res.body.access.premium, false);
  const page = fs.readFileSync(path.join(__dirname, "..", "React-Machine-Coding.html"), "utf8");
  assert.match(page, /\.question-button\.locked \.title \{[^}]*filter: blur\(/);
  assert.match(page, /question\.locked \? "Pro question · unlock to view" : question\.question/);
});

test("React question API rejects non-GET requests", async () => {
  configure();
  const res = mockResponse();
  await reactQuestionsHandler({ method: "POST", headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "GET");
});
