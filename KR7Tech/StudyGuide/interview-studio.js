"use strict";

const STORAGE_KEY = "visual-memory-lab.interview-studio.v1";
const state = {
  completed: new Set(),
  answers: {},
  designChecks: [],
  incidentStep: 0,
  incidentHistory: []
};
const saveStatus = document.querySelector("#save-status");
const overallProgress = document.querySelector("#overall-progress");
const overallProgressBar = document.querySelector("#overall-progress-bar");
let persistenceAvailable = true;

const incidentStages = [
  {
    title: "Minute 0 · Triage",
    evidence: "Order API p95 latency rose from 180 ms to 4.8 s. Error rate is 18%. Database CPU is 88%; connection-pool wait is climbing. A carrier dependency is timing out. No deployment occurred in the last hour.",
    options: [
      { id: "scope", label: "Declare/coordinate incident, check customer impact and traces, and pause nonessential expensive work while preserving evidence.", quality: "good", result: "You establish an incident lead, scope affected tenants/routes, and preserve a representative trace. Evidence points to connection saturation amplified by waiting carrier calls." },
      { id: "restart", label: "Restart every API instance immediately to clear the symptoms.", quality: "poor", result: "The restart briefly drains connections but drops in-flight work and hides evidence. The carrier remains slow, so queues and latency build again." },
      { id: "retry", label: "Increase all outbound retries so carrier calls eventually succeed.", quality: "poor", result: "More retries increase concurrent work against an already slow dependency and amplify load on the API and database." }
    ]
  },
  {
    title: "Minute 8 · Mitigation",
    evidence: "Traces show each request holds a database connection while awaiting carrier status. The carrier's latency is 12 seconds. The API has a bounded request timeout, but its retry policy currently retries three times.",
    options: [
      { id: "isolate", label: "Stop holding a database transaction/connection across the network call; cap carrier concurrency and use a short timeout with a circuit breaker/fallback.", quality: "good", result: "New requests release scarce database capacity promptly. Carrier work is bounded; the API serves the last known status with an explicit freshness indicator." },
      { id: "scale", label: "Immediately double application instances without limiting dependency concurrency.", quality: "mixed", result: "More instances may reduce some local queueing, but they can multiply pressure on the database and carrier. Scaling alone does not remove the coupling." },
      { id: "cache-all", label: "Cache every response indefinitely to eliminate database load.", quality: "poor", result: "Load drops, but status becomes silently stale and tenant-specific authorization may be bypassed if cache keys are incomplete." }
    ]
  },
  {
    title: "Minute 20 · Verify recovery",
    evidence: "After isolation and bounded concurrency, API p95 is 420 ms and errors are down to 2%. Carrier calls remain unhealthy. Queue depth is stable but 3,200 status refreshes are waiting.",
    options: [
      { id: "verify", label: "Keep the safe fallback, shed or defer low-priority refreshes, monitor queue age and SLOs, then replay gradually after dependency health returns.", quality: "good", result: "Customer-facing API remains responsive. Queue work is paced to recovery, with idempotent refreshes and visible freshness/lag." },
      { id: "replay-all", label: "Release all queued refreshes at once so the backlog clears quickly.", quality: "poor", result: "A recovery stampede overloads the carrier again and risks returning the service to the same failure state." },
      { id: "close", label: "Close the incident because error rate is lower, without checking queue age or stale data.", quality: "poor", result: "The immediate symptom improved, but customer-visible data freshness and backlog recovery remain unverified." }
    ]
  },
  {
    title: "After recovery · Learn and prevent recurrence",
    evidence: "Carrier latency returned to normal. The queue is draining. The team has traces for the incident and customer support confirms the API stayed available with clearly marked stale status.",
    options: [
      { id: "postmortem", label: "Write an impact/timeline/root-cause review; add regression tests, alert on pool wait and queue age, document ownership, and track actions.", quality: "good", result: "The review distinguishes trigger from contributing design flaws. Actions have owners and dates; a failure-injection test verifies the fallback and recovery path." },
      { id: "blame", label: "Record the engineer who changed the retry count as the root cause and stop there.", quality: "poor", result: "This misses systemic conditions and leaves the unsafe coupling, alert gaps, and recovery risks unchanged." },
      { id: "nothing", label: "Make no changes because the dependency recovered by itself.", quality: "poor", result: "The same dependency slowdown can reproduce the resource-exhaustion chain." }
    ]
  }
];

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      throw new Error("Saved practice data has an unexpected format.");
    }
    const completed = Array.isArray(saved.completed) ? saved.completed : [];
    if (completed.some(item => !["debug", "sql", "design", "incident", "story"].includes(item))) {
      throw new Error("Saved exercise progress is invalid.");
    }
    const incidentStep = Number.isInteger(saved.incidentStep) ? saved.incidentStep : 0;
    if (incidentStep < 0 || incidentStep > incidentStages.length) {
      throw new Error("Saved incident simulation state is invalid.");
    }
    state.completed = new Set(completed);
    state.answers = saved.answers && typeof saved.answers === "object" ? saved.answers : {};
    state.designChecks = Array.isArray(saved.designChecks) ? saved.designChecks : [];
    state.incidentStep = incidentStep;
    state.incidentHistory = Array.isArray(saved.incidentHistory) ? saved.incidentHistory : [];
  } catch (error) {
    persistenceAvailable = false;
    saveStatus.textContent = `Saved practice could not be loaded: ${error.message}. Your work remains available for this page session.`;
  }
}

readState();

function persist() {
  if (!persistenceAvailable) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      completed: [...state.completed],
      answers: state.answers,
      designChecks: state.designChecks,
      incidentStep: state.incidentStep,
      incidentHistory: state.incidentHistory
    }));
    saveStatus.textContent = "Practice notes are saved in this browser on this device.";
  } catch (error) {
    persistenceAvailable = false;
    saveStatus.textContent = `Your work is available for this session but could not be saved: ${error.message}.`;
  }
}

function updateProgress() {
  const count = state.completed.size;
  overallProgress.textContent = `${count} / 5 exercises completed`;
  overallProgressBar.value = count;
  overallProgressBar.setAttribute("aria-label", `${count} of 5 exercises completed`);
}

function setComplete(id, complete = true) {
  if (complete) state.completed.add(id);
  else state.completed.delete(id);
  updateProgress();
  persist();
}

function showOutput(element, heading, paragraphs) {
  element.replaceChildren();
  const title = document.createElement("h3");
  title.textContent = heading;
  element.appendChild(title);
  for (const text of paragraphs) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    element.appendChild(paragraph);
  }
  element.hidden = false;
}

function saveTextInputs() {
  document.querySelectorAll("[data-save]").forEach(input => {
    input.value = typeof state.answers[input.id] === "string" ? state.answers[input.id] : "";
    input.addEventListener("input", () => {
      state.answers[input.id] = input.value;
      persist();
    });
  });
  document.querySelectorAll("[data-story]").forEach(input => {
    input.value = typeof state.answers[`story-${input.dataset.story}`] === "string"
      ? state.answers[`story-${input.dataset.story}`]
      : "";
    input.addEventListener("input", () => {
      state.answers[`story-${input.dataset.story}`] = input.value;
      persist();
    });
  });
}

const debugSelect = document.querySelector("#debug-answer");
const debugPlan = document.querySelector("#debug-plan");
const debugFeedback = document.querySelector("#debug-feedback");
debugSelect.value = typeof state.answers.debugChoice === "string" ? state.answers.debugChoice : "";
debugSelect.addEventListener("change", () => {
  state.answers.debugChoice = debugSelect.value;
  persist();
});
document.querySelector("#debug-submit").addEventListener("click", () => {
  if (debugSelect.value === "idempotency") {
    setComplete("debug");
    showOutput(debugFeedback, "Correct primary diagnosis", [
      "A timeout does not prove the provider failed to charge. Retrying without a stable idempotency key can create a second charge. Cancellation also does not reverse a payment already accepted by the provider.",
      "A robust flow creates a durable payment attempt tied to a stable order/operation ID, passes the provider's idempotency key when supported, and reconciles ambiguous outcomes before retrying. Persist state transitions and make webhook handling idempotent.",
      debugPlan.value.trim()
        ? `Your fix plan: ${debugPlan.value.trim()}`
        : "Write your fix plan: define the idempotency key, durable states, ambiguous-timeout reconciliation, and tests for retry/duplicate callback."
    ]);
  } else {
    showOutput(debugFeedback, debugSelect.value ? "Revisit the scenario" : "Choose a diagnosis first", [
      "The key clue is a timeout after an external side effect: the outcome may be unknown. Reordering two separate network/database operations does not make them atomic.",
      "Look for duplicate suppression, provider reconciliation, a durable payment-attempt state machine, and tests for retry after an ambiguous response."
    ]);
  }
});

document.querySelector("#sql-submit").addEventListener("click", () => {
  const query = document.querySelector("#sql-answer").value.trim().toLowerCase();
  const index = document.querySelector("#sql-index").value.trim();
  const checks = [
    ["SELECT list is bounded to required output", /\bselect\b/.test(query) && !/\bselect\s+\*/.test(query)],
    ["Query reads Orders", /\bfrom\s+orders\b/.test(query)],
    ["Customer is a parameterized filter", /\bwhere\b/.test(query) && /customerid/.test(query) && /[@:]\w+/.test(query)],
    ["Newest-first sort is present", /\border\s+by\b/.test(query) && /createdat/.test(query) && /\bdesc\b/.test(query)],
    ["Result count is capped", /\btop\s*\(?\s*20|\bfetch\s+(?:first|next)\s+20|\boffset\b[\s\S]*?\bfetch\b/i.test(query)]
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  if (passed >= 4 && index.length >= 12) setComplete("sql");
  showOutput(document.querySelector("#sql-feedback"), `${passed} of ${checks.length} query checks matched`, [
    ...checks.map(([name, ok]) => `${ok ? "✓" : "○"} ${name}`),
    `Index reasoning provided: ${index.length >= 12 ? "yes" : "not yet—describe a possible (CustomerId, CreatedAt) key and justify included columns from the plan."}`,
    "A likely starting hypothesis is a composite index beginning with CustomerId followed by CreatedAt in the needed order, with only useful projected columns considered for INCLUDE. Validate it against the actual execution plan, selectivity, write cost, and workload; this checklist does not execute SQL."
  ]);
});

const designChecks = [...document.querySelectorAll("#design-checks input")];
for (const checkbox of designChecks) {
  checkbox.checked = state.designChecks.includes(checkbox.value);
  checkbox.addEventListener("change", () => {
    state.designChecks = designChecks.filter(item => item.checked).map(item => item.value);
    persist();
  });
}
document.querySelector("#design-submit").addEventListener("click", () => {
  const checked = designChecks.filter(item => item.checked).length;
  const notes = document.querySelector("#design-notes").value.trim();
  if (checked === designChecks.length && notes.length >= 80) setComplete("design");
  showOutput(document.querySelector("#design-feedback"), `Coverage self-check: ${checked} of ${designChecks.length}`, [
    "This is a coverage prompt, not a score for architecture correctness. For every choice, connect it to a requirement and state an alternative and its cost.",
    "Strong answers clarify tenant boundary and freshness, define read/write APIs and data ownership, estimate peak and growth, then trace the carrier outage through timeout, stale-read policy, queue capacity, recovery, and observability.",
    notes ? `Your notes (${notes.length} characters) are saved locally. Revisit assumptions and failure paths before calling the design complete.` : "Add your design notes before marking this exercise complete."
  ]);
});

function renderIncident() {
  const stateElement = document.querySelector("#incident-state");
  const optionsElement = document.querySelector("#incident-options");
  const submitButton = document.querySelector("#incident-submit");
  const feedback = document.querySelector("#incident-feedback");
  optionsElement.replaceChildren();
  feedback.hidden = true;
  if (state.incidentStep >= incidentStages.length) {
    stateElement.textContent = "Simulation complete. Review the timeline and write a short post-incident summary: impact, root cause, mitigation, and prevention.";
    submitButton.disabled = true;
    setComplete("incident");
    if (state.incidentHistory.length) {
      const summary = state.incidentHistory.map((item, index) =>
        `Stage ${index + 1}: ${item.quality === "good" ? "safe response" : item.quality === "mixed" ? "partial response" : "risky response"} — ${item.result}`
      );
      showOutput(feedback, "Your incident timeline", summary);
    }
    return;
  }
  const stage = incidentStages[state.incidentStep];
  const stageTitle = document.createElement("strong");
  stageTitle.textContent = stage.title;
  stateElement.replaceChildren(stageTitle, document.createElement("br"), document.createTextNode(stage.evidence));
  for (const option of stage.options) {
    const label = document.createElement("label");
    label.className = "option";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "incident-choice";
    radio.value = option.id;
    const text = document.createElement("span");
    text.textContent = option.label;
    label.append(radio, text);
    optionsElement.appendChild(label);
  }
  submitButton.disabled = false;
}

document.querySelector("#incident-submit").addEventListener("click", () => {
  const selected = document.querySelector('input[name="incident-choice"]:checked');
  if (!selected) {
    showOutput(document.querySelector("#incident-feedback"), "Choose a response", ["Select the action you would take, then apply it to reveal the next evidence."]);
    return;
  }
  const stage = incidentStages[state.incidentStep];
  const choice = stage.options.find(option => option.id === selected.value);
  state.incidentHistory.push({ title: stage.title, quality: choice.quality, result: choice.result });
  state.incidentStep += 1;
  persist();
  renderIncident();
  if (state.incidentStep >= incidentStages.length) return;
  if (choice.quality === "good") {
    showOutput(document.querySelector("#incident-feedback"), "Response applied", [choice.result]);
  } else {
    showOutput(document.querySelector("#incident-feedback"), choice.quality === "mixed" ? "Trade-off to examine" : "Potentially unsafe action", [choice.result]);
  }
});

document.querySelector("#incident-reset").addEventListener("click", () => {
  state.incidentStep = 0;
  state.incidentHistory = [];
  setComplete("incident", false);
  renderIncident();
});

document.querySelector("#story-build").addEventListener("click", () => {
  const fields = [...document.querySelectorAll("[data-story]")];
  const values = fields.map(input => [
    input.closest("label").childNodes[0].textContent.trim(),
    input.value.trim()
  ]);
  const populated = values.filter(([, value]) => value.length > 0).length;
  const output = document.querySelector("#story-output");
  output.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = populated === values.length ? "Your project story outline" : `Story draft: ${populated} of ${values.length} areas filled`;
  output.appendChild(heading);
  for (const [label, value] of values) {
    const paragraph = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    paragraph.append(strong, document.createTextNode(value || "[Add a truthful detail]"));
    output.appendChild(paragraph);
  }
  const hint = document.createElement("p");
  hint.textContent = "Practice answering in 2–3 minutes, then handle follow-ups. Replace confidential names/data before sharing; use only verifiable outcomes.";
  output.appendChild(hint);
  output.hidden = false;
  if (populated === values.length) setComplete("story");
});

document.querySelectorAll("[data-clear]").forEach(button => {
  button.addEventListener("click", () => {
    const kind = button.dataset.clear;
    if (kind === "debug") {
      debugSelect.value = "";
      debugPlan.value = "";
      delete state.answers.debugChoice;
      state.answers[debugPlan.id] = "";
      debugFeedback.hidden = true;
    } else if (kind === "sql") {
      for (const id of ["sql-answer", "sql-index"]) {
        document.querySelector(`#${id}`).value = "";
        state.answers[id] = "";
      }
      document.querySelector("#sql-feedback").hidden = true;
    } else if (kind === "design") {
      document.querySelector("#design-notes").value = "";
      state.answers["design-notes"] = "";
      state.designChecks = [];
      designChecks.forEach(input => { input.checked = false; });
      document.querySelector("#design-feedback").hidden = true;
    } else if (kind === "story") {
      document.querySelectorAll("[data-story]").forEach(input => {
        input.value = "";
        delete state.answers[`story-${input.dataset.story}`];
      });
      document.querySelector("#story-output").hidden = true;
    }
    setComplete(kind, false);
  });
});

saveTextInputs();
updateProgress();
renderIncident();
