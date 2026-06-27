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
