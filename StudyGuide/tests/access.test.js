const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const questionHandler = require("../api/questions");
const adminHandler = require("../api/admin/entitlements");
const paypalCaptureHandler = require("../api/paypal/capture");
const stripeWebhook = require("../api/webhooks/stripe");
const originalFetch = global.fetch;
const envNames = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ADMIN_USER_IDS",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_BASE_URL",
];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));

function response(data, status = 200) {
  const text = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
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
    send(value) { this.body = value; return this; },
  };
}

function fixtureQuestions() {
  return [
    ...["C# / .NET", "Angular"].flatMap((topic, topicIndex) =>
      Array.from({ length: 12 }, (_, index) => ({
        id: `topic-${topicIndex}-${index}`,
        company: "Microsoft",
        topic,
        question: `${topic} question ${index}`,
        answer: `${topic} answer ${index}`,
        example: "Example",
        is_free: index >= 10,
        access_level: null,
      })),
    ),
  ];
}

async function getQuestions(tiers, token = null) {
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "anon-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
  process.env.ADMIN_USER_IDS = "";
  const user = { id: "user-123", email: "learner@example.test" };
  const data = fixtureQuestions();
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/auth/v1/user") {
      return token ? response(user) : response({ message: "No token" }, 401);
    }
    if (parsed.pathname === "/rest/v1/questions") return response(data);
    if (parsed.pathname === "/rest/v1/entitlements") return response(tiers.map(tier => ({ tier })));
    if (parsed.pathname === "/rest/v1/profiles") return response([{ is_admin: false }]);
    throw new Error(`Unexpected request ${options.method || "GET"} ${url}`);
  };
  const req = { method: "GET", headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = mockResponse();
  await questionHandler(req, res);
  return { res, data };
}

test.afterEach(() => {
  global.fetch = originalFetch;
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

test("the static question page does not embed answers; seed marks the first ten questions per topic free", () => {
  const html = fs.readFileSync(path.join(root, "Company-Interviews.html"), "utf8");
  const seed = fs.readFileSync(path.join(root, "supabase", "seed.sql"), "utf8");
  assert.doesNotMatch(html, /questionBank\s*=\s*\[/);
  assert.match(html, /company-interviews\.js/);
  const rows = seed.split(/\r?\n/).filter(line => line.startsWith("insert into public.questions"));
  assert.equal(rows.length, 96);
  assert.match(seed, /partition by topic/i);
  assert.match(seed, /topic_position <= 10/);
  assert.doesNotMatch(seed, /^\s*delete\s+from/im);
});

test("anonymous users receive the first ten questions per topic, with private no-store caching", async () => {
  const { res } = await getQuestions([]);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.deepEqual(
    res.body.questions.map(question => question.id),
    [...Array.from({ length: 10 }, (_, index) => `topic-0-${index}`),
      ...Array.from({ length: 10 }, (_, index) => `topic-1-${index}`)],
  );
  assert.equal(res.body.locked.length, 4);
  assert.ok(res.body.locked.every(question => !("question" in question)));
  assert.equal(JSON.stringify(res.body).includes("C# / .NET question 10"), false);
  assert.equal(JSON.stringify(res.body).includes("answer 10"), false);
});

test("L1, L2, and L3 entitlements do not bypass the per-topic Pro limit", async () => {
  for (const tier of ["L1", "L2", "L3"]) {
    const { res } = await getQuestions([tier], "valid-token");
    assert.equal(res.body.questions.length, 20);
    assert.equal(res.body.locked.length, 4);
  }
});

test("Pro reveals every question", async () => {
  const { res } = await getQuestions(["Pro"], "valid-token");
  assert.equal(res.body.questions.length, 24);
  assert.deepEqual(res.body.access.tiers, ["Pro"]);
});

test("Stripe webhook requires the raw body and forwards verified purchase values atomically", async () => {
  const secret = "stripe-test-secret";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = JSON.stringify({
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        payment_status: "paid",
        amount_total: 50000,
        currency: "inr",
        metadata: { payment_id: "payment-uuid", tier: "L1", user_id: "user-uuid" },
      },
    },
  });
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  let rpcBody;
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  global.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, "/rest/v1/rpc/complete_verified_payment");
    rpcBody = JSON.parse(options.body);
    return response(null);
  };
  const req = {
    method: "POST",
    headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
    body: Buffer.from(payload),
  };
  const res = mockResponse();
  await stripeWebhook(req, res);
  assert.equal(stripeWebhook.config.api.bodyParser, false);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(rpcBody, {
    p_provider: "stripe",
    p_provider_reference: "cs_test_123",
    p_payment_id: "payment-uuid",
    p_tier: "L1",
    p_user_id: "user-uuid",
    p_amount_minor: 50000,
    p_currency: "INR",
  });
});

test("Stripe rejects an invalid signature without calling the database", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = "stripe-test-secret";
  let called = false;
  global.fetch = async () => { called = true; return response(null); };
  const req = {
    method: "POST",
    headers: { "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` },
    body: Buffer.from('{"type":"checkout.session.completed"}'),
  };
  const res = mockResponse();
  await stripeWebhook(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
});

test("an administrator can revoke an existing entitlement", async () => {
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "anon-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
  let update;
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/auth/v1/user") {
      return response({ id: "admin-uuid", email: "admin@example.test" });
    }
    if (parsed.pathname === "/rest/v1/profiles") return response([{ is_admin: true }]);
    if (parsed.pathname === "/rest/v1/entitlements") {
      if (options.method === "PATCH") {
        update = JSON.parse(options.body);
        return response(null);
      }
      return response([{ id: "entitlement-uuid" }]);
    }
    throw new Error(`Unexpected request ${options.method || "GET"} ${url}`);
  };
  const req = {
    method: "POST",
    headers: { authorization: "Bearer admin-token" },
    body: { userId: "123e4567-e89b-12d3-a456-426614174000", tier: "L2", active: false },
  };
  const res = mockResponse();
  await adminHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.active, false);
  assert.equal(update.active, false);
  assert.ok(update.revoked_at);
});

test("PayPal return captures only the signed-in user's pending order and does not grant access", async () => {
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "anon-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
  process.env.PAYPAL_CLIENT_ID = "client-test";
  process.env.PAYPAL_CLIENT_SECRET = "secret-test";
  process.env.PAYPAL_BASE_URL = "https://paypal.test";
  let rpcCalled = false;
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/auth/v1/user") return response({ id: "user-uuid" });
    if (parsed.pathname === "/rest/v1/payments") {
      return response([{
        id: "payment-uuid",
        status: "pending",
        amount_minor: 500,
        currency: "USD",
      }]);
    }
    if (parsed.pathname === "/v1/oauth2/token") return response({ access_token: "paypal-token" });
    if (parsed.pathname === "/v2/checkout/orders/ORDER-123456789/capture") {
      return response({
        status: "COMPLETED",
        purchase_units: [{
          reference_id: "payment-uuid",
          payments: { captures: [{
            id: "capture-123",
            status: "COMPLETED",
            amount: { value: "5.00", currency_code: "USD" },
          }] },
        }],
      });
    }
    if (parsed.pathname.includes("/rpc/complete_verified_payment")) rpcCalled = true;
    throw new Error(`Unexpected request ${options.method || "GET"} ${url}`);
  };
  const req = {
    method: "POST",
    headers: { authorization: "Bearer user-token" },
    body: { orderId: "ORDER-123456789" },
  };
  const res = mockResponse();
  await paypalCaptureHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "captured");
  assert.equal(rpcCalled, false);
});
