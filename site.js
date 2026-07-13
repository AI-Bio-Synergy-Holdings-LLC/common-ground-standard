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
      draftText: "Anti-Capture Review Checklist",
      draftHref: "drafts.html#anti-capture-checklist",
      prompt: "What potential risks should be flagged as possible reputation cover for AI or infrastructure actors?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=anti-capture-risk.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/6",
    },
    evidence: {
      title: "Evidence threshold review",
      summary: "Focus on what must be measured, published, audited, or prohibited before any alignment claim.",
      draftText: "Reviewer Questions",
      draftHref: "drafts.html#reviewer-questions",
      prompt: "What minimum evidence should be required before any actor can claim alignment?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=evidence-requirement.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/7",
    },
    "no-go": {
      title: "No-go condition review",
      summary: "Identify what should pause, redesign, reject, or remedy an AI deployment or infrastructure claim.",
      draftText: "Common Ground Standard",
      draftHref: "drafts.html#common-ground-standard",
      prompt: "What condition should trigger pause, redesign, rejection, or remedy?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=evidence-requirement.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/1",
    },
    safeguard: {
      title: "Affected-party safeguard review",
      summary: "Look for missing student, worker, data, community, appeal, or governance protections.",
      draftText: "Campus Common Ground Compact",
      draftHref: "drafts.html#campus-compact",
      prompt: "What student, worker, data, or community safeguard is missing or too weak?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=campus-compact-feedback.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/2",
    },
    benefit: {
      title: "Benefit-sharing review",
      summary: "Test whether benefit routing, public receipts, baseline measurement, and worker protections are strong enough.",
      draftText: "AI Dividend / Benefit Clause",
      draftHref: "drafts.html#benefit-clause",
      prompt: "What should be published so benefit sharing is reviewable by affected people?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=ai-benefit-clause-feedback.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/3",
    },
    clarity: {
      title: "Clarity and usability review",
      summary: "Find wording that is vague, inaccessible, hard to implement, or likely to confuse reviewers.",
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
      if (primary) primary.href = path.templateHref;
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initReviewAssistant();
      initContactPrefill();
    }, { once: true });
  } else {
    initReviewAssistant();
    initContactPrefill();
  }

  const prefetch = (anchor) => {
    const url = sameOriginHtml(anchor);
    if (!url || document.head.querySelector(`link[rel="prefetch"][href="${url.href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url.href;
    document.head.appendChild(link);
  };

  document.addEventListener("pointerenter", (event) => prefetch(event.target.closest("a[href]")), true);
  document.addEventListener("focusin", (event) => prefetch(event.target.closest("a[href]")));

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const anchor = event.target.closest("a[href]");
    const url = sameOriginHtml(anchor);
    if (!url || reduceMotion) return;
    event.preventDefault();
    document.body.classList.add("is-leaving");
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 120);
  });
})();
