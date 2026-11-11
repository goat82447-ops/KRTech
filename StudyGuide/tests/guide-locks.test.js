const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const servePage = require("../api/serve-page");

const root = path.join(__dirname, "..");

test("protected guide pages receive the manual-lock controller after Pro access is verified", () => {
  const source = fs.readFileSync(path.join(root, "api", "serve-page.js"), "utf8");
  assert.match(source, /guide-locks\.js/);
  assert.match(source, /withManualLocks/);
  assert.match(source, /PROTECTED_PAGES/);
  assert.match(source, /if \(!isPro\)/);
});

test("visitors receive a course preview rather than the protected lesson content", async () => {
  const response = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    send(value) { this.body = value; return this; },
    redirect(code, value) { this.statusCode = code; this.location = value; return this; },
  };
  await servePage({ query: { page: "C#Dotnet.html" }, headers: {} }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.match(response.body, /C# and \.NET/);
  assert.match(response.body, /Sign in and explore Pro/);
  assert.match(response.body, /Full lesson content is delivered after the server verifies active Pro access/);
  assert.doesNotMatch(response.body, /What is a class and an object/);
  assert.doesNotMatch(response.body, /Interview answer:/);
});

test("active Pro members receive the full learning guide", async () => {
  const originalFetch = global.fetch;
  const names = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const originalEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "anon-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
  global.fetch = async url => {
    if (url.endsWith("/auth/v1/user")) {
      return { ok: true, json: async () => ({ id: "user-123" }) };
    }
    if (url.includes("/rest/v1/entitlements?")) {
      return { ok: true, text: async () => JSON.stringify([{ tier: "Pro" }]) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const response = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    send(value) { this.body = value; return this; },
    redirect(code, value) { this.statusCode = code; this.location = value; return this; },
  };

  try {
    await servePage({
      query: { page: "C#Dotnet.html" },
      headers: { cookie: "visual_pro_session=valid-token" },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /What is a class and an object/);
    assert.match(response.body, /guide-locks\.js/);
  } finally {
    global.fetch = originalFetch;
    for (const name of names) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
  }
});

test("every protected topic has a public preview with an upgrade path", () => {
  const pages = [
    "Amazon-Design.html", "System-Design.html", "AZURECICD.html",
    "AZURECICD - Copy.html", "C#Dotnet.html", "Dotnet-Roadmap.html",
    "Interview-Studio.html", "DSA.html", "How AI work.html", "Project.html",
  ];
  for (const page of pages) {
    const preview = servePage.renderPreviewPage(page);
    assert.match(preview, /Learning guide preview/, page);
    assert.match(preview, /Sign in and explore Pro/, page);
  }
  const preview = servePage.renderPreviewPage("Dotnet-Roadmap.html");
  assert.match(preview, /data-local-pro-unlock/);
  assert.match(preview, /local-pro-access\.js/);
});

test("the 365-day C#/.NET roadmap uses the protected guide route", () => {
  const source = fs.readFileSync(path.join(root, "api", "serve-page.js"), "utf8");
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  assert.match(source, /"Dotnet-Roadmap\.html"/);
  assert.ok(vercel.rewrites.some(route =>
    route.source === "/Dotnet-Roadmap.html" &&
    route.destination === "/api/serve-page?page=Dotnet-Roadmap.html"
  ));
});

test("the interview practice studio uses the protected guide route", () => {
  const source = fs.readFileSync(path.join(root, "api", "serve-page.js"), "utf8");
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  assert.match(source, /"Interview-Studio\.html"/);
  assert.ok(vercel.rewrites.some(route =>
    route.source === "/Interview-Studio.html" &&
    route.destination === "/api/serve-page?page=Interview-Studio.html"
  ));
});

test("guide paths containing special characters and spaces are routed through server protection", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const protectedRoutes = [
    ["/C%23Dotnet.html", "/api/serve-page?page=C%23Dotnet.html"],
    ["/AZURECICD%20-%20Copy.html", "/api/serve-page?page=AZURECICD%20-%20Copy.html"],
    ["/How%20AI%20work.html", "/api/serve-page?page=How%20AI%20work.html"],
  ];

  for (const [source, destination] of protectedRoutes) {
    assert.ok(vercel.rewrites.some(route => route.source === source && route.destination === destination), source);
  }
});

test("interview Pro preview directs users to verified checkout without public self-grant", () => {
  const html = fs.readFileSync(path.join(root, "Company-Interviews.html"), "utf8");
  const client = fs.readFileSync(path.join(root, "company-interviews.js"), "utf8");
  const lockedCard = client.match(/function makeLockedCard\(item\) \{([\s\S]*?)function updateQuestions/);
  assert.ok(lockedCard, "locked question card renderer should exist");
  assert.match(html, /First 10 questions per topic are free/);
  assert.match(html, /Access activates only after the payment provider confirms your purchase/);
  assert.match(lockedCard[1], /createElement\("article"\)/);
  assert.doesNotMatch(lockedCard[1], /createElement\("details"\)|createElement\("summary"\)/);
  assert.match(lockedCard[1], /className = "locked-preview"/);
  assert.match(html, /\.locked-preview \{[^}]*filter: blur\(/);
  assert.match(html, /\.locked-preview \{[^}]*pointer-events: none/);
  assert.match(lockedCard[1], /Pro question/);
  assert.match(lockedCard[1], /textContent = "Unlock Pro"/);
  assert.match(lockedCard[1], /dataset\.localProUnlock/);
  assert.match(client, /\/api\/checkout/);
  assert.match(client, /checkout\.checkoutUrl\.startsWith\("https:\/\/"\)/);
  assert.doesNotMatch(client, /send-otp|verify-otp|grant-demo-pro/);
  assert.equal(fs.existsSync(path.join(root, "api", "grant-demo-pro.js")), false);
});

test("manual-lock controller keeps eight cards per section free and defaults the rest locked", () => {
  const source = fs.readFileSync(path.join(root, "guide-locks.js"), "utf8");
  assert.match(source, /FREE_ITEMS_PER_SECTION = 8/);
  assert.match(source, /index < FREE_ITEMS_PER_SECTION/);
  assert.match(source, /Locked concept/);
  assert.match(source, /Unlock this item/);
  assert.match(source, /Unlock all remaining/);
  assert.match(source, /Lock all again/);
  assert.match(source, /result\.access\?\.isAdmin === true/);
  assert.match(source, /tiers\?\.includes\("Pro"\)/);
});
