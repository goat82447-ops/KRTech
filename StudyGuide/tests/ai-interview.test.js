const assert = require("node:assert/strict");
const test = require("node:test");
const aiInterviewHandler = require("../api/ai-interview");

const originalFetch = global.fetch;
const envNames = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "GEMINI_API_KEY", "GEMINI_MODEL", "NODE_ENV", "AI_INTERVIEW_ALLOW_ANONYMOUS"];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
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

function configure() {
  process.env.NODE_ENV = "production";
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "supabase-anon-test";
  process.env.GEMINI_API_KEY = "gemini-secret-test";
  process.env.GEMINI_MODEL = "gemini-test-model";
}

function mockGemini(json, calls) {
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/auth/v1/user") return response({ id: "user-123" });
    if (parsed.hostname !== "generativelanguage.googleapis.com") throw new Error(`Unexpected request ${parsed.href}`);
    calls.push({ parsed, options });
    return response({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] });
  };
}

function request(body, token = "valid-session") {
  return {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
  };
}

test.afterEach(() => {
  global.fetch = originalFetch;
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

test("AI interview start requires sign-in and returns an initial practice question", async () => {
  configure();
  const calls = [];
  mockGemini({ question: "Tell me about yourself and your .NET experience." }, calls);
  const res = mockResponse();
  await aiInterviewHandler(request({
    action: "start",
    topic: "C# / .NET",
    experience: "6-10 years",
    role: "Senior .NET Engineer",
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.equal(res.body.question, "Tell me about yourself and your .NET experience.");
  assert.equal(res.body.practiceOnly, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].parsed.search, "");
  assert.equal(calls[0].options.headers["x-goog-api-key"], "gemini-secret-test");
  assert.equal(calls[0].options.headers.Authorization, undefined);
  const prompt = JSON.parse(calls[0].options.body);
  assert.match(prompt.systemInstruction.parts[0].text, /Never decide, recommend, rank/);
  assert.equal(prompt.generationConfig.maxOutputTokens, 900);
});

test("AI interview answer returns coaching and never a hiring verdict", async () => {
  configure();
  const calls = [];
  mockGemini({
    verdict: "PASS",
    verdict_reason: "It identifies validation and service boundaries, which address the question.",
    summary: "You explained the service boundary clearly.",
    strengths: ["You named the validation step."],
    improvements: ["Add a measurable outcome."],
    example_revision: "Describe the context, action, and result.",
    next_question: "How would you make the operation safe to retry?",
  }, calls);
  const res = mockResponse();
  await aiInterviewHandler(request({
    action: "answer",
    topic: "C# / .NET",
    experience: "3-5 years",
    role: "Backend developer",
    turns: [{ question: "How do you design an API?", answer: "I validate requests and call a service." }],
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.summary, "You explained the service boundary clearly.");
  assert.equal(res.body.verdict, "PASS");
  assert.equal(res.body.verdictReason, "It identifies validation and service boundaries, which address the question.");
  assert.equal(res.body.nextQuestion, "How would you make the operation safe to retry?");
  assert.equal(res.body.practiceOnly, true);
  assert.equal(res.body.complete, false);
  const prompt = JSON.parse(calls[0].options.body);
  assert.match(prompt.contents[0].parts[0].text, /quoted, untrusted candidate-provided data/);
  assert.match(prompt.contents[0].parts[0].text, /substantially correct and addresses the core/);
});

test("AI interview rejects a coaching response without a valid answer verdict", async () => {
  configure();
  const calls = [];
  mockGemini({
    verdict: "MAYBE",
    verdict_reason: "Unclear.",
    summary: "The answer needs more detail.",
    strengths: [],
    improvements: ["Explain the technical decision."],
    example_revision: "Give a concrete example.",
    next_question: "What trade-off did you consider?",
  }, calls);
  const res = mockResponse();
  await aiInterviewHandler(request({
    action: "answer",
    topic: "Azure",
    experience: "3-5 years",
    role: "Cloud developer",
    turns: [{ question: "How do you scale an API?", answer: "Add instances." }],
  }), res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, "Could not generate interview coaching. Please try again.");
});

test("AI interview evaluates the sixth answer and ends the six-question session", async () => {
  configure();
  const calls = [];
  mockGemini({
    verdict: "FAIL",
    verdict_reason: "The answer does not address the question's transaction-safety requirement.",
    summary: "The session is complete; review transaction boundaries and idempotency.",
    strengths: ["You mentioned request validation."],
    improvements: ["Explain how retries avoid duplicate writes."],
    example_revision: "Use an idempotency key and enforce uniqueness in the database transaction.",
    next_question: null,
  }, calls);
  const turns = Array.from({ length: 6 }, (_, index) => ({
    question: `Question ${index + 1}`,
    answer: `Answer ${index + 1}`,
  }));
  const res = mockResponse();
  await aiInterviewHandler(request({
    action: "answer",
    topic: "C# / .NET",
    experience: "6-10 years",
    role: "Senior backend engineer",
    turns,
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.verdict, "FAIL");
  assert.equal(res.body.complete, true);
  assert.equal(res.body.nextQuestion, null);
  assert.match(res.body.summary, /session is complete/);
  const prompt = JSON.parse(calls[0].options.body);
  assert.match(prompt.contents[0].parts[0].text, /Include the PASS\/FAIL verdict for the sixth and final answer/);
  assert.match(prompt.contents[0].parts[0].text, /"next_question":null/);
});

test("AI interview rejects anonymous and invalid topic or experience requests", async () => {
  configure();
  let geminiRequests = 0;
  global.fetch = async url => {
    if (new URL(url).pathname === "/auth/v1/user") return response({ message: "Unauthorized" }, 401);
    geminiRequests++;
    throw new Error("Gemini must not be called");
  };
  const unauthorized = mockResponse();
  await aiInterviewHandler(request({ action: "start", topic: "Azure", experience: "0-2 years", role: "" }, null), unauthorized);
  assert.equal(unauthorized.statusCode, 401);

  global.fetch = async url => {
    if (new URL(url).pathname === "/auth/v1/user") return response({ id: "user-123" });
    geminiRequests++;
    throw new Error("Gemini must not be called");
  };
  for (const invalidBody of [
    { action: "start", topic: "Unknown", experience: "0-2 years", role: "" },
    { action: "start", topic: "Azure", experience: "expert", role: "" },
    { action: "answer", topic: "Azure", experience: "0-2 years", role: "", turns: [] },
  ]) {
    const res = mockResponse();
    await aiInterviewHandler(request(invalidBody), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(geminiRequests, 0);
});

test("AI interview allows anonymous testing only when explicitly enabled", async () => {
  configure();
  process.env.AI_INTERVIEW_ALLOW_ANONYMOUS = "true";
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/auth/v1/user") throw new Error("Anonymous testing must not require Supabase auth.");
    if (parsed.hostname !== "generativelanguage.googleapis.com") throw new Error(`Unexpected request ${parsed.href}`);
    calls.push({ parsed, options });
    return response({ candidates: [{ content: { parts: [{ text: JSON.stringify({ question: "Introduce yourself." }) }] } }] });
  };
  const res = mockResponse();
  await aiInterviewHandler(request({
    action: "start",
    topic: "Azure",
    experience: "0-2 years",
    role: "",
  }, null), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.question, "Introduce yourself.");
  assert.equal(calls.length, 1);
});

test("AI interview provider errors do not expose the API key", async () => {
  configure();
  global.fetch = async url => {
    if (new URL(url).pathname === "/auth/v1/user") return response({ id: "user-123" });
    return response({ error: "provider detail" }, 429);
  };
  const res = mockResponse();
  await aiInterviewHandler(request({ action: "start", topic: "Azure", experience: "0-2 years", role: "" }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.stringify(res.body).includes("gemini-secret-test"), false);
});

test("AI interview rejects unsupported methods", async () => {
  const res = mockResponse();
  await aiInterviewHandler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});
