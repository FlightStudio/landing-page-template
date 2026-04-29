import { useState } from "react";
import { subscribe } from "./subscribe";
import { normalisePhone } from "./klaviyo";
import { ensureRudderStackSDK } from "./consent";
import {
  CAMPAIGN_SLUG,
  CAMPAIGN_NAME,
  BRAND_NAME,
  PRIVACY_POLICY_URL,
  TERMS_URL,
  CONTENT,
  FORM_FIELDS,
} from "./campaign.config";

const DIAL_CODES = [
  { code: "+44", label: "UK +44" },
  { code: "+1", label: "US/CA +1" },
  { code: "+353", label: "IE +353" },
  { code: "+61", label: "AU +61" },
  { code: "+64", label: "NZ +64" },
  { code: "+91", label: "IN +91" },
  { code: "+49", label: "DE +49" },
  { code: "+33", label: "FR +33" },
  { code: "+34", label: "ES +34" },
  { code: "+39", label: "IT +39" },
  { code: "+31", label: "NL +31" },
  { code: "+46", label: "SE +46" },
  { code: "+47", label: "NO +47" },
  { code: "+45", label: "DK +45" },
  { code: "+358", label: "FI +358" },
  { code: "+48", label: "PL +48" },
  { code: "+41", label: "CH +41" },
  { code: "+43", label: "AT +43" },
  { code: "+32", label: "BE +32" },
  { code: "+351", label: "PT +351" },
  { code: "+30", label: "GR +30" },
  { code: "+90", label: "TR +90" },
  { code: "+971", label: "AE +971" },
  { code: "+966", label: "SA +966" },
  { code: "+27", label: "ZA +27" },
  { code: "+234", label: "NG +234" },
  { code: "+254", label: "KE +254" },
  { code: "+55", label: "BR +55" },
  { code: "+52", label: "MX +52" },
  { code: "+81", label: "JP +81" },
  { code: "+82", label: "KR +82" },
  { code: "+86", label: "CN +86" },
  { code: "+65", label: "SG +65" },
  { code: "+60", label: "MY +60" },
  { code: "+63", label: "PH +63" },
  { code: "+66", label: "TH +66" },
  { code: "+852", label: "HK +852" },
  { code: "+62", label: "ID +62" },
];

export default function SignupForm({ variant, onSuccess }) {
  // State seeded from FORM_FIELDS — every key in the schema gets an empty string.
  const initialForm = Object.fromEntries(FORM_FIELDS.map((f) => [f.key, ""]));
  const [form, setForm] = useState(initialForm);
  const [dialCode, setDialCode] = useState("+44");
  const [emailConsent, setEmailConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | submitting | error
  const [errorMsg, setErrorMsg] = useState("");

  function updateField(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  const phoneField = FORM_FIELDS.find((f) => f.type === "tel");
  const hasPhone = phoneField && form[phoneField.key]?.trim().length > 0;

  async function handleSubmit(e) {
    e.preventDefault();

    // Required fields
    for (const field of FORM_FIELDS) {
      if (field.required && !form[field.key]?.trim()) {
        setErrorMsg(`Please fill in ${field.label.toLowerCase()}.`);
        setStatus("error");
        return;
      }
    }

    // Email consent is always required
    if (!emailConsent) {
      setErrorMsg("Please consent to email marketing to continue.");
      setStatus("error");
      return;
    }

    // SMS consent if phone entered
    if (hasPhone && !smsConsent) {
      setErrorMsg("Please consent to SMS marketing or remove your phone number.");
      setStatus("error");
      return;
    }

    // Build the values dictionary. Phone gets E.164 normalisation if present.
    const values = { ...form };
    Object.keys(values).forEach((k) => {
      if (typeof values[k] === "string") values[k] = values[k].trim();
    });
    if (phoneField && values[phoneField.key]) {
      const normalised = normalisePhone(values[phoneField.key], dialCode);
      if (!normalised) {
        setErrorMsg("Please enter a valid phone number.");
        setStatus("error");
        return;
      }
      values[phoneField.key] = normalised;
    }

    setStatus("submitting");
    setErrorMsg("");

    try {
      const result = await subscribe({
        email: values.email,
        variant,
        values,
      });

      if (result.ok) {
        // Stash submission so CookieConsent can replay Klaviyo identify after consent.
        // Shape preserved for back-compat with CookieConsent.jsx.
        window.__formSubmission = {
          payload: {
            email: values.email,
            firstName: values.firstName,
            phone: values.phone,
            variant,
          },
          values,
          variant,
        };

        // RudderStack — fires regardless of cookie consent
        ensureRudderStackSDK();
        window.rudderanalytics.ready(function () {
          window.rudderanalytics.track("Form Submitted", {
            landing_page: CAMPAIGN_SLUG,
            variant,
            campaign: CAMPAIGN_NAME,
          });
        });
        window.fbq?.("track", "Lead");

        onSuccess();
      } else {
        setErrorMsg(result.error || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  const isSubmitting = status === "submitting";
  const inputClass =
    "w-full bg-transparent border-b border-outline focus:border-tertiary outline-none py-2.5 font-body text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-colors disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {FORM_FIELDS.map((field) => {
        // Phone gets the dial-code selector + E.164 normalisation on submit
        if (field.type === "tel") {
          return (
            <div key={field.key} className="flex gap-2">
              <select
                value={dialCode}
                onChange={(e) => setDialCode(e.target.value)}
                disabled={isSubmitting}
                className="bg-transparent border-b border-outline focus:border-tertiary outline-none py-2.5 font-body text-sm text-on-surface transition-colors disabled:opacity-50 cursor-pointer"
              >
                {DIAL_CODES.map((dc) => (
                  <option key={dc.code} value={dc.code} className="bg-surface text-on-surface">
                    {dc.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                placeholder={field.label}
                value={form[field.key] || ""}
                onChange={updateField(field.key)}
                disabled={isSubmitting}
                className={inputClass}
              />
            </div>
          );
        }
        return (
          <input
            key={field.key}
            type={field.type || "text"}
            placeholder={field.label}
            value={form[field.key] || ""}
            onChange={updateField(field.key)}
            disabled={isSubmitting}
            className={inputClass}
          />
        );
      })}

      {/* Email marketing consent — always visible, required */}
      <label className="flex items-start gap-3 cursor-pointer pt-2">
        <input
          type="checkbox"
          checked={emailConsent}
          onChange={(e) => setEmailConsent(e.target.checked)}
          disabled={isSubmitting}
          className="mt-0.5 accent-tertiary"
        />
        <span className="font-body text-xs text-on-surface-variant leading-relaxed">
          By signing up, you agree to receiving marketing emails from us. Your
          information is stored securely and used in accordance with our{" "}
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-on-surface transition-colors"
          >
            Privacy Policy
          </a>. You can unsubscribe at any time.
        </span>
      </label>

      {/* SMS marketing consent — only shown when phone is entered */}
      {hasPhone && (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            disabled={isSubmitting}
            className="mt-0.5 accent-tertiary"
          />
          <span className="font-body text-xs text-on-surface-variant leading-relaxed">
            By providing your phone number, you consent to receive marketing text
            messages from {BRAND_NAME}. Consent is not a condition of entry.
            Msg &amp; data rates may apply. Message frequency varies. Unsubscribe at
            any time by replying STOP.{" "}
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-on-surface transition-colors"
            >
              Privacy Policy
            </a>{" "}
            &amp;{" "}
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-on-surface transition-colors">
              Terms
            </a>.
          </span>
        </label>
      )}

      {status === "error" && (
        <p className="font-body text-xs text-error">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary text-on-primary font-label text-xs font-black uppercase tracking-[0.2em] py-3.5 hover:bg-primary-dim transition-colors disabled:opacity-50"
      >
        {isSubmitting ? "Submitting…" : CONTENT.submitButton}
      </button>
    </form>
  );
}
