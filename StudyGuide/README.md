# KR7Tech StudyGuide

KR7Tech is a learning and interview-preparation platform for students,
beginners, working engineers, and senior professionals. The homepage presents
beginner-to-senior learning paths, technology guides, training topics with
Krishna, free interview Q&A previews, and the existing Pro access flow. It
does not claim to sell live cohorts or separate courses until schedules,
pricing, and enrollment are configured.

The static guides have no build step. Interview question banks use Vercel
Functions and Supabase for server-authorized question delivery and Pro access.

`System-Design.html` teaches the end-to-end design process through one
marketplace case study. `Amazon-Design.html` is the companion detailed HLD/LLD
deep dive.

`How AI work.html` is the AI learning guide. It explains a step-by-step path
from a basic model call to RAG and a bounded tool-using agent, with provider
choices for OpenAI, Claude, OpenRouter, Ollama, and Microsoft Foundry. Its
examples keep provider keys server-side and call out provider API compatibility
and evaluation/security requirements. The guide also includes a daily email,
calendar, and task assistant example with a bounded read-only agent loop,
reviewable draft workflow, and a separate explicit-approval send boundary. A
new LLM-internals section explains prompt assembly, tokenization, Transformer
attention, next-token decoding, prefill versus generation latency, KV caching,
model speed/reasoning trade-offs, and ways to evaluate answer quality. “Astra”
is treated as an ambiguous model label; exact provider/version details are
needed for product-specific performance claims.

`C#Dotnet.html` contains 169 C#/.NET interview questions plus 18 in-depth
walkthroughs. They follow an ASP.NET Core order request through compilation,
middleware, dependency injection, async I/O, EF Core, database execution,
managed memory, and outbound HTTP, then dig into type semantics, delegates,
API security, transaction/concurrency behavior, the outbox pattern, backpressure,
testing boundaries, modular architecture, and production diagnostics.

`Dotnet-Roadmap.html` is a 365-day C#/.NET curriculum with a daily 2–4 hour
routine, 52 weekly outcomes, beginner foundations, professional backend and
cloud engineering, hands-on capstone work, and senior-level leadership,
incident, project-story, and mock-interview preparation. Daily checkmarks are
stored in the current browser on the current device only.

`Interview-Studio.html` is linked from Training and the .NET roadmap. It
contains five self-guided practice labs: a .NET idempotency/debugging review,
a SQL query/index checklist, staged system-design coverage review, a branching
production-incident simulation, and a truthful senior project-story builder.
User-entered notes and progress remain in browser-local storage; the SQL
checklist does not execute queries, and the studio does not guarantee
interview outcomes.


## Protected company interview question bank

The first ten questions per topic are free; later questions are returned only
to Pro users. Question answers are stored in Supabase, not in the HTML or
browser JavaScript:

- L1, L2, and L3 entitlements do not unlock paid question answers.
- Pro unlocks all questions beyond the free first ten per topic.
- Razorpay and Stripe charge INR. PayPal prices must be explicitly configured
  in USD; no currency conversion is assumed.
- Access changes only after the backend validates a provider-signed webhook
  and matches the confirmed amount, currency, user, tier, and pending purchase.
- Administrators can grant or revoke a user's tier in the question page.

For local visual testing only, start `vercel dev` with
`NODE_ENV=development`, `LOCAL_PRO_ACCESS_ENABLED=true`,
`LOCAL_PRO_ACCESS_PIN` set to the test PIN, and `LOCAL_PRO_ACCESS_SECRET` set
to a fresh random value of at least 32 characters. On localhost, an "Unlock
Pro" button then asks for the PIN and enables a signed, HttpOnly test cookie
for up to eight hours. This route is disabled on production deployments and
non-local hosts; do not add these settings to Vercel deployment environments.
The usual local Supabase configuration is still needed for the question banks.

The deployed Vercel application protects the guide pages listed in
`vercel.json`. Direct requests are checked for a server-created HttpOnly session
cookie and an active Pro entitlement before the static HTML is returned.
Browser copy blocking reduces copying but does not replace server authorization
or absolute source secrecy. The Company Interview page also uses server-side
question delivery so answers never ship as premium browser source.

The DSA practice page's C#, Python, and Java runner uses a server-side Judge0
proxy. Configure `JUDGE0_API_URL` with the HTTPS base URL of the Judge0 instance
and optionally set `JUDGE0_API_TOKEN`. Only signed-in Pro users can submit or
poll code. Source, stdin, and expected output are sent to that compiler service
only after Run is selected; do not submit secrets or personal data.

The React machine-coding practice page contains 30 challenges. Ten are flagged
as free previews; locked challenge titles, prompts, and answers are not returned
to non-Pro browsers. The list shows blurred generic Pro placeholders. Full
challenge data is returned only to an active Pro user by
`/api/react-machine-coding`. After applying
`supabase/schema.sql` and `supabase/seed.sql`, also run
`react-machine-coding-seed.sql` in the Supabase SQL Editor.

The home page provides experience-based interview Q&A across 16 subjects:
C#/.NET, ASP.NET Core, EF Core, LINQ, Angular, JavaScript/TypeScript, Azure,
DevOps, SQL, System Design, REST APIs, Microservices, Identity/Security,
Testing, Data Structures/Algorithms, and Behavioral. The bank contains
beginner foundations, mid-level, advanced, and senior/expert questions, with
12-16 question-and-answer examples for every subject. Run
`experience-questions-seed.sql` in the Supabase SQL Editor to create or update
its server-protected table and seed the bank. Choose one subject or "All
subjects" and an experience band. The first ten questions per subject are
available free, sampled across all four experience bands; locked question
titles and answers are not returned to non-Pro browsers. The page shows blurred
generic Pro placeholders, and full question data is returned only by
`/api/experience-questions` after server-side entitlement verification. A
company-preparation filter uses tags for Microsoft, Amazon,
Google, TCS, Infosys, and Accenture. These tags help learners focus their
preparation and are not claims that a named employer asked the exact question.

`AI-Interview.html` provides a voice-enabled mock interview coach backed by
Gemini. Configure `GEMINI_API_KEY` as a server-only Vercel environment variable
and optionally configure `GEMINI_MODEL` (defaults to `gemini-2.5-flash`).
After each answer, Gemini returns a PASS/FAIL learning check based on the
technical correctness and completeness of that answer. It is not a candidate
score or hiring decision. Offline local practice shows a basic format check
only; it does not verify technical correctness.
Each practice session now asks six questions in sequence, adapts follow-ups
based on earlier answers, evaluates every answer (including question six), and
shows a session summary at the end.
When the server endpoint is unavailable (for example, opening the HTML file
directly or using a static-only local server), the page switches to a clearly
identified in-browser practice mode with spoken questions, topic follow-ups,
and basic non-AI coaching. Use `vercel dev` or the deployed Vercel app for
Gemini-generated feedback.
Production requires sign-in by default. Local development allows anonymous
testing; set `AI_INTERVIEW_ALLOW_ANONYMOUS=false` to require sign-in locally, or
set it to `true` to temporarily permit anonymous testing in a deployed
environment. Turn that flag off after testing: anonymous access can incur
Gemini usage and costs. The browser sends the user's answers to the server,
which forwards them to Google Gemini; no audio is sent to Gemini by this
application. Browser speech-recognition providers may process audio under
their own terms. The feature gives practice feedback only and does not rank or
recommend hiring, selection, or rejection. Set provider quota and billing
limits before public deployment.

### 1. Create and configure Supabase

1. Create a Supabase project and enable email/password authentication.
2. In the Supabase SQL Editor, run `supabase/schema.sql`, then
   `supabase/seed.sql`. The seed is idempotent and marks the first ten
   questions per topic as public previews.
3. Copy the project URL, anon key, and service-role key to Vercel environment
   variables. The service-role key is server-only and must never be added to
   HTML, JavaScript, or a `NEXT_PUBLIC_` variable.
4. Create an initial admin account and set its UUID in `ADMIN_USER_IDS`, or
   grant admin status in the SQL Editor:

   ```sql
   update public.profiles
   set is_admin = true
   where id = 'YOUR-SUPABASE-AUTH-USER-UUID';
   ```

The schema enables RLS and grants table access only to Supabase's server-side
`service_role`. New Supabase Auth users receive a profile row through a
database trigger.

### 2. Configure Vercel

Import this directory as the Vercel project root. Use the **Other** framework
preset, no build command, and `.` as the output directory. Vercel automatically
deploys the functions in `api/`. `.vercelignore` excludes the schema, question
seed, and setup documentation from the deployment.

Set these Vercel environment variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public Supabase Auth key, used by server and browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access |
| `PUBLIC_APP_URL` | Canonical HTTPS URL of this Vercel deployment |
| `ADMIN_USER_IDS` | Optional comma-separated Supabase user UUIDs with admin access |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay checkout credentials |
| `RAZORPAY_WEBHOOK_SECRET` | Secret configured for the Razorpay webhook |
| `STRIPE_SECRET_KEY` | Stripe checkout credential |
| `STRIPE_WEBHOOK_SECRET` | Stripe endpoint signing secret |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | PayPal API credentials |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook ID used for signature verification |
| `PAYPAL_L1_USD`, `PAYPAL_L2_USD`, `PAYPAL_L3_USD`, `PAYPAL_PRO_USD` | Explicit PayPal prices, each formatted like `5.00` |
| `PAYPAL_BASE_URL` | Optional; defaults to PayPal live API. Use the sandbox URL for sandbox credentials. |
| `JUDGE0_API_URL` | HTTPS base URL for the Judge0 compiler service used by the DSA runner |
| `JUDGE0_API_TOKEN` | Optional server-only Judge0 authentication token |
| `GEMINI_API_KEY` | Server-only API key for the Gemini mock-interview coach |
| `GEMINI_MODEL` | Optional Gemini model name; defaults to `gemini-2.5-flash` |
| `AI_INTERVIEW_ALLOW_ANONYMOUS` | Optional; set to `true` only for temporary anonymous testing, `false` to require sign-in |

Checkout is hidden until the corresponding checkout credentials **and**
webhook verification settings are configured. PayPal is enabled only when all
four explicit USD prices are set.

### 3. Register payment webhooks

Register these HTTPS endpoints using the same credentials/environment as the
deployed checkout:

- Razorpay: `/api/webhooks/razorpay`, subscribe to `payment_link.paid`.
- Stripe: `/api/webhooks/stripe`, subscribe to
  `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- PayPal: `/api/webhooks/paypal`, subscribe to `PAYMENT.CAPTURE.COMPLETED`.

Copy each provider's webhook signing secret or webhook ID to the matching
Vercel variable. The PayPal return endpoint captures the user's own pending
order; only the signed `PAYMENT.CAPTURE.COMPLETED` webhook grants access.
Configure Supabase Auth's site URL and allowed redirect URLs to include the
Vercel domain.

### 4. Verify before launch

- Test preview access, sign-up/sign-in, and each individual L-tier and Pro
  entitlement using provider sandbox/test modes.
- Confirm React machine-coding visitors receive only the ten free challenges,
  while Pro users receive the complete bank.
- Confirm wrong amounts/currencies, invalid signatures, mismatched purchase
  metadata, and duplicate webhook deliveries do not grant extra access.
- Test administrator grant/revoke and re-purchase after revocation.
- Confirm `Company-Interviews.html` and `company-interviews.js` contain no
  premium answers. Never use GitHub Pages or another static-only host for this
  protected question endpoint; static hosting cannot execute the API.

## Learning guide previews and Pro lesson access

Import this directory into Vercel so that Functions, rewrites, and HTTP cookies
can authorize full guide delivery. Visitors without active Pro access receive
a course preview with an upgrade path; the full lesson HTML is sent only after
the server verifies both:

1. a Supabase session cookie created by `/api/session`, and
2. an active `Pro` entitlement in Supabase.

The preview contains course-scope descriptions only, not the underlying lesson
answers or examples. Deploying the HTML directory directly to GitHub Pages
bypasses these checks, so GitHub Pages is not a supported paid-content host.
DevTools and browser-source restrictions can only deter casual copying; the
server boundary prevents unauthorized delivery and remains the authoritative
copy-protection mechanism.

The company question bank contains representative practice prompts, not
official or guaranteed interview questions.
