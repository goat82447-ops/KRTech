const assert = require("node:assert/strict");
const test = require("node:test");
const compileHandler = require("../api/compile");

const originalFetch = global.fetch;
const envNames = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "JUDGE0_API_URL", "JUDGE0_API_TOKEN"];
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

function configure() {
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "anon-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
  process.env.JUDGE0_API_URL = "https://judge0.test";
  process.env.JUDGE0_API_TOKEN = "judge-test";
}

function request(method, body, query = {}, cookie = "visual_pro_session=valid-token") {
  return {
    method,
    body,
    query,
    headers: { cookie, "content-type": "application/json" },
  };
}

function setupFetch({ tier = "Pro", submission = { token: "submission-1" }, result = null } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, options });
    if (parsed.pathname === "/auth/v1/user") return response({ id: "user-123" });
    if (parsed.pathname === "/rest/v1/entitlements") return response(tier ? [{ tier }] : []);
    if (parsed.pathname === "/submissions" && options.method === "POST") return response(submission, 201);
    if (parsed.pathname.startsWith("/submissions/")) return response(result || {
      status: { id: 3, description: "Accepted" },
      stdout: "[0,1]\n",
      time: "0.01",
      memory: 2048,
    });
    throw new Error(`Unexpected request: ${options.method || "GET"} ${parsed.href}`);
  };
  return calls;
}

test.afterEach(() => {
  global.fetch = originalFetch;
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

test("compiler submissions are Pro-gated and send bounded execution settings to Judge0", async () => {
  configure();
  const calls = setupFetch();
  const res = mockResponse();
  await compileHandler(request("POST", {
    language: "python",
    sourceCode: "print('hello')",
    stdin: "",
    expectedOutput: "hello",
  }), res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.token, "submission-1");
  assert.equal(res.headers["Cache-Control"], "private, no-store, max-age=0");
  const providerCall = calls.find(call => call.url.pathname === "/submissions");
  assert.equal(providerCall.options.headers["X-Auth-Token"], "judge-test");
  const submitted = JSON.parse(providerCall.options.body);
  assert.equal(submitted.language_id, 71);
  assert.equal(submitted.enable_network, false);
  assert.equal(submitted.cpu_time_limit, 2);
  assert.equal(submitted.expected_output, "hello");
});

test("compiler rejects anonymous and non-Pro requests before contacting Judge0", async () => {
  configure();
  const calls = setupFetch({ tier: "L1" });
  const noSession = mockResponse();
  await compileHandler(request("POST", {}, {}, ""), noSession);
  assert.equal(noSession.statusCode, 401);

  const nonPro = mockResponse();
  await compileHandler(request("POST", {}), nonPro);
  assert.equal(nonPro.statusCode, 403);
  assert.equal(calls.some(call => call.url.hostname === "judge0.test"), false);
});

test("compiler validates the language and source/input/output sizes", async () => {
  configure();
  setupFetch();

  for (const body of [
    { language: "javascript", sourceCode: "code", stdin: "", expectedOutput: "" },
    { language: "java", sourceCode: "x".repeat(32 * 1024 + 1), stdin: "", expectedOutput: "" },
    { language: "java", sourceCode: "code", stdin: "x".repeat(8 * 1024 + 1), expectedOutput: "" },
    { language: "java", sourceCode: "code", stdin: "", expectedOutput: "x".repeat(8 * 1024 + 1) },
  ]) {
    const res = mockResponse();
    await compileHandler(request("POST", body), res);
    assert.equal(res.statusCode, 400);
  }
});

test("compiler polling returns normalized accepted, compile-error, and timeout states", async () => {
  configure();
  setupFetch();
  for (const [providerResult, state] of [
    [{ status: { id: 3, description: "Accepted" }, stdout: "[0,1]\n", time: "0.01", memory: 2048 }, "pass"],
    [{ status: { id: 6, description: "Compilation Error" }, compile_output: "syntax error" }, "compile_error"],
    [{ status: { id: 5, description: "Time Limit Exceeded" } }, "timed_out"],
  ]) {
    setupFetch({ result: providerResult });
    const res = mockResponse();
    await compileHandler(request("GET", undefined, { token: "submission-1" }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.state, state);
  }
});
