const fs = require("node:fs");
const path = require("node:path");
const { getEntitlements, hasLocalProAccess, sendError, supabaseUrl } = require("./_shared");

const PROTECTED_PAGES = new Set([
  "Amazon-Design.html",
  "System-Design.html",
  "AZURECICD.html",
  "AZURECICD - Copy.html",
  "C#Dotnet.html",
  "Dotnet-Roadmap.html",
  "Interview-Studio.html",
  "DSA.html",
  "How AI work.html",
  "Project.html",
]);

const PREVIEW_COURSES = {
  "Amazon-Design.html": {
    title: "Amazon-scale marketplace design",
    description: "Explore a marketplace architecture through its requirements, APIs, data ownership, checkout flow, and operational trade-offs.",
  },
  "System-Design.html": {
    title: "System design from first principles",
    description: "Follow one marketplace case study from requirements and core concepts to reliability, security, and senior-level design decisions.",
  },
  "AZURECICD.html": {
    title: "Azure and CI/CD",
    description: "Build understanding of cloud foundations, secure deployment, messaging, pipelines, and production operations.",
  },
  "AZURECICD - Copy.html": {
    title: "Azure and CI/CD",
    description: "Build understanding of cloud foundations, secure deployment, messaging, pipelines, and production operations.",
  },
  "C#Dotnet.html": {
    title: "C# and .NET",
    description: "Learn programming foundations, ASP.NET Core, EF Core, async, security, performance, and production engineering.",
  },
  "Dotnet-Roadmap.html": {
    title: "The 365-day C#/.NET roadmap",
    description: "A structured path from programming foundations through backend, cloud, production engineering, and senior-level practice.",
  },
  "Interview-Studio.html": {
    title: "Interview practice studio",
    description: "Practice debugging, SQL review, system design, incident response, and project-story communication.",
  },
  "DSA.html": {
    title: "Data structures and algorithms",
    description: "Develop problem-solving habits with core patterns, visual traces, complexity reasoning, and coding practice.",
  },
  "How AI work.html": {
    title: "How AI, RAG, and agents work",
    description: "Build understanding of LLM fundamentals, retrieval-augmented generation, agent workflows, and responsible implementation.",
  },
  "Project.html": {
    title: "CRM and application architecture",
    description: "Explore realistic CRM, omnichannel, and commerce scenarios through architecture and implementation decisions.",
  },
};

function renderPreviewPage(page) {
  const course = PREVIEW_COURSES[page];
  if (!course) throw new Error("Missing preview details for protected guide.");
  const escapeHtml = value => value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
  const title = escapeHtml(course.title);
  const description = escapeHtml(course.description);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow,noarchive,nosnippet" />
    <title>${title} | KR7Tech preview</title>
    <style>
      :root { color-scheme: dark; --page:#101923; --surface:#172431; --ink:#f4f7fa; --muted:#b7c3cf; --line:#334455; --brand:#50dfbf; }
      * { box-sizing:border-box; }
      body { display:grid; min-height:100vh; margin:0; place-items:center; padding:24px; background:var(--page); color:var(--ink); font:16px/1.6 "Segoe UI",sans-serif; }
      main { width:min(100%,760px); padding:clamp(24px,6vw,48px); border:1px solid var(--line); border-radius:18px; background:linear-gradient(145deg,#193630,var(--surface) 62%); }
      .brand { color:var(--ink); font-size:1.05rem; font-weight:900; text-decoration:none; }
      .brand span { color:var(--brand); }
      .eyebrow { margin:38px 0 8px; color:var(--brand); font-size:.78rem; font-weight:900; letter-spacing:.13em; text-transform:uppercase; }
      h1 { margin:0; font-size:clamp(2rem,6vw,3.7rem); letter-spacing:-.05em; line-height:1.05; }
      .description { margin:17px 0 22px; color:var(--muted); font-size:1.08rem; }
      .preview { margin:0; padding:16px 18px; border:1px solid var(--line); border-radius:12px; background:#111b25; }
      .preview strong { color:var(--brand); }
      .preview p { margin:5px 0 0; color:var(--muted); }
      .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:23px; }
      .button { display:inline-flex; min-height:46px; align-items:center; justify-content:center; padding:9px 16px; border:1px solid var(--brand); border-radius:8px; background:var(--brand); color:#09241f; font-weight:900; text-decoration:none; }
      button.button { cursor:pointer; font:inherit; font-weight:900; }
      .button.secondary { background:transparent; color:var(--ink); }
      .note { margin:15px 0 0; color:#93a5b3; font-size:.82rem; }
    </style>
  </head>
  <body>
    <main>
      <a class="brand" href="/">KR7<span>Tech</span></a>
      <p class="eyebrow">Learning guide preview</p>
      <h1>${title}</h1>
      <p class="description">${description}</p>
      <aside class="preview">
        <strong>What this guide covers</strong>
        <p>Step-by-step lessons, worked examples, practical scenarios, and deeper explanations are available with KR7Tech Pro.</p>
      </aside>
      <div class="actions">
        <button class="button" type="button" data-local-pro-unlock hidden>Unlock Pro for local testing</button>
        <a class="button secondary" href="/Company-Interviews.html#access-heading">Sign in and explore Pro</a>
        <a class="button secondary" href="/">Back to KR7Tech</a>
      </div>
      <p class="note">This preview shows the course scope only. Full lesson content is delivered after the server verifies active Pro access.</p>
    </main>
    <script src="/local-pro-access.js" defer></script>
  </body>
</html>`;
}

function sessionCookie(req) {
  const raw = req.headers.cookie || "";
  const match = raw.split(";").map(item => item.trim()).find(item => item.startsWith("visual_pro_session="));
  return match ? decodeURIComponent(match.slice("visual_pro_session=".length)) : null;
}

async function userFromCookie(req) {
  const token = sessionCookie(req);
  if (!token) return null;
  const response = await fetch(supabaseUrl("/auth/v1/user"), {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  return response.ok ? response.json() : null;
}

module.exports = async function handler(req, res) {
  try {
    const page = req.query.page;
    if (!PROTECTED_PAGES.has(page)) return res.status(404).send("Page not found.");

    const user = await userFromCookie(req);
    const entitlements = user ? await getEntitlements(user.id) : [];
    const isPro = entitlements.some(item => item.tier === "Pro" && item.active !== false) || hasLocalProAccess(req);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (!isPro) return res.status(200).send(renderPreviewPage(page));

    const candidates = [path.join(process.cwd(), page), path.join(process.cwd(), "StudyGuide", page)];
    const file = candidates.find(candidate => fs.existsSync(candidate));
    if (!file) return res.status(404).send("Page not found.");

    const html = fs.readFileSync(file, "utf8");
    const withManualLocks = html.includes("guide-locks.js")
      ? html
      : html.replace(/<\/body>/i, '  <script src="/guide-locks.js" defer></script>\n</body>');

    return res.status(200).send(withManualLocks);
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports.renderPreviewPage = renderPreviewPage;
