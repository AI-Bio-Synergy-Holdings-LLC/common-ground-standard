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

  const contactForm = document.querySelector("[data-contact-form]");
  if (contactForm) {
    const status = contactForm.querySelector("[data-form-status]");
    const submitButton = contactForm.querySelector("button[type='submit']");

    contactForm.addEventListener("submit", async (event) => {
      if (!window.fetch || !window.FormData) return;
      event.preventDefault();
      if (!contactForm.reportValidity()) return;

      if (submitButton) submitButton.disabled = true;
      if (status) status.textContent = "Sending...";

      try {
        const response = await fetch(contactForm.action, {
          method: "POST",
          body: new FormData(contactForm),
          headers: { Accept: "application/json" }
        });

        if (response.ok) {
          const successUrl = new URL(contactForm.dataset.successUrl || "contact-thank-you.html", window.location.href);
          window.location.href = successUrl.href;
          return;
        }

        const payload = await response.json().catch(() => null);
        const message = payload?.errors?.[0]?.message || "The form could not be submitted. Please use one of the email links instead.";
        if (status) status.textContent = message;
      } catch {
        if (status) status.textContent = "The form could not be submitted. Please use one of the email links instead.";
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
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
