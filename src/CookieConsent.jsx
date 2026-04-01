import { useState } from "react";
import { getConsent, setConsent } from "./consent";
import { identifyKlaviyo } from "./klaviyo";
import { CAMPAIGN_SLUG, PRIVACY_POLICY_URL } from "./campaign.config";

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => !getConsent());

  if (!visible) return null;

  function accept() {
    setConsent("accepted");
    window.rudderanalytics.track("Cookie Consent", {
      action: "accepted",
      landing_page: CAMPAIGN_SLUG,
    });
    // Replay Klaviyo identify if form was already submitted
    const sub = window.__formSubmission;
    if (sub) identifyKlaviyo(sub.payload);
    setVisible(false);
  }

  function reject() {
    setConsent("rejected");
    window.rudderanalytics.track("Cookie Consent", {
      action: "rejected",
      landing_page: CAMPAIGN_SLUG,
    });
    // Replay Klaviyo identify if form was already submitted
    const sub = window.__formSubmission;
    if (sub) identifyKlaviyo(sub.payload);
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-surface-container border-t border-outline-variant/20 px-6 py-5 font-body">
      <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-4">
        <p className="text-sm text-on-surface-variant leading-relaxed flex-1">
          We use cookies to analyse site traffic and improve your experience.{" "}
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-tertiary underline underline-offset-2 hover:text-tertiary-dim transition-colors"
          >
            Privacy Policy
          </a>
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={accept}
            className="bg-primary text-on-primary font-label text-xs font-bold px-6 py-3 uppercase tracking-widest hover:bg-white transition-all duration-300 active:scale-95"
          >
            Accept all
          </button>
          <button
            onClick={reject}
            className="border border-outline-variant text-on-surface font-label text-xs font-bold px-6 py-3 uppercase tracking-widest hover:bg-surface-bright transition-all duration-300 active:scale-95"
          >
            Reject non-essential
          </button>
        </div>
      </div>
    </div>
  );
}
