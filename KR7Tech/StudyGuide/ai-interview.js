(() => {
  const SESSION_KEY = "visual-memory-lab.auth-session";
  const topic = document.getElementById("topic");
  const experience = document.getElementById("experience");
  const role = document.getElementById("role");
  const consent = document.getElementById("consent");
  const status = document.getElementById("status");
  const interviewPanel = document.getElementById("interview-panel");
  const questionElement = document.getElementById("current-question");
  const answerElement = document.getElementById("answer");
  const feedbackPanel = document.getElementById("feedback-panel");
  const feedbackList = document.getElementById("feedback-list");
  const finalPanel = document.getElementById("final-panel");
  const finalList = document.getElementById("final-list");
  const micStatus = document.getElementById("mic-status");
  const startButton = document.getElementById("start");
  const submitButton = document.getElementById("submit-answer");
  let turns = [];
  let currentQuestion = "";
  let recognition = null;
  let recognizing = false;
  let dictationBase = "";
  let localPracticeMode = window.location.protocol === "file:";

  const localFollowUps = {
    "C# / .NET": [
      "How would you design a .NET API endpoint so retries do not create duplicate work?",
      "How do dependency injection lifetimes affect services that use database contexts?",
      "How would you investigate and reduce high memory usage in a .NET service?",
      "How do you handle cancellation and timeouts across an asynchronous request?",
      "How would you test a service that depends on an external API?",
    ],
    Angular: [
      "How do you decide between a service, a signal, and a component input for state?",
      "How would you improve the performance of a large Angular page?",
      "How do you handle errors and cancellation in an RxJS data flow?",
      "How would you protect a route while keeping authorization enforced by the server?",
      "How do you test an Angular component that depends on an API service?",
    ],
    Azure: [
      "How would you design a highly available Azure web application?",
      "How do you manage secrets and workload identity for an Azure application?",
      "How would you investigate rising latency in a service hosted on Azure?",
      "How do you scale an application when traffic changes sharply?",
      "How would you design monitoring and alerting for a production service?",
    ],
    SQL: [
      "How would you investigate a slow query on a production database?",
      "How do indexes improve reads, and what costs do they add?",
      "How would you prevent lost updates when two users edit the same record?",
      "How would you paginate a large result set reliably?",
      "How would you approach a schema change with no application downtime?",
    ],
    "System Design": [
      "How would you estimate the traffic and storage needs before choosing an architecture?",
      "How would you handle caching while keeping frequently changed data correct?",
      "How would you design for a sudden tenfold traffic increase?",
      "How would you make a write operation safe to retry?",
      "How would you identify and remove a bottleneck in a distributed system?",
    ],
    "JavaScript / TypeScript": [
      "How do you prevent stale asynchronous responses from overwriting newer UI state?",
      "How do you model API response states safely in TypeScript?",
      "How would you investigate a memory leak in a browser application?",
      "How do you handle cancellation and errors in asynchronous code?",
      "How would you keep a large UI responsive during expensive work?",
    ],
    React: [
      "How do you decide where state should live in a React application?",
      "How would you diagnose unnecessary renders on a busy page?",
      "How do you handle loading, error, and stale-data states for a request?",
      "How would you make a reusable form accessible and easy to test?",
      "How do you prevent an older request from replacing newer results?",
    ],
  };

  function makeNode(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function readToken() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      return typeof session?.access_token === "string" ? session.access_token : null;
    } catch (error) {
      status.textContent = "Could not read the saved sign-in session. Please sign in again.";
      return null;
    }
  }

  async function sendRequest(payload) {
    if (localPracticeMode) return localResponse(payload);
    const token = readToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch("/api/ai-interview", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      localPracticeMode = true;
      return localResponse(payload);
    }
    const result = await response.json().catch(() => ({}));
    if (response.status === 404) {
      localPracticeMode = true;
      return localResponse(payload);
    }
    if (!response.ok) throw new Error(result.error || `AI interview request failed (${response.status}).`);
    return result;
  }

  function localResponse(payload) {
    if (payload.action === "start") {
      return { question: `Tell me about yourself and your experience with ${payload.topic}.` };
    }

    const answer = payload.turns.at(-1)?.answer || "";
    const complete = payload.turns.length >= 6;
    const answerHasSubstance = answer.trim().length >= 100 &&
      /\b(because|therefore|for example|such as|result|trade-?off|query|index|cache|api|service|test|async|dependency|scale|latency|error|state|component|signal|observable|retry|queue|database|transaction)\b/i.test(answer);
    const strengths = answerHasSubstance
      ? ["You provided enough detail to discuss; connect each point to a specific example."]
      : ["You answered the question. Add a concrete example and explain your role in it."];
    const improvements = !answerHasSubstance
      ? ["Expand your answer with the situation, your actions, and the result."]
      : ["Include the trade-off you considered and a measurable result where possible."];
    const questions = localFollowUps[payload.topic] || [];

    return {
      summary: "Local practice mode is active. This basic feedback is generated in your browser and is not AI evaluation.",
      ...(payload.action === "answer" ? {
        verdict: answerHasSubstance ? "PASS" : "FAIL",
        verdictReason: answerHasSubstance
          ? "Local format check: your answer includes a technical detail and explanation. Technical correctness is not verified in local mode."
          : "Local format check: add a specific technical detail and explain your reasoning. Technical correctness is not verified in local mode.",
      } : {}),
      strengths,
      improvements,
      exampleRevision: "Describe the context, the decision you made, why you chose it, and the result. Add a lesson learned if relevant.",
      nextQuestion: complete ? null : questions[Math.min(payload.turns.length - 1, questions.length - 1)],
      complete,
      practiceOnly: true,
    };
  }

  function speakQuestion(question) {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
      micStatus.textContent = "Spoken questions are not supported in this browser; read the question on screen.";
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
    micStatus.textContent = "Reading the question aloud.";
  }

  function setBusy(busy, message) {
    startButton.disabled = busy;
    submitButton.disabled = busy;
    document.getElementById("dictate").disabled = busy || recognizing;
    status.textContent = message;
  }

  function showQuestion(question) {
    currentQuestion = question;
    questionElement.replaceChildren(
      makeNode("div", "question-label", `Question ${turns.length + 1} of 6`),
      makeNode("p", "question-text", question),
    );
    interviewPanel.hidden = false;
    answerElement.value = "";
    speakQuestion(question);
    answerElement.focus();
  }

  function appendList(container, heading, items) {
    const section = makeNode("div", "feedback-card");
    section.append(makeNode("h3", "", heading));
    const list = makeNode("ul");
    items.forEach(item => list.append(makeNode("li", "", item)));
    section.append(list);
    container.append(section);
  }

  function renderFeedback(result) {
    feedbackPanel.hidden = false;
    feedbackList.replaceChildren();
    if (result.verdict) {
      const verdict = makeNode("div", `verdict-card verdict-${result.verdict.toLowerCase()}`);
      verdict.setAttribute("role", "status");
      verdict.append(
        makeNode("strong", "verdict-label", result.verdict),
        makeNode("p", "", result.verdictReason),
      );
      feedbackList.append(verdict);
    }
    const summary = makeNode("div", "feedback-card");
    summary.append(makeNode("h3", "", "Overall answer feedback"));
    summary.append(makeNode("p", "", result.summary));
    feedbackList.append(summary);
    if (result.strengths.length) appendList(feedbackList, "What worked", result.strengths);
    if (result.improvements.length) appendList(feedbackList, "Ways to strengthen it", result.improvements);
    const revision = makeNode("div", "feedback-card");
    revision.append(makeNode("h3", "", "A stronger answer shape"));
    revision.append(makeNode("p", "", result.exampleRevision));
    feedbackList.append(revision);
  }

  function finishSession(result) {
    interviewPanel.hidden = true;
    feedbackPanel.hidden = false;
    renderFeedback(result);
    finalPanel.hidden = false;
    finalList.replaceChildren();
    finalList.append(makeNode("p", "", result.summary));
    if (result.strengths.length) appendList(finalList, "Patterns to keep", result.strengths);
    if (result.improvements.length) appendList(finalList, "Practice next", result.improvements);
    appendList(finalList, "Try this answer structure", [result.exampleRevision]);
    status.textContent = "Practice complete. Review the coaching and retry with your own examples.";
  }

  function stopRecognition() {
    if (recognition && recognizing) recognition.stop();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  document.getElementById("repeat-question").addEventListener("click", () => speakQuestion(currentQuestion));
  document.getElementById("stop-voice").addEventListener("click", () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    micStatus.textContent = "Question audio stopped.";
  });

  startButton.addEventListener("click", async () => {
    if (!consent.checked) {
      status.textContent = "Please read and accept the AI and voice-processing notice before starting.";
      consent.focus();
      return;
    }
    setBusy(true, "Preparing your first question…");
    turns = [];
    currentQuestion = "";
    interviewPanel.hidden = true;
    feedbackPanel.hidden = true;
    finalPanel.hidden = true;
    try {
      const result = await sendRequest({
        action: "start",
        topic: topic.value,
        experience: experience.value,
        role: role.value.trim(),
      });
      showQuestion(result.question);
      status.textContent = localPracticeMode
        ? "Question 1 of 6: local practice mode. The question is shown and spoken; type or dictate your answer."
        : "Question 1 of 6: answer naturally by typing or dictating. Your answer will be evaluated before the next question.";
    } catch (error) {
      status.textContent = error.message || "Could not start the AI interview.";
    } finally {
      setBusy(false, status.textContent);
    }
  });

  submitButton.addEventListener("click", async () => {
    const answer = answerElement.value.trim();
    if (!answer) {
      status.textContent = "Enter or dictate an answer before requesting feedback.";
      answerElement.focus();
      return;
    }
    stopRecognition();
    const updatedTurns = [...turns, { question: currentQuestion, answer }];
    setBusy(true, `Sending answer ${updatedTurns.length} for practice coaching…`);
    try {
      const result = await sendRequest({
        action: "answer",
        topic: topic.value,
        experience: experience.value,
        role: role.value.trim(),
        turns: updatedTurns,
      });
      turns = updatedTurns;
      renderFeedback(result);
      if (result.complete || !result.nextQuestion) {
        finishSession(result);
      } else {
        showQuestion(result.nextQuestion);
        status.textContent = localPracticeMode
          ? `Question ${turns.length + 1} of 6: local format feedback is ready. Answer the next question to continue.`
          : `Question ${turns.length + 1} of 6: answer evaluation is ready. Answer the next question to continue.`;
      }
    } catch (error) {
      status.textContent = error.message || "Could not evaluate this practice answer.";
    } finally {
      setBusy(false, status.textContent);
    }
  });

  document.getElementById("dictate").addEventListener("click", () => {
    if (recognizing) {
      stopRecognition();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micStatus.textContent = "Speech recognition is unavailable in this browser. Type your answer instead.";
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    dictationBase = answerElement.value.trim();
    let finalTranscript = "";
    recognition.onstart = () => {
      recognizing = true;
      micStatus.textContent = "Listening… select Stop dictation when finished.";
      document.getElementById("dictate").textContent = "Stop dictation";
      document.getElementById("dictate").disabled = false;
    };
    recognition.onresult = event => {
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const transcript = event.results[index][0].transcript.trim();
        if (event.results[index].isFinal) finalTranscript += `${transcript} `;
        else interimTranscript += `${transcript} `;
      }
      answerElement.value = [dictationBase, finalTranscript.trim(), interimTranscript.trim()].filter(Boolean).join(" ");
    };
    recognition.onerror = event => {
      micStatus.textContent = event.error === "not-allowed"
        ? "Microphone permission was denied. You can type your answer instead."
        : `Speech recognition stopped (${event.error}). You can continue typing.`;
    };
    recognition.onend = () => {
      recognizing = false;
      document.getElementById("dictate").textContent = "🎙 Dictate answer";
      document.getElementById("dictate").disabled = false;
      if (!micStatus.textContent.startsWith("Microphone permission")) micStatus.textContent = "Dictation stopped.";
    };
    try {
      recognition.start();
    } catch (error) {
      micStatus.textContent = "Could not start speech recognition. Check microphone permissions or type your answer.";
    }
  });

  document.getElementById("restart").addEventListener("click", () => {
    stopRecognition();
    turns = [];
    currentQuestion = "";
    answerElement.value = "";
    interviewPanel.hidden = true;
    feedbackPanel.hidden = true;
    finalPanel.hidden = true;
    status.textContent = "Choose Start mock interview to begin another practice session.";
    startButton.focus();
  });
})();
