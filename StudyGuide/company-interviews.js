(() => {
  const SESSION_KEY = "visual-memory-lab.auth-session";
  const TIERS = ["Pro"];
  let lockedQuestions = [];
  const providers = { razorpay: "Razorpay", stripe: "Stripe", paypal: "PayPal" };
  const status = document.getElementById("access-status");
  const list = document.getElementById("question-list");
  const count = document.getElementById("count");
  const empty = document.getElementById("empty");
  const companyFilter = document.getElementById("company-filter");
  const topicFilter = document.getElementById("topic-filter");
  const search = document.getElementById("search");
  const providerSelect = document.getElementById("payment-provider");
  let config;
  let questions = [];
  let access = { signedIn: false, tiers: [], isAdmin: false };
  let session = readSession();

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function saveSession(value) {
    session = value;
    if (value) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      syncSessionCookie(value);
    } else {
      localStorage.removeItem(SESSION_KEY);
      fetch("/api/session", { method: "DELETE" }).catch(() => {});
    }
  }

  async function syncSessionCookie(value) {
    if (!value?.access_token) return;
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: value.access_token }),
    }).catch(() => {});
  }

  function setStatus(message) {
    status.textContent = message;
  }

  async function readJson(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || `Request failed (${response.status}).`);
    return body;
  }

  async function authRequest(endpoint, body) {
    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/auth/v1/${endpoint}`, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result = await readJson(response);
    if (result.access_token) {
      saveSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at || Math.floor(Date.now() / 1000) + (result.expires_in || 3600),
        user: result.user,
      });
    }
    return result;
  }

  async function getAccessToken() {
    if (!session?.access_token) return null;
    if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session.access_token;
    if (!session.refresh_token) {
      saveSession(null);
      return null;
    }
    try {
      const refreshed = await authRequest("token?grant_type=refresh_token", {
        refresh_token: session.refresh_token,
      });
      return refreshed.access_token;
    } catch {
      saveSession(null);
      throw new Error("Your sign-in expired. Please sign in again.");
    }
  }

  async function apiRequest(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.body) headers.set("Content-Type", "application/json");
    return fetch(url, { ...options, headers });
  }

  async function loadConfig() {
    config = await readJson(await fetch("/api/config"));
    const readyProviders = Object.keys(providers).filter(provider => config.providers[provider]);
    providerSelect.replaceChildren();
    for (const provider of Object.keys(providers)) {
      const option = document.createElement("option");
      option.value = provider;
      option.textContent = config.providers[provider] ? providers[provider] : `${providers[provider]} (not configured)`;
      option.disabled = !config.providers[provider];
      providerSelect.append(option);
    }
    if (readyProviders.length) providerSelect.value = readyProviders[0];
    document.querySelector(".provider-choice").hidden = !readyProviders.length;
    document.getElementById("tier-controls").hidden = false;
    document.getElementById("provider-note").textContent = readyProviders.length
      ? "The server verifies each provider webhook before changing access. PayPal amounts are displayed in USD and configured separately."
      : "No payment provider is configured with both checkout and webhook verification settings yet.";
    updateTierPrices();
  }

  function updateTierPrices() {
    const isPayPal = providerSelect.value === "paypal";
    const providerReady = Boolean(config?.providers?.[providerSelect.value]);
    document.querySelectorAll("[data-tier]").forEach(button => {
      const tier = button.dataset.tier;
      const label = tier === "Pro" ? "Subscribe to Pro" : `Unlock ${tier}`;
      const price = isPayPal ? config?.paypalAmounts?.[tier] : null;
      const priceLabel = price && /^\d+\.\d{2}$/.test(price)
        ? `$${price} USD`
        : `₹${config?.plans?.[tier]?.toLocaleString("en-IN") || "—"}`;
      button.textContent = providerReady ? `${label} · ${priceLabel}` : `${label} · payment unavailable`;
      button.disabled = access.tiers.includes("Pro") || !providerReady;
    });
  }

  function makeQuestionCard(item) {
    const card = document.createElement("details");
    card.className = "question";
    card.dataset.company = item.company;
    card.dataset.topic = item.topic;

    const summary = document.createElement("summary");
    const tags = document.createElement("span");
    tags.className = "tag-row";
    const companyTag = document.createElement("span");
    companyTag.className = "tag company";
    companyTag.textContent = item.company;
    const topicTag = document.createElement("span");
    topicTag.className = "tag";
    topicTag.textContent = item.topic;
    tags.append(companyTag, topicTag);
    const title = document.createElement("span");
    title.className = "question-title";
    title.textContent = item.question;
    summary.append(tags, title);

    const answer = document.createElement("div");
    answer.className = "answer";
    const answerText = document.createElement("p");
    const answerLabel = document.createElement("strong");
    answerLabel.textContent = "Answer: ";
    answerText.append(answerLabel, document.createTextNode(item.answer));
    const example = document.createElement("p");
    example.className = "example";
    const exampleLabel = document.createElement("strong");
    exampleLabel.textContent = "Example: ";
    example.append(exampleLabel, document.createTextNode(item.example));
    answer.append(answerText, example);
    card.append(summary, answer);
    return card;
  }

  function makeLockedCard(item) {
    const card = document.createElement("article");
    card.className = "question locked-card";
    card.dataset.company = item.company;
    card.dataset.topic = item.topic;

    const preview = document.createElement("div");
    preview.className = "locked-preview";
    const tags = document.createElement("span");
    tags.className = "tag-row";
    const companyTag = document.createElement("span");
    companyTag.className = "tag company";
    companyTag.textContent = item.company;
    const topicTag = document.createElement("span");
    topicTag.className = "tag";
    topicTag.textContent = item.topic;
    tags.append(companyTag, topicTag);
    const title = document.createElement("span");
    title.className = "question-title";
    title.textContent = "Unlock Pro to view this question";
    preview.append(tags, title);

    const copy = document.createElement("p");
    copy.className = "locked-copy";
    const heading = document.createElement("strong");
    heading.textContent = "Pro question";
    copy.append(heading, document.createTextNode("The answer and example are included with a Pro subscription."));
    const upgrade = document.createElement("button");
    upgrade.type = "button";
    upgrade.textContent = "Unlock Pro";
    upgrade.dataset.localProUnlock = "";
    upgrade.hidden = true;
    upgrade.addEventListener("click", () => document.getElementById("access-heading").scrollIntoView({ behavior: "smooth" }));
    copy.append(upgrade);
    card.append(preview, copy);
    return card;
  }

  function updateQuestions() {
    const company = companyFilter.value;
    const topic = topicFilter.value;
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const card of list.children) {
      const show = (company === "all" || card.dataset.company === company)
        && (topic === "all" || card.dataset.topic === topic)
        && (!query || card.textContent.toLocaleLowerCase().includes(query));
      card.hidden = !show;
      if (show) visible++;
    }
    count.textContent = `Showing ${visible} questions available to your account.`;
    empty.style.display = visible ? "none" : "block";
  }

  async function loadQuestions() {
    const response = await readJson(await apiRequest("/api/questions"));
    questions = response.questions;
    lockedQuestions = response.locked || [];
    access = response.access;
    if (!access.signedIn && session) saveSession(null);
    const cards = questions.map(makeQuestionCard);
    if (!access.tiers.includes("Pro")) cards.push(...lockedQuestions.map(makeLockedCard));
    list.replaceChildren(...cards);
    document.getElementById("sign-out").hidden = !access.signedIn;
    document.getElementById("refresh-access").hidden = !access.signedIn;
    document.getElementById("tier-controls").hidden = false;
    document.getElementById("admin-panel").hidden = !access.isAdmin;
    const proActive = access.tiers.includes("Pro");
    setStatus(access.signedIn
      ? `Signed in${session?.user?.email ? ` as ${session.user.email}` : ""}. ${proActive ? "Pro active: complete question library unlocked." : "Free preview: first 10 questions per topic are visible."}`
            : "Free preview: first 10 questions per topic are visible. Sign in and upgrade to Pro to unlock later questions.");
    updateQuestions();
    updateTierAvailability();
    return access;
  }

  function updateTierAvailability() {
    document.querySelectorAll("[data-tier]").forEach(button => {
      const tier = button.dataset.tier;
      button.closest(".tier-card").hidden = access.tiers.includes("Pro") || access.tiers.includes(tier);
    });
  }

  async function refreshAfterCheckout() {
    const params = new URLSearchParams(location.search);
    if (params.get("payment") !== "pending") return;
    const requestedTier = params.get("tier");
    setStatus("Checkout returned. Waiting for the payment provider’s verified webhook; access will not unlock until the server confirms payment.");
    if (TIERS.includes(requestedTier)) {
      if (params.get("token")) {
        setStatus("Completing PayPal capture. Access still requires signed webhook confirmation.");
        await readJson(await apiRequest("/api/paypal/capture", {
          method: "POST",
          body: JSON.stringify({ orderId: params.get("token") }),
        }));
      }
      for (let attempt = 0; attempt < 10; attempt++) {
        const current = await loadQuestions();
        if (current.tiers.includes("Pro") || current.tiers.includes(requestedTier)) {
          setStatus(`Payment confirmed by the server. ${requestedTier} access is active.`);
          break;
        }
        if (attempt < 9) {
          setStatus("Payment is not yet confirmed by the server. Checking again shortly…");
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          setStatus("Payment is still awaiting server verification. Use Refresh access in a moment; do not pay again unless your provider confirms the first checkout failed.");
        }
      }
    }
    history.replaceState(null, "", `${location.pathname}${location.hash}`);
  }

  async function purchase() {
    if (!await getAccessToken()) {
      setStatus("Sign in or create an account before subscribing to Pro.");
      document.getElementById("auth-email").focus();
      return;
    }

    const provider = providerSelect.value;
    if (!config?.providers?.[provider]) {
      throw new Error("No verified payment provider is configured. Pro access is not available for purchase yet.");
    }

    setStatus("Creating a secure checkout session…");
    const checkout = await readJson(await apiRequest("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ tier: "Pro", provider }),
    }));
    if (typeof checkout.checkoutUrl !== "string" || !checkout.checkoutUrl.startsWith("https://")) {
      throw new Error("The payment provider returned an invalid checkout URL.");
    }
    window.location.assign(checkout.checkoutUrl);
  }

  async function manageEntitlement(active) {
    const userId = document.getElementById("admin-user-id").value.trim();
    const tier = document.getElementById("admin-tier").value;
    if (!userId) throw new Error("Enter the target Supabase user ID.");
    await readJson(await apiRequest("/api/admin/entitlements", {
      method: "POST",
      body: JSON.stringify({ userId, tier, active }),
    }));
    setStatus(`${tier} access ${active ? "granted" : "revoked"} for the requested user.`);
    await loadQuestions();
  }

  document.getElementById("sign-in").addEventListener("click", async () => {
    try {
      await authRequest("token?grant_type=password", {
        email: document.getElementById("auth-email").value.trim(),
        password: document.getElementById("auth-password").value,
      });
      await loadQuestions();
    } catch (error) {
      setStatus(error.message);
    }
  });

  document.getElementById("sign-up").addEventListener("click", async () => {
    try {
      const result = await authRequest("signup", {
        email: document.getElementById("auth-email").value.trim(),
        password: document.getElementById("auth-password").value,
      });
      if (result.access_token) await loadQuestions();
      else setStatus("Account created. Check your email to confirm the account, then sign in.");
    } catch (error) {
      setStatus(error.message);
    }
  });

  document.getElementById("sign-out").addEventListener("click", async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/auth/v1/logout`, {
          method: "POST",
          headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}` },
        });
      }
      saveSession(null);
      await loadQuestions();
    } catch (error) {
      setStatus(error.message);
    }
  });

  document.getElementById("refresh-access").addEventListener("click", async () => {
    try {
      setStatus("Refreshing server-verified access…");
      await loadQuestions();
    } catch (error) {
      setStatus(error.message);
    }
  });

  document.querySelectorAll("[data-tier]").forEach(button => button.addEventListener("click", async () => {
    try {
      await purchase(button.dataset.tier);
    } catch (error) {
      setStatus(error.message);
      updateTierPrices();
    }
  }));

  providerSelect.addEventListener("change", updateTierPrices);
  document.getElementById("admin-grant").addEventListener("click", async () => {
    try {
      await manageEntitlement(true);
    } catch (error) {
      setStatus(error.message);
    }
  });
  document.getElementById("admin-revoke").addEventListener("click", async () => {
    try {
      await manageEntitlement(false);
    } catch (error) {
      setStatus(error.message);
    }
  });
  document.getElementById("reset").addEventListener("click", () => {
    companyFilter.value = "all";
    topicFilter.value = "all";
    search.value = "";
    updateQuestions();
  });
  const requestedTopic = new URLSearchParams(location.search).get("topic");
  if ([...topicFilter.options].some(option => option.value === requestedTopic)) {
    topicFilter.value = requestedTopic;
  }
  companyFilter.addEventListener("change", updateQuestions);
  topicFilter.addEventListener("change", updateQuestions);
  search.addEventListener("input", updateQuestions);

  (async () => {
    try {
      await loadConfig();
      const token = await getAccessToken();
      if (token && session) await syncSessionCookie(session);
      await loadQuestions();
      await refreshAfterCheckout();
    } catch (error) {
      setStatus(error.message);
      count.textContent = "";
      empty.textContent = "Questions could not be loaded. Check the server configuration and try again.";
      empty.style.display = "block";
    }
  })();
})();
