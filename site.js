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
