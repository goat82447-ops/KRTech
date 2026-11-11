(() => {
  document.documentElement.classList.add("protected-content");

  const style = document.createElement("style");
  style.textContent = `
    html.protected-content, html.protected-content body { -webkit-user-select: none !important; user-select: none !important; }
    html.protected-content input, html.protected-content textarea, html.protected-content select { -webkit-user-select: text !important; user-select: text !important; }
    html.protected-content img { -webkit-user-drag: none; }
  `;
  document.head.appendChild(style);

  document.addEventListener("contextmenu", event => event.preventDefault());
  document.addEventListener("copy", event => event.preventDefault());
  document.addEventListener("cut", event => event.preventDefault());
  document.addEventListener("dragstart", event => event.preventDefault());

  document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    const combo = event.ctrlKey || event.metaKey;
    if (key === "f12" || (event.shiftKey && combo && ["i", "j", "c"].includes(key)) || (combo && ["u", "s", "p", "a", "c", "x"].includes(key))) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") window.blur();
  });
})();
