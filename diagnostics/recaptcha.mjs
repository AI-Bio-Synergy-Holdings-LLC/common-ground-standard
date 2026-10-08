export const STAGING_ORIGIN = "https://common-ground-standard-institutional.onrender.com";

export const diagnosticConfig = (config, origin) => {
  if (
    !config || config.mode !== "recaptcha-diagnostic" ||
    origin !== STAGING_ORIGIN || config.allowedOrigin !== STAGING_ORIGIN ||
    !/^[A-Za-z0-9_-]{20,}$/.test(config.recaptchaSiteKey || "") ||
    config.action !== "institutional_rc1_test" ||
    "formEndpoint" in config || "secretKey" in config
  ) return null;
  return { siteKey: config.recaptchaSiteKey, action: config.action };
};

const redact = (value, siteKey) => String(value)
  .replaceAll(siteKey, "[redacted key]")
  .replace(/[A-Za-z0-9_-]{30,}/g, "[redacted credential]")
  .replace(/https?:\/\/[^\s]+/g, "[redacted URL]")
  .replace(/[\w.+-]+@[\w.-]+/g, "[redacted email]")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .slice(0, 240);

export const diagnosticError = (error, siteKey) => ({
  type: error === null ? "null" : typeof error,
  name: redact(error?.name || "Non-Error rejection", siteKey),
  code: redact(error?.code ?? "unavailable", siteKey),
  message: redact(error?.message ?? (typeof error === "string" ? error : "No error message supplied"), siteKey),
});

export const withTimeout = (promise, timeoutMs, stage) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Object.assign(new Error(`${stage} timed out`), { code: "timeout" })), timeoutMs);
  Promise.resolve(promise).then(resolve, reject).finally(() => clearTimeout(timer));
});

export const runDiagnostic = async ({ siteKey, action, load, api, report, timeoutMs = 15000 }) => {
  let stage = "script-load";
  report({ stage, status: "running" });
  try {
    await withTimeout(load(), timeoutMs, stage);
    stage = "api-ready";
    const client = api();
    report({
      stage, status: "running",
      readyAvailable: typeof client?.ready === "function",
      executeAvailable: typeof client?.execute === "function",
    });
    if (typeof client?.ready !== "function") {
      throw Object.assign(new Error("reCAPTCHA ready API unavailable after script load"), { code: "api-unavailable" });
    }
    await withTimeout(new Promise((resolve) => client.ready(resolve)), timeoutMs, stage);
    // api.js can initially expose only a ready queue. The full library installs execute later
    // and may replace the API object, so obtain the current client after the ready callback.
    const readyClient = api();
    if (typeof readyClient?.execute !== "function") {
      throw Object.assign(new Error("reCAPTCHA execute API unavailable after ready callback"), { code: "execute-unavailable" });
    }
    stage = "execute";
    report({ stage, status: "running" });
    // The token remains local to this scope. It is never added to a form, logged, stored, or sent.
    let token = await withTimeout(Promise.resolve().then(() => readyClient.execute(siteKey, { action })), timeoutMs, stage);
    if (typeof token !== "string" || token.length === 0) {
      throw Object.assign(new Error("reCAPTCHA returned an empty token"), { code: "empty-token" });
    }
    const result = { stage: "token-issued", status: "passed", tokenLength: token.length };
    token = null;
    report(result);
    return result;
  } catch (error) {
    const result = { stage, status: "failed", error: diagnosticError(error, siteKey) };
    report(result);
    return result;
  }
};

if (typeof document !== "undefined") {
  const button = document.querySelector("[data-run]");
  const status = document.querySelector("[data-status]");
  const output = document.querySelector("[data-result]");
  const host = document.querySelector("[data-host]");
  const config = diagnosticConfig(window.__CGS_INSTITUTIONAL_RC1__, window.location.origin);
  host.textContent = window.location.hostname;
  if (config) {
    status.textContent = "Ready. Run one diagnostic to check token issuance.";
    button.disabled = false;
    let attempted = false;
    let active = false;
    const evidence = [];
    const report = (result) => {
      evidence.push(result);
      output.textContent = JSON.stringify({ host: window.location.hostname, action: config.action, evidence }, null, 2);
      status.textContent = result.status === "passed"
        ? `Token issued (${result.tokenLength} characters) and discarded. No submission was sent.`
        : result.status === "failed"
          ? `Diagnostic failed at ${result.stage}. See the redacted error below.`
          : `Checking ${result.stage}…`;
    };
    document.addEventListener("securitypolicyviolation", (event) => {
      if (!active) return;
      evidence.push({ stage: "csp", directive: event.effectiveDirective, blocked: "Resource blocked; URL omitted" });
    });
    button.addEventListener("click", async () => {
      if (attempted) return;
      attempted = true;
      active = true;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      await runDiagnostic({
        ...config,
        api: () => window.grecaptcha,
        report,
        load: () => new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(config.siteKey)}`;
          script.async = true;
          script.onload = resolve;
          script.onerror = () => reject(Object.assign(new Error("Google reCAPTCHA script could not load"), { code: "script-load-error" }));
          document.head.appendChild(script);
        }),
      });
      active = false;
      button.removeAttribute("aria-busy");
      button.textContent = "Diagnostic complete — reload for another run";
    });
  }
}
