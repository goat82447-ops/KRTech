(() => {
  let enabled = false;

  function revealButtons() {
    if (!enabled) return;
    document.querySelectorAll("[data-local-pro-unlock]").forEach(button => { button.hidden = false; });
  }

  const observer = new MutationObserver(revealButtons);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  fetch("/api/local-pro-access", { cache: "no-store" })
    .then(async response => {
      if (!response.ok) return;
      const state = await response.json();
      enabled = state.enabled === true;
      revealButtons();
    })
    .catch(error => console.error("Could not check local Pro testing availability.", error));

  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-local-pro-unlock]");
    if (!button) return;
    const pin = window.prompt("Enter the local testing PIN to enable Pro access for 8 hours.");
    if (pin === null) return;

    button.disabled = true;
    try {
      const response = await fetch("/api/local-pro-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ pin }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Local Pro access failed (${response.status}).`);
      window.location.reload();
    } catch (error) {
      window.alert(error.message);
    } finally {
      button.disabled = false;
    }
  });
})();
