"use strict";

const roadmapWeeks = [
  { phase: 1, title: "Workstation, terminal, and engineering habits", concept: "files, folders, processes, paths, command-line input/output, and the edit-build-run loop", lab: "create a console app, inspect its files, run it from the terminal, and use the debugger", failure: "wrong working directory, misspelled arguments, and a breakpoint that never binds", apply: "set up a clean Git repository with a README and repeatable run instructions", interview: "How do you make a new developer productive and keep a small change reproducible?", outcome: "a documented console project, Git history, and a short setup checklist" },
  { phase: 1, title: "Variables, values, expressions, and input/output", concept: "types, assignment, operators, conversions, console input, and formatted output", lab: "build a unit converter with named methods and explicit input parsing", failure: "empty input, invalid numbers, overflow, and ambiguous units", apply: "add a validated command-line flow and useful error messages", interview: "How do types and validation prevent invalid state from entering a program?", outcome: "a working converter with valid, invalid, and boundary tests" },
  { phase: 1, title: "Boolean logic, branching, and decision tables", concept: "comparisons, Boolean operators, if/switch, pattern basics, and mutually exclusive rules", lab: "implement a shipping-cost or discount calculator from written rules", failure: "overlapping conditions, boundary values, and an unreachable branch", apply: "turn prose requirements into a decision table before coding", interview: "How do you clarify ambiguous business rules and prove every case is covered?", outcome: "a decision table, implementation, and tests for each rule branch" },
  { phase: 1, title: "Loops, invariants, and tracing state", concept: "for/while/foreach, loop invariants, termination, and state updates", lab: "write number guessing, input retry, and summary loops", failure: "off-by-one errors, non-terminating loops, and mutation during iteration", apply: "trace a loop by hand and then verify it with a debugger", interview: "How do you reason about loop correctness and termination?", outcome: "three small loop exercises with trace tables and boundary tests" },
  { phase: 1, title: "Methods, parameters, return values, and scope", concept: "method contracts, local scope, parameters, return types, and decomposition", lab: "split a receipt calculator into parsing, calculation, and formatting methods", failure: "hidden shared state, unclear parameter meaning, and incorrect return paths", apply: "refactor one long method without changing observable behavior", interview: "How do you choose a method boundary and make its contract clear?", outcome: "a small program with cohesive methods and documented preconditions" },
  { phase: 1, title: "Arrays, strings, and simple algorithms", concept: "indexed storage, string immutability, traversal, and input-size reasoning", lab: "implement min/max, reverse, frequency count, and palindrome checks", failure: "empty arrays, Unicode/string assumptions, and invalid index access", apply: "write examples first, then handle edge cases without special-case sprawl", interview: "How do you explain the time and space cost of a simple algorithm?", outcome: "four tested functions with stated complexity and edge-case behavior" },
  { phase: 1, title: "Problem-solving process and Big-O foundations", concept: "problem constraints, brute force, asymptotic growth, time, and auxiliary space", lab: "compare nested-loop pair search with a dictionary-based solution", failure: "optimizing before understanding constraints or ignoring memory costs", apply: "write a short problem statement, examples, approach, and complexity before coding", interview: "How do input size and constraints change your algorithm choice?", outcome: "a one-page problem-solving template and two explained solutions" },
  { phase: 1, title: "Classes, objects, invariants, and basic OOP", concept: "state, behavior, constructors, encapsulation, identity, and object lifetime", lab: "model a bank account or inventory item with invariant-preserving methods", failure: "public mutable state, invalid constructor values, and behavior in the wrong class", apply: "replace a group of unrelated variables with a cohesive model", interview: "When does an object model help, and when is a simple function enough?", outcome: "a small domain model that prevents invalid state and has focused tests" },

  { phase: 2, title: "C# value semantics, references, nullability, and equality", concept: "value/reference behavior, copying, nullable reference annotations, equality, and boxing", lab: "compare mutable class and readonly struct behavior in a tiny experiment", failure: "aliasing, null contracts, accidental boxing, and reference-based equality assumptions", apply: "enable nullable analysis and fix warnings by improving contracts, not suppressing them", interview: "How do runtime semantics affect API design, memory, and correctness?", outcome: "a nullable-clean sample with an equality test matrix" },
  { phase: 2, title: "Exceptions, disposal, and resource ownership", concept: "exception propagation, finally, IDisposable, IAsyncDisposable, and using scopes", lab: "write a file-processing routine that safely owns and disposes resources", failure: "swallowed exceptions, leaked handles, cleanup masking the original failure", apply: "define which layer translates an error and which layer logs it", interview: "How do you preserve failure context while cleaning up resources?", outcome: "a resource-safe implementation with success, failure, and cancellation tests" },
  { phase: 2, title: "Generics, constraints, and reusable algorithms", concept: "generic type parameters, constraints, variance awareness, and compile-time reuse", lab: "implement a generic result wrapper and a reusable lookup operation", failure: "over-generalization, invalid constraints, and hidden null assumptions", apply: "replace duplicated typed code with one generic abstraction only where behavior matches", interview: "What do generics give you that object-based APIs do not?", outcome: "a generic helper with compile-time-safe tests and a clear constraint rationale" },
  { phase: 2, title: "Collections, LINQ, hashing, and query execution", concept: "List, Dictionary, HashSet, equality contracts, IEnumerable pipelines, deferred execution, materialization, and amortized cost", lab: "build a de-duplicating import and use LINQ to filter, group, project, and aggregate sample orders", failure: "mutable dictionary keys, wrong collection choice, side effects in deferred queries, and accidental repeated enumeration", apply: "compare LINQ with explicit loops, measure lookup versus traversal, and identify when materialization executes", interview: "How do equality and hashing affect collections, and when does a LINQ query execute?", outcome: "a collection decision table, tested import exercise, and query-execution trace" },
  { phase: 2, title: "Delegates, events, closures, and callbacks", concept: "delegate invocation, multicast events, captured variables, closure lifetime, and unsubscribe ownership", lab: "create a progress notification and a callback-based filtering example", failure: "event subscriber retention and a closure that captures a changing loop variable", apply: "document who subscribes, who unsubscribes, and who owns callback lifetime", interview: "How can a short lambda keep a large object graph alive?", outcome: "a working event example with deterministic unsubscription and tests" },
  { phase: 2, title: "Tasks, async/await, cancellation, and exceptions", concept: "Task as an operation, async state machines, incomplete await, cancellation tokens, and exception flow", lab: "call two independent asynchronous operations and combine their results", failure: "sync-over-async, missing cancellation, fire-and-forget, and Task.Run around I/O", apply: "propagate one CancellationToken from an entry point through every async dependency", interview: "What happens at an incomplete await, and does it create a thread?", outcome: "an async workflow with cancellation, error, and concurrency tests" },
  { phase: 2, title: "Concurrency primitives and race-condition reasoning", concept: "shared state, lock, Interlocked, SemaphoreSlim, channels, atomicity, and visibility", lab: "reproduce a counter race, then fix it with a lock and an atomic operation", failure: "await inside lock, releasing a semaphore incorrectly, and treating volatile as a transaction", apply: "state the invariant first, then choose the smallest safe coordination primitive", interview: "How do you distinguish a race, deadlock, starvation, and contention?", outcome: "a reproducible race demo, two fixes, and a concurrency test" },
  { phase: 2, title: "CLR, JIT, allocation, garbage collection, and diagnostics", concept: "assemblies, metadata, JIT, tiering, roots, generations, LOH, and managed retention", lab: "create an allocation-heavy loop and inspect runtime counters or a profiler trace", failure: "retained event handlers, unbounded cache growth, and forced-GC tuning", apply: "form a measurable hypothesis before changing allocation or GC behavior", interview: "How would you distinguish allocation pressure from a managed memory leak?", outcome: "a short diagnostic report with baseline, evidence, and one measured change" },
  { phase: 2, title: "Testing, assertions, test doubles, and refactoring", concept: "unit tests, observable behavior, stubs/fakes/mocks, deterministic tests, and refactoring safety", lab: "test a domain rule using the Arrange-Act-Assert pattern and edge cases", failure: "over-mocking, tests coupled to private implementation, and clock/network nondeterminism", apply: "refactor under tests and preserve behavior with a regression case", interview: "What should be isolated in a unit test, and what needs an integration test?", outcome: "a focused test suite and a refactoring change supported by tests" },
  { phase: 2, title: "SQL schema, keys, constraints, and relational modeling", concept: "tables, keys, foreign keys, nullability, normalization, constraints, and transactions", lab: "model customers, orders, and order lines with constraints and seed data", failure: "orphan rows, duplicate business keys, nullable confusion, and update anomalies", apply: "encode data invariants in constraints as well as application validation", interview: "Which invariants belong in the database, and why?", outcome: "a schema diagram and migration script with representative data" },

  { phase: 3, title: "SQL queries, joins, indexes, and query plans", concept: "joins, aggregation, composite indexes, selectivity, sargability, and execution plans", lab: "query recent orders and compare plans before and after a targeted index", failure: "N+1 round trips, leading-wildcard scans, over-indexing, and selecting unused columns", apply: "measure logical reads/latency and explain why the chosen index helps this predicate", interview: "How do you diagnose and improve a slow SQL query without guessing?", outcome: "a before/after query-plan note with a justified index" },
  { phase: 3, title: "Transactions, isolation, locks, and optimistic concurrency", concept: "atomicity, isolation levels, blocking, deadlocks, row versions, and conflict handling", lab: "run two concurrent updates and implement a version-checked conflict response", failure: "lost updates, long transactions, lock escalation, and blind retries of stale data", apply: "choose the smallest transaction boundary that protects a business invariant", interview: "When is optimistic concurrency better than holding locks?", outcome: "a concurrency scenario, reproduction steps, and explicit retry/merge policy" },
  { phase: 3, title: "HTTP, REST, status codes, and API contract fundamentals", concept: "request/response, methods, headers, status codes, idempotency, and resource modeling", lab: "design an order API with create, read, and state-transition operations", failure: "using GET for mutation, leaking internal errors, and ambiguous retry behavior", apply: "write OpenAPI examples and document validation and error shapes", interview: "How do you design an API that can evolve without breaking clients?", outcome: "an API contract with example requests, responses, and error cases" },
  { phase: 3, title: "ASP.NET Core host, Kestrel, middleware, and routing", concept: "hosting, request delegates, middleware order, endpoint selection, and HttpContext", lab: "build a minimal API with exception handling, routing, and request tracing", failure: "middleware in the wrong order, early short-circuit, and unhandled exceptions", apply: "trace one request through each configured middleware boundary", interview: "What happens from socket acceptance to endpoint execution?", outcome: "a runnable API with a request-flow diagram and integration check" },
  { phase: 3, title: "Binding, validation, error contracts, and API behavior", concept: "route/query/body binding, validation boundaries, Problem Details, pagination, and idempotency keys", lab: "implement validated create-order input and stable problem responses", failure: "trusting client IDs, accepting invalid transitions, oversized bodies, and duplicate POST retries", apply: "separate syntactic validation from authorization and domain invariants", interview: "Where should validation live, and how do you make retries safe?", outcome: "a documented API behavior matrix and validation tests" },
  { phase: 3, title: "Dependency injection, lifetimes, options, and configuration", concept: "constructor graphs, singleton/scoped/transient lifetimes, options validation, and configuration sources", lab: "register order services, validate startup settings, and inject typed options", failure: "singleton captures scoped DbContext, mutable singleton state, and missing production configuration", apply: "trace object creation and disposal for one request scope", interview: "What does the DI container own, and what does a lifetime mismatch break?", outcome: "a dependency graph and startup validation tests" },
  { phase: 3, title: "Authentication, authorization, and application security", concept: "identity principal, claims, schemes, policy authorization, resource ownership, and least privilege", lab: "protect an endpoint with a policy and verify user ownership of a specific resource", failure: "confusing authentication with authorization, trusting client roles, and insecure direct object references", apply: "threat-model one endpoint from input through data query", interview: "How do you ensure an authenticated user may access this exact record?", outcome: "an endpoint threat checklist and allow/deny integration tests" },
  { phase: 3, title: "EF Core entity modeling, migrations, and change tracking", concept: "DbContext unit of work, entity configuration, relationships, migrations, and tracked state", lab: "map an order aggregate and create a reviewed migration", failure: "accidental schema drift, incorrect cascade behavior, and long-lived context tracking", apply: "apply migration to a disposable database and verify generated schema", interview: "What does a DbContext track, and when should its lifetime end?", outcome: "a model configuration, migration, and schema verification test" },
  { phase: 3, title: "EF Core query translation, loading, and performance", concept: "IQueryable expression trees, provider translation, projection, tracking, split queries, and N+1", lab: "build a paged order summary projection and inspect the generated SQL", failure: "client-side evaluation assumptions, huge includes, duplicate enumeration, and unbounded result sets", apply: "measure query count, rows returned, and materialization cost", interview: "How do you prove whether EF, SQL, or network transfer is the bottleneck?", outcome: "a query benchmark note and efficient read model" },
  { phase: 3, title: "EF Core saves, transactions, and concurrency conflicts", concept: "change detection, SaveChanges transaction boundary, rowversion tokens, and DbUpdateConcurrencyException", lab: "persist a multi-entity change and expose a stale-update conflict as HTTP 409", failure: "parallel operations on one DbContext and retrying an entire non-idempotent request", apply: "make transaction and error-translation ownership explicit", interview: "What is atomic in SaveChanges, and what is not?", outcome: "an integration-tested update workflow with conflict and rollback coverage" },
  { phase: 3, title: "Outbound HTTP, HttpClientFactory, timeouts, and resilience", concept: "handler pooling, connection lifetime, cancellation, timeout budgets, retries, and circuit breaking", lab: "create a typed HttpClient for an inventory dependency with bounded timeout", failure: "socket exhaustion, retrying non-idempotent work, and multiplying timeout budgets", apply: "inject transient failure and verify bounded retry/cancellation behavior", interview: "How do you protect your service when a downstream dependency slows down?", outcome: "a typed client and resilience policy with tested failure cases" },
  { phase: 3, title: "Serialization, file handling, and safe data boundaries", concept: "JSON contracts, encoding, streaming, file lifetime, validation, and sensitive-data handling", lab: "import a bounded JSON file into validated domain commands", failure: "oversized payloads, path traversal, malformed encodings, and logging personal data", apply: "stream large input and validate before committing changes", interview: "How do you safely process untrusted files or serialized input?", outcome: "a secure import flow with size, format, and failure tests" },

  { phase: 4, title: "Hosted services, queues, and graceful background work", concept: "IHostedService lifecycle, scoped work creation, shutdown tokens, and bounded in-process queues", lab: "create a background consumer that opens a DI scope for each work item", failure: "capturing request-scoped services, unbounded queues, and losing work at shutdown", apply: "add cancellation, queue capacity, and observable worker health", interview: "How does background work differ from the request that enqueued it?", outcome: "a bounded worker with graceful shutdown and failure telemetry" },
  { phase: 4, title: "Messaging, transactional outbox, and idempotent consumers", concept: "at-least-once delivery, outbox publishing, inbox deduplication, poison messages, and ordering", lab: "write an order and outbox event atomically, then publish and deduplicate by message ID", failure: "crash between DB commit and publish, duplicate delivery, and poison-message loops", apply: "track pending age, retries, dead-letter handling, and consumer lag", interview: "How do you make a database change and event publication reliably consistent?", outcome: "an outbox/inbox design with duplicate and restart tests" },
  { phase: 4, title: "Caching, rate limits, and bounded resource use", concept: "cache-aside, expiration, invalidation, stampede control, rate limiting, and capacity", lab: "cache a catalog read with expiration and protect an endpoint with a quota", failure: "stale authorization data, cache stampede, unbounded keys, and per-instance-only limits", apply: "define what may be cached, for how long, and how invalidation works", interview: "What consistency and failure trade-offs does this cache introduce?", outcome: "a cache policy and load test with stale-data and burst scenarios" },
  { phase: 4, title: "System design method and capacity estimation", concept: "requirements, workload, SLOs, API/data boundaries, estimates, and bottleneck hypotheses", lab: "design an order intake service and estimate peak requests, storage, and queue depth", failure: "designing before clarifying requirements and estimating averages instead of peaks", apply: "state assumptions and turn them into capacity numbers", interview: "How would you begin designing a service when the problem is underspecified?", outcome: "a one-page HLD with assumptions, rough sizing, and open questions" },
  { phase: 4, title: "Distributed consistency, sagas, and failure boundaries", concept: "partial failure, eventual consistency, saga state, compensation, and idempotent transitions", lab: "model reserve-inventory → charge-payment → confirm-order with compensations", failure: "timeout with unknown outcome, duplicate command, and compensation that also fails", apply: "draw state transitions and recovery ownership before choosing a broker", interview: "How do you recover a multi-service workflow without a global transaction?", outcome: "a saga state machine with retry, timeout, and manual-recovery paths" },
  { phase: 4, title: "Azure application hosting, identity, networking, and secrets", concept: "App Service/container hosting, managed identity, Key Vault, private networking, and service boundaries", lab: "deploy a small API using managed identity for one protected Azure dependency", failure: "committing credentials, over-broad roles, public exposure, and confusing DNS/network failure with auth", apply: "trace identity token, role assignment, network route, and audit evidence", interview: "How would you secure service-to-service access without long-lived secrets?", outcome: "an Azure deployment diagram and least-privilege access checklist" },
  { phase: 4, title: "Containers, CI/CD, migrations, and safe releases", concept: "container image layers, configuration, CI quality gates, deployment strategies, and schema compatibility", lab: "containerize the API and create build/test/security/deploy pipeline stages", failure: "secret in image layer, migration incompatible with old app, and deployment without rollback", apply: "practice expand-and-contract schema rollout and health-gated release", interview: "How do you deploy a breaking database change with zero-downtime constraints?", outcome: "a reproducible container build and staged release/rollback plan" },
  { phase: 4, title: "OpenTelemetry, SLOs, alerts, and runtime diagnostics", concept: "trace/span context, structured logs, metrics cardinality, SLI/SLO, and diagnostic tools", lab: "instrument request and dependency spans and define a latency/error SLO", failure: "missing correlation, sensitive payload logging, cardinality explosion, and noisy alerts", apply: "use a trace/counter to distinguish CPU, DB, and downstream time", interview: "How do you know a service is healthy from the user's perspective?", outcome: "a service dashboard sketch, SLO definition, and incident-ready trace" },
  { phase: 4, title: "Threat modeling, OWASP, privacy, and secure delivery", concept: "trust boundaries, STRIDE-style threats, injection, SSRF, CSRF, secret handling, and dependency risk", lab: "threat-model an authenticated order API and add defenses for its highest risks", failure: "unsafe deserialization, excessive data exposure, SSRF, and authorization bypass", apply: "map a security finding to code fix, regression test, and deployment evidence", interview: "How do you make security part of design rather than a final checklist?", outcome: "a threat model with prioritized mitigations and security regression tests" },

  { phase: 5, title: "Data structures and coding interview foundations", concept: "arrays, strings, hash maps, sets, stacks, queues, and constraint-driven complexity", lab: "solve representative lookup, frequency, bracket, and window problems in C#", failure: "wrong edge cases, unclear invariants, and coding before selecting a data structure", apply: "state complexity and test empty, duplicate, and large inputs", interview: "Talk through brute force first, then justify an improvement", outcome: "four timed solutions with tests and a concise explanation" },
  { phase: 5, title: "Trees, graphs, recursion, and search patterns", concept: "tree traversal, BFS/DFS, recursion stacks, visited sets, and graph representations", lab: "solve level-order traversal, connected components, and dependency reachability", failure: "cycles, stack overflow, revisiting nodes, and disconnected graph components", apply: "choose iterative or recursive traversal from constraints", interview: "How do you know whether BFS or DFS fits the problem?", outcome: "three tested graph/tree solutions and a pattern decision note" },
  { phase: 5, title: "Dynamic programming, sorting, and algorithm trade-offs", concept: "state definition, recurrence, memoization, tabulation, sorting costs, and binary search invariants", lab: "solve one interval/search problem and one small DP problem with a written recurrence", failure: "state missing a dimension, invalid binary-search boundaries, and unnecessary optimization", apply: "compare brute force and optimized versions on the same tests", interview: "How do you derive a DP state rather than memorize a formula?", outcome: "two explained solutions with recurrence and boundary tests" },
  { phase: 5, title: "Low-level design, domain modeling, and design patterns", concept: "SOLID as change pressure, aggregates, interfaces, composition, and pattern consequences", lab: "design a reservation or notification component with a testable domain boundary", failure: "pattern-first overengineering, anemic model, and abstractions that leak infrastructure", apply: "show one requirement change and adapt the design with minimal coupling", interview: "Why is this boundary or pattern appropriate here, and what cost does it add?", outcome: "a class diagram, runnable core behavior, and design trade-off note" },
  { phase: 5, title: "System design practice: APIs, storage, and scale", concept: "functional/non-functional requirements, HLD, data model, partitioning, cache, queue, and capacity", lab: "design a multi-tenant notification or order platform from requirements to deployment", failure: "missing tenant isolation, hot partitions, unbounded fan-out, and no overload behavior", apply: "calculate a rough peak and identify the first two bottlenecks", interview: "Explain the design, trade-offs, consistency, and failure behavior in 35 minutes", outcome: "a reviewable HLD with APIs, schema, scaling path, and failure modes" },
  { phase: 5, title: "Capstone architecture and delivery plan", concept: "scope, user journeys, domain boundaries, architecture decisions, milestones, and risk", lab: "write the capstone specification, diagrams, backlog, and acceptance criteria", failure: "choosing technology before requirements and attempting a giant untestable first release", apply: "split the system into thin vertical slices with demonstrable outcomes", interview: "How would you lead a team from ambiguous request to a safe first release?", outcome: "an architecture decision record, milestone plan, and threat outline" },
  { phase: 5, title: "Capstone implementation: core API and data model", concept: "vertical slice, domain invariant, API boundary, persistence, migrations, and validation", lab: "implement one end-to-end capstone flow through API, application, domain, and database", failure: "layer-only demo, missing constraints, and API success without durable state", apply: "add a database-backed integration test and review the generated SQL", interview: "Walk through a feature you personally designed and shipped, including trade-offs", outcome: "a working vertical slice with migration, tests, and documented API" },

  { phase: 6, title: "Capstone identity, authorization, and secure operations", concept: "identity, resource ownership, secret management, input trust, and least privilege", lab: "protect capstone operations and enforce tenant/resource ownership", failure: "IDOR, role confusion, credential leakage, and authorization missing on one route", apply: "run the threat checklist against every externally reachable operation", interview: "Describe a security risk you found and how you reduced it", outcome: "security tests, access matrix, and documented identity configuration" },
  { phase: 6, title: "Capstone reliability, integration, and asynchronous workflow", concept: "timeouts, retries, outbox, idempotency, background workers, and degraded-mode behavior", lab: "add one reliable asynchronous workflow with observable retry and deduplication", failure: "unknown remote outcome, duplicate delivery, shutdown during work, and poison message", apply: "simulate dependency outage and verify recovery without duplicate business effects", interview: "Tell me about a failure mode you designed for and how you verified recovery", outcome: "an integration failure matrix and tested recovery behavior" },
  { phase: 6, title: "Capstone test, performance, CI, and safe deployment", concept: "test pyramid, real database boundary, CI gates, workload models, latency percentiles, container provenance, and release safety", lab: "run integration tests in CI, build a container, load-test a critical journey, and deploy to a test environment", failure: "flaky shared state, environment-only secrets, measuring averages only, unsafe migration, and no rollback", apply: "profile one bottleneck, make one evidence-led change, then exercise health checks and rollback", interview: "How do you balance delivery speed, performance, and release confidence?", outcome: "a green pipeline and before/after performance report with release and rollback evidence" },
  { phase: 6, title: "Incident command, root cause, and technical leadership", concept: "impact, mitigation, communication, evidence, decision framing, ownership, mentoring, and blameless actions", lab: "run a database/queue outage tabletop and write the incident review plus a cross-team improvement proposal", failure: "changing many variables at once, losing the timeline, fixing symptoms only, or leaving actions without owners", apply: "facilitate a review that turns the root cause into prioritized, measurable engineering changes", interview: "Describe a difficult incident and a technical direction you changed across people or teams", outcome: "an incident timeline, customer impact statement, owned actions, and truthful influence story" },
  { phase: 6, title: "Project deep dives and senior behavioral story bank", concept: "problem, constraints, options, decision, personal contribution, measurable outcome, and reflection", lab: "prepare stories for architecture, delivery, failure, conflict, mentoring, and impact", failure: "using only 'we', claiming unsupported metrics, and omitting alternatives or lessons", apply: "practice a concise version and then answer probing follow-ups with evidence", interview: "What is the hardest technical decision you personally owned, and what would you change now?", outcome: "six evidence-based stories and a project portfolio walkthrough" },
  { phase: 6, title: "Full interview loops, calibration, and targeted remediation", concept: "coding, system design, project deep dive, behavioral, role-specific depth, and interviewer communication", lab: "complete one timed coding, one system design, and one project/leadership mock", failure: "weak clarification, unstructured explanations, missed edge cases, and defensive follow-up responses", apply: "score evidence against correctness, trade-offs, ownership, communication, and learning", interview: "Run a complete senior C#/.NET interview loop and identify the top three gaps", outcome: "a mock scorecard, targeted two-week remediation list, and interview-ready project narrative" },
];

const dayPatterns = [
  {
    title: "Learn and model",
    make: (week) => `Study ${week.concept}. Write a one-page model in your own words, define unfamiliar terms, and draw the data/control flow before coding.`,
    output: "A concept map plus five closed-book recall questions."
  },
  {
    title: "Build the smallest working version",
    make: (week) => `Complete this week's lab: ${week.lab}. Start with the smallest observable behavior; commit a working baseline before adding polish.`,
    output: "A runnable implementation and a small, meaningful commit."
  },
  {
    title: "Test behavior and boundaries",
    make: (week) => `Add tests for the normal case, an empty/minimum case, a boundary case, and this week's risk: ${week.failure}.`,
    output: "A test matrix showing expected result and the rule each test protects."
  },
  {
    title: "Break it and debug from evidence",
    make: (week) => `Reproduce this failure deliberately: ${week.failure}. Capture the symptom, inspect state/logs/trace, find the cause, then add a regression test.`,
    output: "Reproduction steps, root cause, and a regression test."
  },
  {
    title: "Apply it in a realistic system",
    make: (week) => `Apply the week's idea to a real application: ${week.apply}. State constraints and explain what you intentionally did not build.`,
    output: "A small integrated feature or design artifact with explicit assumptions."
  },
  {
    title: "Explain it like an interview",
    make: (week) => `Answer aloud in 3–5 minutes: “${week.interview}” Give a concrete example, one alternative, the trade-off, and how you would verify the result.`,
    output: "A recorded or written answer, followed by two probing questions."
  },
  {
    title: "Review, retrieve, and demonstrate",
    make: (week) => `Without notes, recall the week's model; demonstrate ${week.outcome}. Fix one gap and write what you would change with more time.`,
    output: "The weekly outcome, a self-review, and a next-week question."
  }
];

const phaseNames = {
  1: "Foundations",
  2: "C# and computer science depth",
  3: "Professional .NET services",
  4: "Distributed systems and operations",
  5: "Interview and portfolio engineering",
  6: "Senior ownership and interview readiness"
};
const STORAGE_KEY = "visual-memory-lab.dotnet-roadmap.completed.v1";
const weeksElement = document.querySelector("#weeks");
const phaseFilter = document.querySelector("#phase-filter");
const searchInput = document.querySelector("#search");
const progressLabel = document.querySelector("#progress-label");
const progressElement = document.querySelector("#progress");
const statusElement = document.querySelector("#status");
let completedDays = new Set();
let storageReady = true;
let storageNotice = "";

const days = roadmapWeeks.flatMap((week, weekIndex) =>
  dayPatterns.map((pattern, dayIndex) => {
    const number = weekIndex * 7 + dayIndex + 1;
    return {
      number,
      weekNumber: weekIndex + 1,
      week,
      title: pattern.title,
      task: pattern.make(week),
      output: pattern.output,
      phase: week.phase
    };
  })
);
days.push({
  number: 365,
  weekNumber: 53,
  phase: 6,
  week: {
    title: "Final mastery demonstration",
    concept: "sustained practice, evidence-based self-assessment, role alignment, and continuous learning",
    interview: "What engineering impact are you prepared to own in your next role, and what evidence supports it?"
  },
  title: "Mastery demonstration",
  task: "Present the capstone architecture, code, tests, deployment, incident drill, and trade-offs end to end. Explain one difficult decision, show evidence, respond to a failure scenario, and identify a real gap you plan to close.",
  output: "A capstone walkthrough, honest skills matrix, and next 90-day learning plan."
});

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some(day => !Number.isInteger(day) || day < 1 || day > 365)) {
      throw new Error("Saved roadmap progress has an unexpected format.");
    }
    completedDays = new Set(parsed);
  } catch (error) {
    storageReady = false;
    storageNotice = `Progress could not be loaded or saved: ${error.message}. Your checklist remains usable for this page session.`;
  }
}

function updateProgress() {
  const count = completedDays.size;
  progressLabel.textContent = `${count} / 365 days`;
  progressElement.value = count;
  progressElement.setAttribute("aria-label", `${count} of 365 days completed`);
}

function render() {
  const selectedPhase = phaseFilter.value;
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleDays = days.filter(day => {
    const matchesPhase = selectedPhase === "all" || String(day.phase) === selectedPhase;
    const searchable = `${day.number} ${day.week.title} ${day.week.concept} ${day.title} ${day.task} ${day.output} ${day.week.interview} ${phaseNames[day.phase]}`.toLocaleLowerCase();
    return matchesPhase && (!query || searchable.includes(query));
  });
  const visibleWeeks = new Map();
  for (const day of visibleDays) {
    const key = day.weekNumber;
    if (!visibleWeeks.has(key)) visibleWeeks.set(key, []);
    visibleWeeks.get(key).push(day);
  }
  if (visibleDays.length === 0) {
    weeksElement.innerHTML = '<div class="empty">No day matches that filter. Try a broader topic or another stage.</div>';
    statusElement.textContent = `No matching study days.${storageNotice ? ` ${storageNotice}` : ""}`;
    return;
  }
  weeksElement.innerHTML = [...visibleWeeks.entries()].map(([weekNumber, weekDays]) => {
    const week = weekDays[0].week;
    const dayCards = weekDays.map(day => `
      <article class="day${completedDays.has(day.number) ? " completed" : ""}">
        <div class="day-head">
          <div><span class="day-number">DAY ${day.number}</span><h4>${day.title}</h4></div>
            <span class="phase-tag">${day.weekNumber === 53 ? "Final review" : `Week ${day.weekNumber}`}</span>
        </div>
        <p>${day.task}</p>
        <div class="deliverable"><strong>Finish with:</strong> ${day.output}</div>
        <label><input type="checkbox" data-day="${day.number}" ${completedDays.has(day.number) ? "checked" : ""} /> Mark day complete</label>
      </article>`).join("");
      const isFinalReview = weekNumber === 53;
      return `
        <section class="week" aria-label="${isFinalReview ? "Day 365 final mastery review" : `Week ${weekNumber}: ${week.title}`}">
          <div class="week-head">
            <div><h3>${isFinalReview ? "Day 365 · Final mastery review" : `Week ${weekNumber} · Days ${weekDays[0].number}–${weekDays[weekDays.length - 1].number}: ${week.title}`}</h3>
            <p><strong>Weekly outcome:</strong> ${week.outcome}</p></div>
            <span class="phase-tag">Stage ${week.phase} · ${phaseNames[week.phase]}</span>
        </div>
        <div class="day-list">${dayCards}</div>
      </section>`;
  }).join("");
  const visibleWeekCount = [...visibleWeeks.keys()].filter(number => number !== 53).length;
  const finalReviewVisible = visibleWeeks.has(53);
  statusElement.textContent = `Showing ${visibleDays.length} of 365 study days across ${visibleWeekCount} weekly modules${finalReviewVisible ? " plus the final mastery review" : ""}.${storageNotice ? ` ${storageNotice}` : ""}`;
}

weeksElement.addEventListener("change", event => {
  const checkbox = event.target.closest("input[data-day]");
  if (!checkbox) return;
  const day = Number(checkbox.dataset.day);
  if (checkbox.checked) completedDays.add(day);
  else completedDays.delete(day);
  if (storageReady) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...completedDays].sort((a, b) => a - b)));
    } catch (error) {
      storageReady = false;
      storageNotice = `Progress is updated for this session but could not be saved: ${error.message}.`;
      statusElement.textContent = storageNotice;
    }
  }
  checkbox.closest(".day").classList.toggle("completed", checkbox.checked);
  updateProgress();
});

phaseFilter.addEventListener("change", render);
searchInput.addEventListener("input", render);
loadProgress();
updateProgress();
render();
