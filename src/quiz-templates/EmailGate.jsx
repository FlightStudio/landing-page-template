import { useState } from "react";
import { subscribeToKlaviyo, identifyKlaviyo } from "./klaviyo";
import { ensureRudderStackSDK } from "./consent";
import {
  CAMPAIGN_SLUG,
  CAMPAIGN_NAME,
  BRAND_LOGO,
  PRIVACY_POLICY_URL,
} from "./campaign.config";
import { GATE_CONTENT, DISCLAIMERS, QUESTIONS } from "./quizData";

export default function EmailGate({ variant, onComplete }) {
  const [email, setEmail] = useState("");
  const [emailConsent, setEmailConsent] = useState(false);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email.trim()) {
      setErrorMsg("Please enter your email address.");
      setStatus("error");
      return;
    }

    if (!emailConsent) {
      setErrorMsg("Please consent to email marketing to continue.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    try {
      const payload = { email: email.trim(), firstName: "", phone: null, variant };
      const res = await subscribeToKlaviyo(payload);

      if (res.ok || res.status === 202) {
        window.__formSubmission = { payload, variant };
        identifyKlaviyo(payload);

        const quizStartedProps = {
          landing_page: CAMPAIGN_SLUG,
          variant,
          campaign: CAMPAIGN_NAME,
        };
        ensureRudderStackSDK();
        window.rudderanalytics.ready(function () {
          window.rudderanalytics.track("Quiz Started", quizStartedProps);
        });
        window.fbq?.("track", "Lead");
        window.__quizStarted = quizStartedProps;

        onComplete(email.trim());
      } else {
        setErrorMsg("Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  const isSubmitting = status === "submitting";

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Logo */}
      <div className="mb-10 md:mb-16">
        <img src={BRAND_LOGO} alt="Logo" className="h-10 md:h-12 w-auto" />
      </div>

      <div>
        {/* Label */}
        <p className="font-label text-xs uppercase tracking-[0.2em] text-surface-container/60 mb-4">
          {GATE_CONTENT.label || "Quiz"}
        </p>

        {/* Headline — supports per-variant headlines */}
        <h1 className="font-headline text-4xl md:text-5xl lg:text-6xl font-semibold text-surface-container leading-[1.05] mb-6 uppercase">
          {typeof GATE_CONTENT.headline === "object"
            ? GATE_CONTENT.headline[variant] || Object.values(GATE_CONTENT.headline)[0]
            : GATE_CONTENT.headline}
        </h1>

        {/* Body */}
        <p className="font-body text-base md:text-lg text-surface-container/60 leading-relaxed mb-8 max-w-xl">
          {GATE_CONTENT.body}
        </p>

        {/* Info chips */}
        <div className="flex items-center gap-6 mb-10 text-surface-container/50">
          <span className="flex items-center gap-2 font-body text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Under {Math.ceil(QUESTIONS.length / 4)} minutes
          </span>
          <span className="flex items-center gap-2 font-body text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18M3 9h18" />
            </svg>
            {QUESTIONS.length} questions
          </span>
        </div>

        {/* Email capture */}
        <form onSubmit={handleSubmit} className="max-w-md mb-4">
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="email@address.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="flex-1 bg-white border border-surface-container/15 focus:border-surface-container outline-none rounded-full px-5 py-3.5 font-body text-sm text-surface-container placeholder:text-surface-container/35 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-surface-container text-primary font-headline text-sm font-bold px-6 py-3.5 rounded-full hover:bg-surface-container-high transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isSubmitting ? "..." : GATE_CONTENT.button}
            </button>
          </div>

          <label className="flex items-start gap-3 cursor-pointer mt-4 ml-1">
            <input
              type="checkbox"
              checked={emailConsent}
              onChange={(e) => setEmailConsent(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 accent-surface-container"
            />
            <span className="font-body text-xs text-surface-container/50 leading-relaxed">
              By signing up, you agree to receiving marketing emails from us. Your
              information is stored securely and used in accordance with our{" "}
              <a
                href={PRIVACY_POLICY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-surface-container transition-colors"
              >
                Privacy Policy
              </a>. You can unsubscribe at any time.
            </span>
          </label>

          {status === "error" && (
            <p className="font-body text-xs text-red-600 mt-3 ml-1">{errorMsg}</p>
          )}
        </form>

        {DISCLAIMERS.intro && (
          <p className="mt-10 font-body text-xs text-surface-container/35 leading-relaxed max-w-md italic">
            {DISCLAIMERS.intro}
          </p>
        )}
      </div>
    </div>
  );
}
