import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SignupForm from "./SignupForm";
import {
  BRAND_LOGO,
  CONTENT,
  MEDIA,
  PRIVACY_POLICY_URL,
  COOKIE_POLICY_URL,
  TERMS_URL,
  PAGE_TITLE,
} from "./campaign.config";

export default function LandingPage({ variant }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.title = PAGE_TITLE;
    if (searchParams.get("variant") !== variant) {
      setSearchParams({ variant }, { replace: true });
    }
  }, [variant, searchParams, setSearchParams]);

  return (
    <div className="font-body selection:bg-tertiary selection:text-on-tertiary min-h-dvh overflow-x-hidden">
      {/* Hero */}
      <main className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0 transition-opacity duration-1000">
          <div
            className={`absolute inset-0 bg-gradient-to-b from-surface via-transparent to-surface-container-lowest z-10 transition-opacity duration-1000 ${
              submitted ? "opacity-50" : "opacity-90"
            }`}
          />
          <div
            className={`absolute inset-0 bg-surface-container-lowest/40 z-10 transition-opacity duration-1000 ${
              submitted ? "opacity-0" : "opacity-100"
            }`}
          />
          {variant === "video" ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              poster={MEDIA.imageJpg}
              className={`w-full h-full object-cover transition-all duration-1000 ${
                submitted
                  ? "grayscale-0 opacity-70"
                  : "grayscale opacity-50"
              }`}
            >
              <source src={MEDIA.video} type="video/mp4" />
            </video>
          ) : (
            <picture className="contents">
              <source srcSet={MEDIA.imageWebp} type="image/webp" />
              <img
                src={MEDIA.imageJpg}
                alt=""
                className={`w-full h-full object-cover transition-all duration-1000 ${
                  submitted
                    ? "grayscale-0 opacity-70"
                    : "grayscale opacity-50"
                }`}
              />
            </picture>
          )}
        </div>

        {/* Content */}
        <div className="relative z-20 w-full max-w-2xl px-6 py-8 md:py-12">
          {/* Brand Mark */}
          <div className="flex items-center justify-center mb-6 md:mb-10">
            <img
              alt="Logo"
              className="h-8 md:h-10 w-auto"
              src={BRAND_LOGO}
            />
          </div>

          {/* Card */}
          <div
            className={`backdrop-blur-2xl border border-white/10 shadow-2xl transition-all duration-1000 ${
              submitted
                ? "bg-surface-container-low/40 p-6 md:p-8"
                : "bg-surface-container-low/60 p-6 md:p-10"
            }`}
          >
            {submitted ? (
              /* Post-submission state */
              <div className="text-center">
                <h1 className="font-headline text-4xl md:text-6xl font-black text-on-surface tracking-tighter leading-[0.9] mb-4 md:mb-6 uppercase">
                  {CONTENT.headline} <br />
                  <span className="text-primary">{CONTENT.headlineAccent}</span>
                </h1>
                <p className="font-headline text-2xl md:text-3xl font-black text-tertiary uppercase tracking-tight mb-3">
                  {CONTENT.postSubmitHeadline}
                </p>
                <p className="font-body text-sm md:text-base text-on-surface-variant">
                  {CONTENT.postSubmitBody}
                </p>
              </div>
            ) : (
              /* Pre-submission state */
              <>
                {/* Label */}
                <div className="mb-4 md:mb-6 text-center">
                  <span className="font-label text-tertiary-fixed text-[10px] uppercase tracking-[0.3em] font-black">
                    {CONTENT.label}
                  </span>
                </div>

                {/* Headline */}
                <h1 className="font-headline text-4xl md:text-6xl font-black text-on-surface tracking-tighter leading-[0.9] mb-4 md:mb-6 text-center uppercase">
                  {CONTENT.headline} <br />
                  <span className="text-primary">{CONTENT.headlineAccent}</span>
                </h1>

                {/* Supporting Copy */}
                <p className="font-body text-sm md:text-base text-on-surface-variant leading-relaxed mb-6 md:mb-8 text-center max-w-lg mx-auto">
                  {CONTENT.body}
                </p>

                {/* Signup Form */}
                <SignupForm variant={variant} onSuccess={() => setSubmitted(true)} />
              </>
            )}
          </div>
        </div>

        {/* Footer Links */}
        <div className="relative z-20 flex justify-center gap-6 py-6">
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-[10px] uppercase tracking-widest text-outline hover:text-on-surface-variant transition-colors"
          >
            Terms &amp; Conditions
          </a>
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-[10px] uppercase tracking-widest text-outline hover:text-on-surface-variant transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href={COOKIE_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-[10px] uppercase tracking-widest text-outline hover:text-on-surface-variant transition-colors"
          >
            Cookie Policy
          </a>
        </div>
      </main>
    </div>
  );
}
