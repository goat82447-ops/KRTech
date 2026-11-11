(() => {
  const form = document.getElementById("experience-form");
  if (!form) return;

  const topic = document.getElementById("experience-topic");
  const level = document.getElementById("experience-level");
  const company = document.getElementById("experience-company");
  const list = document.getElementById("experience-results");
  const status = document.getElementById("experience-status");
  const signInLink = document.getElementById("experience-sign-in");
  const sessionKey = "visual-memory-lab.auth-session";

  function node(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function appendCompanyTags(card, companyTags) {
    if (!Array.isArray(companyTags) || !companyTags.length) return;
    const tags = node("div", "experience-company-tags", "Company prep:");
    companyTags.forEach(name => tags.append(node("span", "", name)));
    card.append(tags);
  }

  function sessionToken() {
    try {
      const session = JSON.parse(localStorage.getItem(sessionKey) || "null");
      return typeof session?.access_token === "string" ? session.access_token : null;
    } catch (error) {
      status.textContent = "Could not read the saved sign-in session. Please sign in again.";
      return null;
    }
  }

  function renderQuestion(question, isPro) {
    const card = node("article", "experience-card");
    const levelNames = {
      "0-2 years": "Foundations",
      "3-5 years": "Mid-level",
      "6-10 years": "Advanced",
      "10+ years": "Senior / expert",
    };
    card.append(node("p", "experience-card-meta", `${question.topic} · ${question.experience_band} · ${levelNames[question.experience_band] || "Interview practice"}`));
    appendCompanyTags(card, question.company_tags);
    const heading = node("div", "experience-card-head");
    heading.append(node("h3", "", question.question));
    heading.append(node("span", question.is_free ? "experience-badge free" : "experience-badge", question.is_free ? "FREE" : "PRO"));
    card.append(heading);
    card.append(node("p", "experience-answer", question.answer));
    const example = node("p", "experience-example");
    example.append(node("strong", "", isPro ? "Example: " : "Practical example: "));
    example.append(document.createTextNode(question.example));
    card.append(example);
    list.append(card);
  }

  function renderLocked(question) {
    const card = node("article", "experience-card locked");
    card.append(node("p", "experience-locked-preview", "🔒 Pro question · unlock to view"));
    card.append(node("p", "experience-answer", "The question, answer, and example are included with a Pro subscription."));
    const unlock = node("button", "experience-upgrade", "Unlock Pro");
    unlock.type = "button";
    unlock.dataset.localProUnlock = "";
    unlock.hidden = true;
    card.append(unlock);
    list.append(card);
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const selectedTopic = topic.value;
    const selectedLevel = level.value;
    const selectedCompany = company.value;
    const token = sessionToken();
    signInLink.href = selectedTopic === "All subjects"
      ? "Company-Interviews.html#access-heading"
      : `Company-Interviews.html?topic=${encodeURIComponent(selectedTopic)}#access-heading`;
    list.replaceChildren();
    status.textContent = "Loading questions for your selected experience…";
    form.querySelector("button[type=submit]").disabled = true;
    try {
      let data;
      if (window.location.protocol === "file:") {
        data = {
          questions: [],
          locked: [],
          access: { premium: false },
          localUnavailable: true,
        };
      } else {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const query = new URLSearchParams({ topic: selectedTopic, level: selectedLevel });
        const response = await fetch(`/api/experience-questions?${query}`, { headers });
        data = await response.json();
        if (!response.ok) throw new Error(data.error || `Could not load questions (${response.status}).`);
      }

      const visibleQuestions = data.questions.filter(question =>
        selectedCompany === "All companies" || question.company_tags?.includes(selectedCompany),
      );
      const visibleLocked = data.locked.filter(question =>
        selectedCompany === "All companies" || question.company_tags?.includes(selectedCompany),
      );
      visibleQuestions.forEach(question => renderQuestion(question, data.access.premium));
      visibleLocked.forEach(renderLocked);
      if (data.localUnavailable) {
        status.textContent = "Interview questions are not available when this page is opened as a local file. Open KR7Tech through its app server to load free previews and Pro-locked content safely.";
      } else if (!data.questions.length && !data.locked.length) {
        status.textContent = "No interview questions are configured yet. Run experience-questions-seed.sql in Supabase, then try again.";
      } else if (!visibleQuestions.length && !visibleLocked.length) {
        status.textContent = `No questions match ${selectedCompany} preparation for ${selectedTopic} at ${selectedLevel}. Try another company or choose All companies.`;
      } else {
        const subjectLabel = selectedTopic === "All subjects" ? "All subjects" : selectedTopic;
        const companyLabel = selectedCompany === "All companies" ? "" : ` · ${selectedCompany} prep`;
        status.textContent = `${subjectLabel} · ${selectedLevel}${companyLabel}: ${visibleQuestions.length} answer${visibleQuestions.length === 1 ? "" : "s"} available${visibleLocked.length ? ` · ${visibleLocked.length} Pro answer${visibleLocked.length === 1 ? "" : "s"} locked` : ""}.`;
      }
    } catch (error) {
      list.replaceChildren();
      status.textContent = error.message || "Questions could not be loaded. Please try again.";
    } finally {
      form.querySelector("button[type=submit]").disabled = false;
    }
  });
})();
