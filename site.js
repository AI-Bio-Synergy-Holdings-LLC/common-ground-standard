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

  const initMobileNavigation = () => {
    document.querySelectorAll(".site-header").forEach((header, index) => {
      if (!(header instanceof HTMLElement) || header.dataset.navigationReady === "true") return;

      const navigation = header.querySelector(".site-nav");
      if (!(navigation instanceof HTMLElement)) return;

      const navigationId = navigation.id || `site-navigation-${index + 1}`;
      const button = document.createElement("button");
      button.className = "site-nav-toggle";
      button.type = "button";
      button.setAttribute("aria-controls", navigationId);
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = '<span>Menu</span><span class="site-nav-toggle-icon" aria-hidden="true"><span></span><span></span><span></span></span>';

      const closeNavigation = () => {
        header.dataset.navigationOpen = "false";
        button.setAttribute("aria-expanded", "false");
      };

      navigation.id = navigationId;
      header.dataset.navigationOpen = "false";
      header.insertBefore(button, navigation);
      header.dataset.navigationReady = "true";

      button.addEventListener("click", () => {
        const willOpen = header.dataset.navigationOpen !== "true";
        header.dataset.navigationOpen = String(willOpen);
        button.setAttribute("aria-expanded", String(willOpen));
      });
      navigation.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("a")) closeNavigation();
      });
      header.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || header.dataset.navigationOpen !== "true") return;
        closeNavigation();
        button.focus();
      });
      window.matchMedia("(min-width: 681px)").addEventListener("change", closeNavigation);
    });
  };

  initMobileNavigation();

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
        if (busy) {
          submitButton.setAttribute("aria-busy", "true");
        } else {
          submitButton.removeAttribute("aria-busy");
        }
      };

      const handOffBusyState = () => {
        if (submitButton) submitButton.removeAttribute("aria-busy");
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
            Promise.resolve()
              .then(() => window.grecaptcha.execute(siteKey, { action }))
              .then((token) => {
                tokenInput.value = token;
                form.dataset.recaptchaTokenReady = "true";
                form.requestSubmit();
                handOffBusyState();
              })
              .catch(() => {
                showError("Verification could not be completed. Please reload the page and try again.");
                setBusy(false);
              });
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
      subject: "Anti-Capture Risks",
      questionId: "anti-capture-risk",
      draftText: "Anti-Capture Review Checklist",
      draftHref: "anti-capture.html",
      prompt: "What potential risks should be flagged as possible reputation cover for AI or infrastructure actors?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=risk-and-safeguard.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/6",
    },
    evidence: {
      title: "Evidence threshold review",
      summary: "Focus on what must be measured, published, audited, or prohibited before any alignment claim.",
      subject: "Reviewer Questions",
      questionId: "minimum-evidence",
      draftText: "Reviewer Questions",
      draftHref: "reviewer-questions.html",
      prompt: "What minimum evidence should be required before any actor can claim alignment?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=risk-and-safeguard.yml",
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
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=risk-and-safeguard.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/1",
    },
    safeguard: {
      title: "Affected-party safeguard review",
      summary: "Look for missing student, worker, data, community, appeal, or governance protections.",
      subject: "Campus AI Governance",
      questionId: "affected-party-safeguard",
      draftText: "Campus Common Ground Compact",
      draftHref: "campus-ai-governance.html",
      prompt: "What student, worker, data, or community safeguard is missing or too weak?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=risk-and-safeguard.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/2",
    },
    benefit: {
      title: "Benefit-sharing review",
      summary: "Test whether benefit routing, public receipts, baseline measurement, and worker protections are strong enough.",
      subject: "AI Benefit Sharing",
      questionId: "benefit-sharing-receipt",
      draftText: "AI Dividend / Benefit Clause",
      draftHref: "benefit-sharing.html",
      prompt: "What should be published so benefit sharing is reviewable by affected people?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=draft-section-review.yml",
      seedHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/3",
    },
    clarity: {
      title: "Clarity and usability review",
      summary: "Find wording that is vague, inaccessible, hard to implement, or likely to confuse reviewers.",
      subject: "Cross-draft concern",
      questionId: "clarity-usability",
      draftText: "Reviewer Questions",
      draftHref: "reviewer-questions.html",
      prompt: "What language should be clarified, strengthened, removed, or made more practical?",
      templateHref: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard/issues/new?template=wording-and-accessibility.yml",
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

  const subjectPressureTests = {
    infrastructure: {
      subject: "Responsible AI Infrastructure",
      source: "responsible-ai-infrastructure",
      paths: {
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
      },
    },
    campus: {
      subject: "Campus AI Governance",
      source: "campus-ai-governance",
      paths: {
        authorship: {
          number: "01",
          label: "Authorship + grading",
          title: "Can students understand the rules and preserve ownership of their work?",
          risk: "Unclear rules can punish students inconsistently, blur original work, or let automated judgments replace explanation.",
          proof: "Published course rules, disclosure expectations, human grading responsibility, and evidence that learning goals are preserved.",
          protection: "Students need notice, a chance to explain their work, consistent standards, and a human appeal path.",
          stop: "When a student cannot learn what rule applied, challenge an automated judgment, or preserve authorship and learning integrity.",
          section: "authorship-grading",
          questionId: "campus-authorship-rights",
          question: "What authorship or appeal right must exist before AI is used in grading or academic-integrity decisions?",
        },
        advising: {
          number: "02",
          label: "Advising + admissions",
          title: "Can a person challenge AI-influenced decisions that shape access and opportunity?",
          risk: "Automated recommendations or rankings can quietly narrow admissions, advising, aid, or support options.",
          proof: "Disclosure of AI use, documented decision criteria, bias testing, human accountability, and outcome monitoring.",
          protection: "Applicants and students need explanation, correction, accommodation, and meaningful human review.",
          stop: "When an institution cannot explain the decision, test unequal effects, or provide a timely human appeal.",
          section: "advising-admissions",
          questionId: "campus-decision-appeal",
          question: "What notice and appeal rights should apply when AI influences admissions, advising, aid, or student support?",
        },
        surveillance: {
          number: "03",
          label: "Surveillance + proctoring",
          title: "Does the tool create monitoring or discipline risks that outweigh its purpose?",
          risk: "Remote proctoring, behavior scoring, or hidden monitoring can profile students and expand disciplinary surveillance.",
          proof: "A necessity test, less-invasive alternatives, error evidence, accessibility review, retention limits, and public policy.",
          protection: "Students need notice, opt-out or accommodation routes, data limits, human review, and protection from hidden profiling.",
          stop: "When the use is disproportionate, inaccessible, secretly monitored, or tied to discipline without reliable evidence and appeal.",
          section: "surveillance-proctoring",
          questionId: "campus-surveillance-limit",
          question: "What campus AI monitoring or proctoring use should be prohibited outright, and why?",
        },
        workers: {
          number: "04",
          label: "Work + services",
          title: "Does AI reduce burden without hiding cuts or degrading teaching and support?",
          risk: "Automation can be framed as efficiency while increasing workloads, deskilling roles, or reducing access to people.",
          proof: "Workload baselines, service-quality measures, staffing effects, worker consultation, and a transition plan.",
          protection: "Faculty and campus workers need bargaining rights, notice, training, role protections, and a say in workflow changes.",
          stop: "When service quality falls, workload shifts are hidden, or affected workers have no review or remedy.",
          section: "worker-dignity",
          questionId: "campus-worker-protection",
          question: "What worker protection should be required before a campus automates teaching, advising, or support work?",
        },
        vendors: {
          number: "05",
          label: "Vendors + student data",
          title: "Who controls student data, and can it be reused for model training?",
          risk: "Prompts, submissions, advising records, and learning data can be retained, combined, or reused beyond the educational purpose.",
          proof: "Vendor terms, data-flow records, purpose limits, retention rules, deletion rights, training prohibitions, and independent review.",
          protection: "Students and campus communities need enforceable authority over access, reuse, correction, deletion, and model training.",
          stop: "When the institution cannot prevent unauthorized training, secondary use, indefinite retention, or onward sharing.",
          section: "vendor-student-data",
          questionId: "campus-data-governance",
          question: "What student-data control must be non-negotiable in campus AI vendor agreements?",
        },
      },
    },
    benefit: {
      subject: "AI Benefit Sharing",
      source: "benefit-sharing",
      paths: {
        baseline: {
          number: "01",
          label: "Measurement baseline",
          title: "Is the claimed gain real, additional, and measured against a credible starting point?",
          risk: "An implementing organization can overstate savings, ignore new costs, or count ordinary improvements as AI-created value.",
          proof: "A documented baseline, method, time period, assumptions, total costs, quality effects, and independent checking.",
          protection: "Affected people need access to the method and a way to challenge what was counted or left out.",
          stop: "When the gain cannot be separated from cost cutting, service decline, transferred work, or unsupported assumptions.",
          section: "measurement-baseline",
          questionId: "benefit-baseline",
          question: "What evidence should be required before an organization can claim that AI created a shareable gain?",
        },
        displacement: {
          number: "02",
          label: "Worker displacement",
          title: "Could a small benefit payment be used to excuse replacement, deskilling, or worse service?",
          risk: "Benefit language can become cover for job cuts, weakened bargaining rights, work intensification, or degraded public services.",
          proof: "Staffing and workload effects, job-quality measures, bargaining records, service outcomes, and transition commitments.",
          protection: "Workers and service recipients need decision rights, labor protections, human accountability, and remedy.",
          stop: "When the claimed benefit depends on unremedied displacement, rights waivers, or lower-quality services.",
          section: "worker-displacement",
          questionId: "benefit-worker-protection",
          question: "What harm should never be treated as acceptable simply because a benefit payment is offered?",
        },
        governance: {
          number: "03",
          label: "Who decides",
          title: "Do affected people have real authority over where verified gains go?",
          risk: "The implementing party can control the calculation and route funds toward reputation, marketing, or its own priorities.",
          proof: "Defined seats, voting or approval rights, conflict rules, decision records, and appeal or correction procedures.",
          protection: "Workers, students, service recipients, and communities need more than consultation after decisions are made.",
          stop: "When affected people have no meaningful role or the implementing party can override the process unilaterally.",
          section: "benefit-governance",
          questionId: "benefit-decision-rights",
          question: "Who must have decision authority over how verified AI gains are shared?",
        },
        quality: {
          number: "04",
          label: "Benefit quality",
          title: "Does the benefit address real needs rather than create a symbolic public-relations gesture?",
          risk: "Small donations, temporary programs, or unrelated sponsorships can be presented as shared value while larger harms remain.",
          proof: "A defined share, affected-party priorities, durable funding, measurable outcomes, and separation from ordinary marketing spend.",
          protection: "Recipients need predictable commitments, transparent eligibility, and protection from benefits replacing legal obligations.",
          stop: "When the benefit is discretionary, unrelated to affected people, smaller than unremedied harm, or controlled as publicity.",
          section: "benefit-quality",
          questionId: "benefit-pathway-quality",
          question: "What makes a benefit pathway substantial enough to count as shared value rather than public relations?",
        },
        receipt: {
          number: "05",
          label: "Public receipt",
          title: "Can the public see what was measured, decided, delivered, and reviewed?",
          risk: "Claims can persist without a durable record connecting the baseline, governance decision, routed value, and actual result.",
          proof: "A non-sensitive receipt with method, amount, decision process, recipient pathway, timing, limitations, and review status.",
          protection: "Affected people need a public correction path without exposing personal, worker, student, or protected community data.",
          stop: "When the organization will not publish a checkable record or correct a material claim when evidence changes.",
          section: "public-receipt",
          questionId: "benefit-public-receipt",
          question: "What must appear in a public receipt so benefit sharing can be independently checked?",
        },
      },
    },
    questions: {
      subject: "Reviewer Questions",
      source: "reviewer-questions",
      paths: {
        campus: {
          number: "01",
          label: "Student + campus",
          title: "Which right, rule, or appeal path would matter most on a real campus?",
          risk: "Look for unclear authorship rules, hidden automation, student-data reuse, surveillance, or decisions without appeal.",
          proof: "Use a policy, student experience, vendor term, appeal process, or plausible campus scenario to test the draft.",
          protection: "Name who needs notice, consent, explanation, governance authority, accommodation, or human review.",
          stop: "End with one missing right, prohibited use, evidence requirement, or wording change the draft should adopt.",
          section: "student-campus-questions",
          questionId: "reviewer-campus-question",
          question: "What student or campus-worker right is missing, and where would it matter in practice?",
        },
        labor: {
          number: "02",
          label: "Worker + labor",
          title: "Could the draft permit automation that shifts risk or weakens worker power?",
          risk: "Look for hidden workload transfer, replacement-with-compensation logic, deskilling, surveillance, or weakened bargaining rights.",
          proof: "Use a workflow, labor agreement, staffing baseline, service measure, or transition example to test the language.",
          protection: "Name the notice, bargaining, training, job-quality, appeal, or remedy right that should be enforceable.",
          stop: "End with one labor safeguard, no-go condition, or measurement rule that would prevent avoidable harm.",
          section: "worker-labor-questions",
          questionId: "reviewer-labor-question",
          question: "What worker protection should the draft require before an AI deployment changes jobs or services?",
        },
        community: {
          number: "03",
          label: "Community + ecology",
          title: "Can affected communities see, influence, and stop burdens placed on them?",
          risk: "Look for consultation without authority, vague community benefits, hidden water or energy costs, and weak ecological remedies.",
          proof: "Use a local decision, watershed condition, utility impact, community agreement, or governance process as the test.",
          protection: "Name who needs data access, decision power, independent review, a pause right, restoration, or enforceable remedy.",
          stop: "End with one threshold that should trigger disclosure, redesign, pause, rejection, or repair.",
          section: "community-ecology-questions",
          questionId: "reviewer-community-question",
          question: "What community or ecological condition should require a project or claim to pause?",
        },
        rights: {
          number: "04",
          label: "Data + civil liberties",
          title: "Does the draft prevent secondary use, profiling, surveillance, and decisions without remedy?",
          risk: "Look for broad consent, unclear retention, model-training reuse, hidden inference, data combination, or inaccessible appeals.",
          proof: "Use a data flow, privacy rule, procurement term, rights framework, or documented failure as the test.",
          protection: "Name the purpose limit, deletion right, consent rule, audit, explanation, or human appeal that is missing.",
          stop: "End with one prohibited data use or enforceable control that the draft should state plainly.",
          section: "data-rights-questions",
          questionId: "reviewer-rights-question",
          question: "What data use or AI decision should be prohibited until a specific right or remedy exists?",
        },
        institutional: {
          number: "05",
          label: "Institution + implementation",
          title: "Can an organization actually implement the rule without weakening accountability?",
          risk: "Look for undefined owners, unverifiable measures, impossible reporting, conflicts of interest, or claims ahead of evidence.",
          proof: "Use an audit practice, procurement workflow, policy control, public record, or implementation constraint to test feasibility.",
          protection: "Name the independent role, evidence owner, review cadence, correction process, or public record needed.",
          stop: "End with one practical revision that makes the requirement clearer, testable, and resistant to self-certification.",
          section: "institutional-questions",
          questionId: "reviewer-institutional-question",
          question: "What practical change would make one requirement easier to implement without weakening accountability?",
        },
      },
    },
    capture: {
      subject: "Anti-Capture Risks",
      source: "anti-capture",
      paths: {
        governance: {
          number: "01",
          label: "Governance control",
          title: "Can one powerful actor control the rules, claims, review, or remedy?",
          risk: "A funder, vendor, operator, or steward could shape the standard, select reviewers, suppress criticism, or override affected people.",
          proof: "Decision maps, conflict rules, independent seats, public minutes, appeal rights, and limits on unilateral authority.",
          protection: "Students, workers, communities, and ecological interests need defined power early enough to change or stop decisions.",
          stop: "When one actor controls both the claim and its review, or affected people have consultation without decision rights.",
          section: "governance-capture",
          questionId: "capture-governance",
          question: "Where could one powerful actor gain too much control, and what independent check would prevent it?",
        },
        data: {
          number: "02",
          label: "Data control",
          title: "Could protected data be reused, combined, retained, or published beyond its approved purpose?",
          risk: "Broad terms can turn student, worker, community, Tribal, or ecological data into training material or institutional leverage.",
          proof: "Purpose limits, access logs, retention schedules, revocable consent, training prohibitions, and deletion verification.",
          protection: "Data subjects and communities need enforceable authority over access, reuse, sharing, correction, and withdrawal.",
          stop: "When sensitive data lacks a lawful purpose, explicit governance, minimization, security, or a practical deletion path.",
          section: "data-capture",
          questionId: "capture-data",
          question: "What data-control gap could allow misuse, and what rule should close it?",
        },
        evidence: {
          number: "03",
          label: "Evidence + claims",
          title: "Can selective evidence turn review language into reputation cover?",
          risk: "An actor could publish favorable dashboards, hide failures, treat review as endorsement, or claim alignment before proof exists.",
          proof: "Baseline methods, failure reporting, independent audit, a claims register, correction history, and clear status labels.",
          protection: "Reviewers and affected people need access to limitations, dissent, conflicts, failed tests, and correction mechanisms.",
          stop: "When evidence is self-selected, material failures can be suppressed, or review and certification are blurred.",
          section: "evidence-capture",
          questionId: "capture-evidence",
          question: "What claim could become reputation cover, and what evidence or status label should be required first?",
        },
        economics: {
          number: "04",
          label: "Economic benefit",
          title: "Could a symbolic benefit hide transferred costs, service cuts, or replacement harm?",
          risk: "Benefits can become publicity spending while workers, households, students, or communities absorb larger losses.",
          proof: "Credible baselines, total-cost accounting, labor and service effects, affected-party decisions, and durable public receipts.",
          protection: "Affected people need authority over routing and protection from benefits replacing rights, remedies, or legal duties.",
          stop: "When the benefit is smaller than unremedied harm, controlled only by the implementer, or based on unverifiable savings.",
          section: "economic-capture",
          questionId: "capture-economics",
          question: "What economic or benefit-sharing pattern could hide harm, and what safeguard would expose it?",
        },
        place: {
          number: "05",
          label: "Campus + infrastructure + ecology",
          title: "Do place-based safeguards carry enforceable thresholds, authority, and remedy?",
          risk: "Campus, infrastructure, and ecological promises can remain voluntary while surveillance, resource burdens, or habitat damage continue.",
          proof: "Binding agreements, independent measurements, student and community rights, ecological thresholds, and funded remedies.",
          protection: "Students, workers, ratepayers, nearby communities, Tribal Nations, watersheds, species, and future generations.",
          stop: "When no-go conditions are discretionary, local governance is absent, or mitigation is treated as permission to harm.",
          section: "place-based-capture",
          questionId: "capture-place",
          question: "Which place-based safeguard is easiest to weaken, and what would make it enforceable?",
        },
      },
    },
  };

  const buildSubjectReviewHref = (subjectConfig, path) => {
    const url = new URL("review-feedback.html", window.location.href);
    url.searchParams.set("source", subjectConfig.source);
    url.searchParams.set("subject", subjectConfig.subject);
    url.searchParams.set("section", path.section);
    url.searchParams.set("question_id", path.questionId);
    url.searchParams.set("question", path.question);
    return url.href;
  };

  const initSubjectPressureTests = () => {
    document.querySelectorAll("[data-pressure-test]").forEach((test) => {
      const subjectConfig = subjectPressureTests[test.dataset.pressureTest];
      if (!subjectConfig) return;

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

      const firstKey = Object.keys(subjectConfig.paths)[0];
      const update = (key) => {
        const activeKey = subjectConfig.paths[key] ? key : firstKey;
        const path = subjectConfig.paths[activeKey];
        Object.entries(fields).forEach(([name, element]) => {
          if (!element || name === "feedback") return;
          element.textContent = path[name];
        });
        if (fields.feedback) fields.feedback.href = buildSubjectReviewHref(subjectConfig, path);
        test.querySelectorAll("[data-pressure-key]").forEach((button) => {
          const active = button.dataset.pressureKey === activeKey;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", active ? "true" : "false");
        });
      };

      test.addEventListener("click", (event) => {
        const button = event.target instanceof Element ? event.target.closest("[data-pressure-key]") : null;
        if (button) update(button.dataset.pressureKey);
      });
      update(firstKey);
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

  const reviewReturnPages = {
    "Responsible AI Infrastructure": ["responsible-ai-infrastructure.html", "Return to Responsible AI Infrastructure"],
    "Campus AI Governance": ["campus-ai-governance.html", "Return to Campus AI Governance"],
    "AI Benefit Sharing": ["benefit-sharing.html", "Return to AI Benefit Sharing"],
    "Reviewer Questions": ["reviewer-questions.html", "Return to Reviewer Questions"],
    "Anti-Capture Risks": ["anti-capture.html", "Return to Anti-Capture Risks"],
  };

  const initReviewThankYou = () => {
    const returnLink = document.querySelector("[data-review-return]");
    if (!returnLink) return;

    const params = new URLSearchParams(window.location.search);
    const subject = params.get("subject") || "";
    const requestedPage = params.get("return") || "";
    const subjectRoute = reviewReturnPages[subject];
    const safePages = new Map(Object.values(reviewReturnPages).map(([page, label]) => [page, label]));
    const page = safePages.has(requestedPage) ? requestedPage : subjectRoute?.[0];
    if (!page) return;

    returnLink.href = page;
    returnLink.childNodes[0].textContent = `${safePages.get(page)} `;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initReviewAssistant();
      initContactPrefill();
      initSubjectPressureTests();
      initReviewFeedbackForm();
      initReviewThankYou();
    }, { once: true });
  } else {
    initReviewAssistant();
    initContactPrefill();
    initSubjectPressureTests();
    initReviewFeedbackForm();
    initReviewThankYou();
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
