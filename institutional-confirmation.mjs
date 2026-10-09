// The builder and confirmation renderer share this bounded, URL-safe marker contract.
export const isInstitutionalRc1Record = (record) => {
  if (typeof record !== "string" || record.length > 128) return false;
  const match = /^CGS-INSTITUTIONAL-RC1-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.exec(record);
  return match?.[0] === record;
};

export const initInstitutionalThankYou = (document, location) => {
  if (!document.querySelector("[data-institutional-result-title]")) return;

  const params = new URLSearchParams(location.search);
  if (params.getAll("mode").length !== 1 || params.getAll("record").length > 1) return;
  const mode = params.get("mode");
  const record = params.get("record") || "";
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  if (mode === "test" && !params.has("record")) {
    document.title = "Institutional Intake Test Complete | Common Ground Standard";
    setText("[data-institutional-result-label]", "Institutional intake test");
    setText("[data-institutional-result-title]", "Validation complete.");
    setText(
      "[data-institutional-result-summary]",
      "The local test flow reported successful form validation. This local-only mode does not send institutional form-field data to Formspree, reCAPTCHA, the current steward, or any other recipient.",
    );
    setText("[data-institutional-result-status]", "Local validation result");
    setText("[data-institutional-result-transmission]", "None — local-only test mode");
    setText("[data-institutional-result-live]", "Held pending remaining activation controls");
    setText("[data-institutional-result-notice-title]", "This was not an institutional submission.");
    setText(
      "[data-institutional-result-notice-copy]",
      "The operating charter is approved. Live intake remains disabled until the remaining activation controls and separate final launch authorization are complete.",
    );
    return;
  }

  if (mode === "live") {
    document.title = "Institutional Review Note Received | Common Ground Standard";
    setText("[data-institutional-result-label]", "Institutional review intake");
    setText("[data-institutional-result-title]", "Your review note was received.");
    setText(
      "[data-institutional-result-summary]",
      "The current steward will assess the note against the published fit, conflict, scope, privacy, and participation controls before proposing any next step.",
    );
    setText("[data-institutional-result-status]", "Received for bounded fit assessment");
    setText("[data-institutional-result-transmission]", "Submitted privately through Formspree");
    setText("[data-institutional-result-live]", "Active under published operating controls");
    setText(
      "[data-institutional-result-notice-title]",
      "Receipt does not create an institutional role or public association.",
    );
    setText(
      "[data-institutional-result-notice-copy]",
      "The note begins an internal fit assessment only. Partnership, endorsement, membership, accreditation, certification, adoption, funding priority, confidential access, and public listing all require separate written decisions.",
    );
    return;
  }

  if (mode !== "integration-success" || !isInstitutionalRc1Record(record)) return;

  document.title = "Institutional Routing Test Accepted | Common Ground Standard";
  setText("[data-institutional-result-label]", "Controlled institutional routing test");
  setText("[data-institutional-result-title]", "Routing response accepted.");
  setText(
    "[data-institutional-result-summary]",
    "The routing flow reported Formspree acceptance of one staging-only synthetic record. This page does not confirm inbox delivery or final classification; the receipt must be verified in Formspree before the gate can close.",
  );
  setText("[data-institutional-result-status]", "Formspree response accepted");
  setText("[data-institutional-result-transmission]", "One synthetic test record");
  setText("[data-institutional-result-live]", "Disabled — no live intake opened");
  setText(
    "[data-institutional-result-notice-title]",
    "This was a synthetic routing verification, not an institutional submission.",
  );
  setText(
    "[data-institutional-result-notice-copy]",
    `Receipt ${record} must be checked for delivery status and deleted after verification. Live institutional intake remains disabled pending separate final authorization.`,
  );
};

if (typeof document !== "undefined" && typeof window !== "undefined") {
  initInstitutionalThankYou(document, window.location);
}
