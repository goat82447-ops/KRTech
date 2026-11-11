(() => {
  const styles = document.createElement("style");
  styles.textContent = `
    .subject-section-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .subject-section-heading h2 {
      margin-top: 0;
    }
    .subject-section-toggle {
      flex: 0 0 auto;
      padding: 7px 10px;
      border: 1px solid #3d6481;
      border-radius: 8px;
      background: #081624;
      color: white;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    }
    .subject-section-toggle:hover,
    .subject-section-toggle:focus-visible {
      border-color: #63e6ff;
      outline: 2px solid transparent;
    }
    .subject-section-content[hidden] {
      display: none !important;
    }
  `;
  document.head.append(styles);

  document
    .querySelectorAll("main section.section")
    .forEach((section, index) => {
      const heading = Array.from(section.children).find(
        (child) => child.tagName === "H2",
      );
      if (!heading) return;

      const headingRow = document.createElement("div");
      headingRow.className = "subject-section-heading";
      heading.before(headingRow);
      headingRow.append(heading);

      const content = document.createElement("div");
      content.className = "subject-section-content";
      content.id = `subject-content-${section.id || index}`;
      let next = headingRow.nextSibling;
      while (next) {
        const following = next.nextSibling;
        content.append(next);
        next = following;
      }
      section.append(content);

      const toggle = document.createElement("button");
      toggle.className = "subject-section-toggle";
      toggle.type = "button";
      toggle.setAttribute("aria-controls", content.id);

      const updateToggle = (isExpanded) => {
        content.hidden = !isExpanded;
        toggle.textContent = isExpanded ? "Hide" : "Show";
        toggle.setAttribute("aria-expanded", String(isExpanded));
        toggle.setAttribute(
          "aria-label",
          `${isExpanded ? "Hide" : "Show"} ${heading.textContent.trim()} section`,
        );
      };

      toggle.addEventListener("click", () => {
        updateToggle(toggle.getAttribute("aria-expanded") !== "true");
      });
      headingRow.append(toggle);
      updateToggle(true);
    });
})();
