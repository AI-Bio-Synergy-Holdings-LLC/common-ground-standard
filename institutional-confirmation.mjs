// Builder marker syntax only: a well-formed marker is not receipt or authorization evidence.
export const isInstitutionalRc1Record = (record) => {
  if (typeof record !== "string" || record.length > 128) return false;
  const match = /^CGS-INSTITUTIONAL-RC1-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.exec(record);
  return match?.[0] === record;
};

export const initInstitutionalThankYou = (document) => {
  if (!document.querySelector("[data-institutional-result-title]")) return;

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  // Never read URL parameters or infer a completed flow from client presentation.
  // Restore the same neutral copy as the raw/no-JavaScript template for every result URL.
  document.title = "Institutional Review Result | Common Ground Standard";
  setText("[data-institutional-result-label]", "Institutional review result");
  setText("[data-institutional-result-title]", "Result not verified.");
  setText(
    "[data-institutional-result-summary]",
    "This page has not established a valid routing result. It does not prove that data was sent or that nothing was sent. Check the authorized verification record before taking any next step; do not submit again from this page.",
  );
  setText("[data-institutional-result-status]", "Not verified");
  setText("[data-institutional-result-transmission]", "Not established by this page");
  setText("[data-institutional-result-live]", "Not established by this page");
  setText(
    "[data-institutional-result-notice-title]",
    "Verify the result before closing the gate.",
  );
  setText(
    "[data-institutional-result-notice-copy]",
    "Confirmation URL parameters alone cannot establish receipt, non-transmission, or live activation. Receipt verification, deletion, and any activation require their separate operating controls.",
  );
};

if (typeof document !== "undefined") {
  initInstitutionalThankYou(document);
}
