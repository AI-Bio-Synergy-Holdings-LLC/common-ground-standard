(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sameOriginHtml = (anchor) => {
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return null;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    if (url.pathname === window.location.pathname && url.hash) return null;
    if (!url.pathname.endsWith("/") && !url.pathname.endsWith(".html")) return null;
    return url;
  };

  document.documentElement.classList.add("js");

  const markLoaded = () => {
    document.body.classList.add("is-loaded");
    document.body.classList.remove("is-leaving");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markLoaded, { once: true });
  } else {
    markLoaded();
  }

  window.addEventListener("pageshow", markLoaded);

  const initRecaptchaForms = () => {
    document.querySelectorAll("form[data-recaptcha-site-key]").forEach((form) => {
      if (form.dataset.recaptchaBound === "true") return;

      form.dataset.recaptchaBound = "true";

      const siteKey = form.dataset.recaptchaSiteKey;
      const action = form.dataset.recaptchaAction || "submit";
      const tokenInput = form.querySelector('input[name="g-recaptcha-response"]');
      const submitButton = form.querySelector("[data-fs-submit-btn]");
      const formError = form.querySelector(".form-feedback[data-fs-error]");

      const showError = (message) => {
        if (formError) formError.textContent = message;
      };

      const clearError = () => {
        if (formError) formError.textContent = "";
      };

      const setBusy = (busy) => {
        if (!submitButton) return;
        submitButton.disabled = busy;
        submitButton.setAttribute("aria-busy", busy ? "true" : "false");
      };

      form.addEventListener(
        "submit",
        (event) => {
          if (form.dataset.recaptchaTokenReady === "true") {
            form.dataset.recaptchaTokenReady = "submitting";
            window.setTimeout(() => {
              if (form.dataset.recaptchaTokenReady === "submitting") {
                delete form.dataset.recaptchaTokenReady;
              }
              if (tokenInput) tokenInput.value = "";
            }, 5000);
            return;
          }

          if (!siteKey || !tokenInput) return;

          event.preventDefault();
          event.stopImmediatePropagation();
          clearError();

          if (!form.checkValidity()) {
            form.reportValidity();
            return;
          }

          if (!window.grecaptcha || typeof window.grecaptcha.ready !== "function") {
            showError("Verification is still loading. Please wait a moment and try again.");
            return;
          }

          setBusy(true);
          window.grecaptcha.ready(() => {
            window.grecaptcha
              .execute(siteKey, { action })
              .then((token) => {
                tokenInput.value = token;
                form.dataset.recaptchaTokenReady = "true";
                form.requestSubmit();
              })
              .catch(() => {
                showError("Verification could not be completed. Please reload the page and try again.");
              })
              .finally(() => setBusy(false));
          });
        },
        true,
      );
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRecaptchaForms, { once: true });
  } else {
    initRecaptchaForms();
  }

  const assistantPaths = {
    capture: {
      title: "Anti-capture stress test",
      summary: "Test where the draft could become reputation cover, self-certification, or weak public-benefit language.",
      subject: "Anti-Capture Safeguards",
      questionId: "anti-capture-risk",
      draftText: "Anti-Capture Review Checklist",
      draftHref: "drafts.html#anti-capture-checklist",
      prompt: "What potential risks should be flagged as possible reputation cover for AI or infrastructure actors?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=anti-capture-risk.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/6",
    },
    evidence: {
      title: "Evidence threshold review",
      summary: "Focus on what must be measured, published, audited, or prohibited before any alignment claim.",
      subject: "Reviewer Questions",
      questionId: "minimum-evidence",
      draftText: "Reviewer Questions",
      draftHref: "drafts.html#reviewer-questions",
      prompt: "What minimum evidence should be required before any actor can claim alignment?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=evidence-requirement.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/7",
    },
    "no-go": {
      title: "No-go condition review",
      summary: "Identify what should pause, redesign, reject, or remedy an AI deployment or infrastructure claim.",
      subject: "Responsible AI Infrastructure",
      questionId: "no-go-condition",
      draftText: "Common Ground Standard",
      draftHref: "responsible-ai-infrastructure.html",
      prompt: "What condition should trigger pause, redesign, rejection, or remedy?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=evidence-requirement.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/1",
    },
    safeguard: {
      title: "Affected-party safeguard review",
      summary: "Look for missing student, worker, data, community, appeal, or governance protections.",
      subject: "Campus AI Governance",
      questionId: "affected-party-safeguard",
      draftText: "Campus Common Ground Compact",
      draftHref: "drafts.html#campus-compact",
      prompt: "What student, worker, data, or community safeguard is missing or too weak?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=campus-compact-feedback.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/2",
    },
    benefit: {
      title: "Benefit-sharing review",
      summary: "Test whether benefit routing, public receipts, baseline measurement, and worker protections are strong enough.",
      subject: "AI Benefit Sharing",
      questionId: "benefit-sharing-receipt",
      draftText: "AI Dividend / Benefit Clause",
      draftHref: "drafts.html#benefit-clause",
      prompt: "What should be published so benefit sharing is reviewable by affected people?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=ai-benefit-clause-feedback.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/3",
    },
    clarity: {
      title: "Clarity and usability review",
      summary: "Find wording that is vague, inaccessible, hard to implement, or likely to confuse reviewers.",
      subject: "Cross-draft concern",
      questionId: "clarity-usability",
      draftText: "Draft Library",
      draftHref: "drafts.html",
      prompt: "What language should be clarified, strengthened, removed, or made more practical?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=general-public-review.md",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues",
    },
  };

  const roleLabels = {
    student: "student or campus reviewer",
    "faculty-worker": "faculty or campus worker",
    labor: "labor or worker-protection reviewer",
    "community-ecology": "community, water, ecology, or infrastructure reviewer",
    "ai-rights": "AI accountability, data rights, or civil liberties reviewer",
    institutional: "foundation, agency, nonprofit, or institutional reviewer",
  };

  const timeLabels = {
    3: "3-minute pulse critique",
    10: "10-minute focused review",
    30: "30-minute draft pass",
    institutional: "longer institutional review",
  };

  const getCheckedValue = (container, name) => {
    const checked = container.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : "";
  };

  const buildReviewHref = ({ role, focus, time, prompt, subject, questionId }) => {
    const url = new URL("review-feedback.html", window.location.href);
    url.searchParams.set("source", "review-assistant");
    url.searchParams.set("subject", subject);
    url.searchParams.set("section", focus);
    url.searchParams.set("question_id", questionId);
    url.searchParams.set("role", role);
    url.searchParams.set("focus", focus);
    url.searchParams.set("time", time);
    url.searchParams.set("question", prompt);
    return url.href;
  };

  const buildContactHref = ({ role, focus, time, prompt }) => {
    const url = new URL("contact.html", window.location.href);
    url.searchParams.set("source", "review-assistant");
    url.searchParams.set("role", role);
    url.searchParams.set("focus", focus);
    url.searchParams.set("time", time);
    url.searchParams.set("prompt", prompt);
    return url.href;
  };

  const initReviewAssistant = () => {
    const assistant = document.querySelector("[data-review-assistant]");
    if (!assistant) return;

    const title = assistant.querySelector("[data-assistant-title]");
    const summary = assistant.querySelector("[data-assistant-summary]");
    const draft = assistant.querySelector("[data-assistant-draft]");
    const prompt = assistant.querySelector("[data-assistant-prompt]");
    const primary = assistant.querySelector("[data-assistant-primary]");
    const seed = assistant.querySelector("[data-assistant-seed]");
    const contact = assistant.querySelector("[data-assistant-contact]");
    const copyButton = assistant.querySelector("[data-copy-prompt]");

    const update = () => {
      const role = getCheckedValue(assistant, "reviewer_role") || "student";
      const focus = getCheckedValue(assistant, "review_focus") || "capture";
      const time = getCheckedValue(assistant, "review_time") || "10";
      const path = assistantPaths[focus] || assistantPaths.capture;
      const roleLabel = roleLabels[role] || "public-interest reviewer";
      const timeLabel = timeLabels[time] || "focused review";

      if (title) title.textContent = path.title;
      if (summary) summary.textContent = `${roleLabel}: ${timeLabel}. ${path.summary}`;
      if (draft) {
        draft.textContent = path.draftText;
        draft.href = path.draftHref;
      }
      if (prompt) prompt.textContent = path.prompt;
      if (primary) {
        primary.href = buildReviewHref({
          role,
          focus,
          time,
          prompt: path.prompt,
          subject: path.subject,
          questionId: path.questionId,
        });
      }
      if (seed) seed.href = path.seedHref;
      if (contact) contact.href = buildContactHref({ role, focus, time, prompt: path.prompt });
      if (copyButton) copyButton.textContent = "Copy Prompt";
    };

    assistant.addEventListener("change", update);

    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        const text = prompt ? prompt.textContent.trim() : "";
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          copyButton.textContent = "Copied";
        } catch {
          copyButton.textContent = "Select Prompt";
        }
      });
    }

    update();
  };

  const initContactPrefill = () => {
    const form = document.querySelector("#contact-form");
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("source") !== "review-assistant") return;

    const values = {
      source: "review-assistant",
      role: params.get("role") || "",
      focus: params.get("focus") || "",
      time: params.get("time") || "",
      prompt: params.get("prompt") || "",
    };

    Object.entries(values).forEach(([key, value]) => {
      const input = form.querySelector(`[data-assistant-field="${key}"]`);
      if (input) input.value = value;
    });

    const inquiryType = form.querySelector("#contact-inquiry-type");
    if (inquiryType) {
      inquiryType.value = "Reviewer inquiry";
    }

    const message = form.querySelector("#contact-message");
    if (message && values.prompt) {
      message.placeholder = `Suggested prompt: ${values.prompt}`;
    }

    const context = form.querySelector("[data-assistant-context]");
    const contextText = form.querySelector("[data-assistant-context-text]");
    if (context && contextText) {
      const role = roleLabels[values.role] || values.role || "reviewer";
      const time = timeLabels[values.time] || values.time || "review";
      const focus = assistantPaths[values.focus]?.title || values.focus || "review focus";
      contextText.textContent = `${role}; ${focus}; ${time}.`;
      context.classList.remove("is-hidden");
    }
  };

  const pressureTestPaths = {
    energy: {
      number: "01",
      label: "Energy + grid",
      title: "Can the grid carry the load without shifting risk to the public?",
      risk: "New demand could weaken reliability, delay cleaner power, or shift infrastructure costs onto households.",
      proof: "A public grid-impact study, demand assumptions, reliability safeguards, and a clear plan for who pays.",
      protection: "Ratepayers, vulnerable households, local utilities, workers, and communities already carrying energy burdens.",
      stop: "When the project cannot show reliable supply or prevent unreasonable public cost and service risk.",
      section: "energy-grid",
      questionId: "energy-grid-evidence",
      question: "What minimum energy and grid evidence should be public before an AI infrastructure project can claim alignment?",
    },
    water: {
      number: "02",
      label: "Water",
      title: "Can water demand stay within local limits during ordinary and drought conditions?",
      risk: "High or poorly timed water use could intensify scarcity, affect ecosystems, or compete with households and agriculture.",
      proof: "Basin-specific use estimates, drought scenarios, source and discharge details, thresholds, and ongoing public reporting.",
      protection: "Residents, Tribal Nations, farmers, local water systems, downstream communities, and affected ecosystems.",
      stop: "When credible basin limits, drought safeguards, or enforceable restoration and mitigation plans are missing.",
      section: "water",
      questionId: "water-evidence",
      question: "What water evidence and local threshold should be required before an AI infrastructure project moves forward?",
    },
    bills: {
      number: "03",
      label: "Household bills",
      title: "Who pays for new infrastructure, and who is protected from higher bills?",
      risk: "Utilities or public agencies could socialize upgrade costs while a private project captures most of the value.",
      proof: "Transparent cost-allocation models, household-bill scenarios, vulnerable-customer analysis, and funded mitigation.",
      protection: "Low-income households, renters, small businesses, rural ratepayers, and customers already facing energy insecurity.",
      stop: "When modeled harm is material and no binding protection, mitigation, or benefit-routing mechanism exists.",
      section: "household-bills",
      questionId: "retail-bill-protection",
      question: "What household-bill protection should be binding before an AI infrastructure project can claim public benefit?",
    },
    data: {
      number: "04",
      label: "Data + community",
      title: "Can affected people inspect and influence the data and community-benefit promises?",
      risk: "Telemetry, community data, or public-benefit language could be collected or reused without meaningful local authority.",
      proof: "A public data-use register, clear purpose limits, governance roles, appeal rights, and a binding community benefit agreement.",
      protection: "Residents, students, service users, community organizations, and people represented in collected or inferred data.",
      stop: "When data rights, decision authority, remedy, or a binding community-benefit process are absent.",
      section: "data-community",
      questionId: "data-community-governance",
      question: "What community decision right or data safeguard is missing from this infrastructure draft?",
    },
    work: {
      number: "05",
      label: "Work + ecology",
      title: "Do labor and ecological promises survive beyond the announcement?",
      risk: "Job claims may be temporary or overstated while automation, construction, land, noise, heat, or habitat costs persist.",
      proof: "Job-quality baselines, transition plans, ecological review, restoration triggers, timelines, and independent follow-through.",
      protection: "Workers, students entering affected fields, nearby communities, future generations, habitats, and watersheds.",
      stop: "When the project lacks enforceable labor protections, ecological thresholds, repair duties, or independent oversight.",
      section: "work-ecology",
      questionId: "work-ecology-safeguard",
      question: "What labor or ecological safeguard should trigger pause, repair, or redesign if it is not met?",
    },
  };

  const buildSubjectReviewHref = (path) => {
    const url = new URL("review-feedback.html", window.location.href);
    url.searchParams.set("source", "responsible-ai-infrastructure");
    url.searchParams.set("subject", "Responsible AI Infrastructure");
    url.searchParams.set("section", path.section);
    url.searchParams.set("question_id", path.questionId);
    url.searchParams.set("question", path.question);
    return url.href;
  };

  const initInfrastructurePressureTest = () => {
    const test = document.querySelector("[data-pressure-test]");
    if (!test) return;

    const fields = {
      number: test.querySelector("[data-pressure-number]"),
      label: test.querySelector("[data-pressure-label]"),
      title: test.querySelector("[data-pressure-title]"),
      risk: test.querySelector("[data-pressure-risk]"),
      proof: test.querySelector("[data-pressure-proof]"),
      protection: test.querySelector("[data-pressure-protection]"),
      stop: test.querySelector("[data-pressure-stop]"),
      question: test.querySelector("[data-pressure-question]"),
      feedback: test.querySelector("[data-pressure-feedback]"),
    };

    const update = (key) => {
      const path = pressureTestPaths[key] || pressureTestPaths.energy;
      Object.entries(fields).forEach(([name, element]) => {
        if (!element || name === "feedback") return;
        element.textContent = path[name];
      });
      if (fields.feedback) fields.feedback.href = buildSubjectReviewHref(path);
      test.querySelectorAll("[data-pressure-key]").forEach((button) => {
        const active = button.dataset.pressureKey === key;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    };

    test.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pressure-key]");
      if (button) update(button.dataset.pressureKey);
    });
  };

  const setSelectValue = (select, value) => {
    if (!select || !value) return;
    const normalized = value.trim().toLowerCase();
    const match = Array.from(select.options).find((option) =>
      [option.value, option.textContent].some((candidate) => candidate.trim().toLowerCase() === normalized),
    );
    if (match) {
      select.value = match.value;
      return;
    }
    const option = new Option(value, value, true, true);
    select.add(option);
  };

  const initReviewFeedbackForm = () => {
    const form = document.querySelector("[data-review-feedback-form]");
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    const values = {
      source: params.get("source") || "website-review-intake",
      section: params.get("section") || "",
      question_id: params.get("question_id") || params.get("focus") || "",
      role: params.get("role") || "",
      focus: params.get("focus") || "",
      time: params.get("time") || "",
    };

    Object.entries(values).forEach(([key, value]) => {
      const input = form.querySelector(`[data-review-field="${key}"]`);
      if (input) input.value = value;
    });

    const subject = form.querySelector("[data-review-subject]");
    const question = form.querySelector("[data-review-question]");
    const perspective = form.querySelector("[data-review-perspective]");
    setSelectValue(subject, params.get("subject") || "");
    setSelectValue(question, params.get("question") || "");
    setSelectValue(perspective, roleLabels[values.role] || values.role || "");

    const context = form.querySelector("[data-review-context]");
    const contextText = form.querySelector("[data-review-context-text]");
    if (context && contextText && (params.get("subject") || params.get("question"))) {
      const parts = [params.get("subject"), params.get("question")].filter(Boolean);
      contextText.textContent = parts.join(" - ");
      context.classList.remove("is-hidden");
    }

    const email = form.querySelector("#review-email");
    const emailStatus = form.querySelector("[data-email-status]");
    const updateEmailRequirement = () => {
      const attribution = form.querySelector("[data-attribution-choice]")?.checked;
      if (email) email.required = Boolean(attribution);
      if (emailStatus) emailStatus.textContent = attribution ? "required for follow-up" : "optional";
    };

    form.querySelectorAll("[data-publication-choice]").forEach((choice) => {
      choice.addEventListener("change", updateEmailRequirement);
    });
    updateEmailRequirement();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initReviewAssistant();
      initContactPrefill();
      initInfrastructurePressureTest();
      initReviewFeedbackForm();
    }, { once: true });
  } else {
    initReviewAssistant();
    initContactPrefill();
    initInfrastructurePressureTest();
    initReviewFeedbackForm();
  }

  const prefetch = (anchor) => {
    const url = sameOriginHtml(anchor);
    if (!url || document.head.querySelector(`link[rel="prefetch"][href="${url.href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url.href;
    document.head.appendChild(link);
  };

  const closestAnchor = (target) => target instanceof Element ? target.closest("a[href]") : null;

  document.addEventListener("pointerenter", (event) => prefetch(closestAnchor(event.target)), true);
  document.addEventListener("focusin", (event) => prefetch(closestAnchor(event.target)));

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const anchor = closestAnchor(event.target);
    const url = sameOriginHtml(anchor);
    if (!url || reduceMotion) return;
    event.preventDefault();
    document.body.classList.add("is-leaving");
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 120);
  });
})();
