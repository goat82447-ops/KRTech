(() => {
  const FREE_ITEMS_PER_SECTION = 8;
  const SESSION_KEY = "visual-memory-lab.auth-session";
  const CANDIDATE_SELECTOR = ".problem, .pattern-card, .lld-card, .card";
  const freeItems = new Set();
  const unlockedItems = new Set();
  let isAdmin = false;
  let unlockAll = false;
  let scheduled = false;

  const style = document.createElement("style");
  style.textContent = `
    .guide-lock-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin:0 0 18px; padding:12px 15px; border:1px solid #d5a843; border-radius:10px; background:#fff7df; color:#493b1d; font:600 14px/1.4 system-ui,sans-serif; }
    .guide-lock-toolbar[hidden] { display:none !important; }
    .guide-lock-toolbar button, .guide-lock-overlay button { border:0; border-radius:7px; padding:8px 11px; background:#176b59; color:#fff; font:inherit; font-weight:700; cursor:pointer; }
    .guide-lock-overlay { display:flex; min-height:110px; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:18px; border:1px dashed #b78b2c; border-radius:10px; background:linear-gradient(135deg,#fff8e6,#f3ead0); color:#55451f; text-align:center; }
    .guide-lock-overlay strong { font-size:1rem; }
    .guide-lock-overlay span { font-size:.88rem; }
  `;
  document.head.append(style);

  function sessionToken() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null")?.access_token || null;
    } catch {
      return null;
    }
  }

  function itemKey(item) {
    const section = item.closest("section");
    const sectionTitle = section?.querySelector("h2")?.textContent?.trim() || section?.id || "guide";
    const title = item.querySelector("h2, h3, h4, summary, .problem-title")?.textContent?.trim()
      || item.textContent.trim().slice(0, 100);
    return `${sectionTitle}::${title}`;
  }

  function toolbar() {
    let bar = document.querySelector(".guide-lock-toolbar");
    if (bar) return bar;
    bar = document.createElement("aside");
    bar.className = "guide-lock-toolbar";
    bar.hidden = true;
    bar.setAttribute("aria-label", "Administrator content controls");
    const label = document.createElement("span");
    label.textContent = "Administrator controls: guide items are locked by default.";
    const unlock = document.createElement("button");
    unlock.type = "button";
    unlock.textContent = "Unlock all remaining";
    unlock.addEventListener("click", () => {
      unlockAll = true;
      updateCards();
    });
    const lock = document.createElement("button");
    lock.type = "button";
    lock.textContent = "Lock all again";
    lock.addEventListener("click", () => {
      unlockAll = false;
      unlockedItems.clear();
      updateCards();
    });
    bar.append(label, unlock, lock);
    const main = document.querySelector("main") || document.body;
    main.prepend(bar);
    return bar;
  }

  function createOverlay(item, key) {
    const overlay = document.createElement("div");
    overlay.className = "guide-lock-overlay";
    overlay.dataset.guideLockOverlay = "true";
    const title = document.createElement("strong");
    title.textContent = "🔒 Locked concept";
    const description = document.createElement("span");
    description.textContent = "This item is locked. The first eight items in each section are available as previews.";
    overlay.append(title, description);
    if (isAdmin) {
      const unlock = document.createElement("button");
      unlock.type = "button";
      unlock.textContent = "Unlock this item";
      unlock.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        unlockedItems.add(key);
        updateCard(item);
      });
      overlay.append(unlock);
    }
    return overlay;
  }

  function updateCard(item) {
    const key = item.dataset.guideLockKey;
    const overlay = item.querySelector(":scope > .guide-lock-overlay");
    const shouldUnlock = freeItems.has(key) || unlockAll || unlockedItems.has(key);
    for (const child of Array.from(item.children)) {
      if (child === overlay) continue;
      child.hidden = !shouldUnlock;
    }
    if (shouldUnlock) {
      overlay?.remove();
      item.classList.remove("guide-locked");
      return;
    }
    item.classList.add("guide-locked");
    if (!overlay) item.append(createOverlay(item, key));
    else if (isAdmin && !overlay.querySelector("button")) item.append(createOverlay(item, key));
  }

  function updateCards() {
    document.querySelectorAll(CANDIDATE_SELECTOR).forEach(item => {
      if (item.dataset.guideLockKey) updateCard(item);
    });
  }

  function applyLocks() {
    scheduled = false;
    const groups = new Map();
    const candidates = Array.from(document.querySelectorAll(CANDIDATE_SELECTOR))
      .filter(item => !item.parentElement?.closest(CANDIDATE_SELECTOR));

    candidates.forEach(item => {
      const section = item.closest("section") || item.parentElement;
      if (!groups.has(section)) groups.set(section, []);
      groups.get(section).push(item);
    });

    for (const items of groups.values()) {
      items.forEach((item, index) => {
        const key = itemKey(item);
        item.dataset.guideLockKey = key;
        if (index < FREE_ITEMS_PER_SECTION) freeItems.add(key);
        updateCard(item);
      });
    }
    if (isAdmin) toolbar().hidden = false;
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(applyLocks);
  }

  async function checkAdmin() {
    const token = sessionToken();
    try {
      const response = await fetch("/api/questions", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = await response.json();
      isAdmin = result.access?.isAdmin === true;
      const hasPremiumAccess = result.access?.tiers?.includes("Pro") === true;
      if (hasPremiumAccess) unlockAll = true;
      if (isAdmin) toolbar().hidden = false;
      updateCards();
    } catch {
      // A failed admin check leaves every non-preview item locked.
    }
  }

  applyLocks();
  new MutationObserver(scheduleApply).observe(document.body, { childList: true, subtree: true });
  checkAdmin();
})();
