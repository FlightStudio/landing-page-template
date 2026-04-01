import { useState } from "react";
import { RESULTS, DISCLAIMERS, SCORE_CATEGORIES, SHARE_TEXT } from "./quizData";
import { BRAND_LOGO } from "./campaign.config";

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const shareUrl = window.location.origin;
  const shareText = SHARE_TEXT || "Take the quiz and find out your result!";

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, url: shareUrl });
        return;
      } catch { /* user cancelled */ }
    }
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      className="w-full bg-surface-container text-primary font-headline text-sm font-bold px-6 py-4 rounded-full hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
      </svg>
      {copied ? "Link copied!" : "Share my result"}
    </button>
  );
}

export default function ResultsPage({ result }) {
  const data = RESULTS[result.primary];
  if (!data) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Take again */}
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 font-body text-sm text-surface-container/50 hover:text-surface-container transition-colors mb-6"
      >
        <span className="text-lg leading-none">&larr;</span> Take again
      </button>

      {/* Logo + Result banner */}
      <div className="bg-surface-container text-primary text-center pt-6 pb-4 px-4 rounded-t-xl">
        <img src={BRAND_LOGO} alt="Logo" className="h-8 mx-auto mb-4" />
        <p className="font-label text-xs uppercase tracking-[0.25em] font-bold">
          Your Result
        </p>
      </div>

      {/* Result content */}
      <div className="bg-white rounded-b-xl p-6 md:p-10 mb-8">
        <h1 className="font-headline text-3xl md:text-5xl font-bold text-surface-container leading-tight mb-3">
          {data.title}
        </h1>
        {data.subtitle && (
          <p className="font-body text-lg md:text-xl text-surface-container/50 italic mb-6">
            {data.subtitle}
          </p>
        )}

        {/* Description */}
        <div className="border-l-4 border-surface-container/20 pl-5 mb-8">
          <p className="font-body text-sm md:text-base text-surface-container/70 leading-relaxed">
            {data.description}
          </p>
        </div>

        {/* Disclaimer */}
        {DISCLAIMERS.result && (
          <p className="font-body text-xs text-surface-container/40 italic mb-8">
            {DISCLAIMERS.result}
          </p>
        )}

        {/* Score bars (if categories are defined) */}
        {SCORE_CATEGORIES && SCORE_CATEGORIES.length > 0 && (
          <div className="space-y-3 mb-10">
            {SCORE_CATEGORIES.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="font-label text-xs uppercase tracking-wider text-surface-container/60 w-20 flex-shrink-0">
                  {label}
                </span>
                <div className="flex-1 h-2 bg-surface-container/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      key === result.primary ? "bg-surface-container" : "bg-surface-container/30"
                    }`}
                    style={{ width: `${result.percentages[key] || 0}%` }}
                  />
                </div>
                <span className="font-body text-xs text-surface-container/50 w-8 text-right">
                  {result.percentages[key] || 0}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Trait cards */}
        {data.traits && data.traits.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {data.traits.map((trait) => (
              <div key={trait.label} className="bg-surface-container rounded-xl p-5">
                <p className="font-label text-xs uppercase tracking-[0.15em] font-bold text-primary mb-2">
                  {trait.label}
                </p>
                <p className="font-body text-sm text-primary/80 leading-relaxed">
                  {trait.copy}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Share */}
        <ShareButton />

        {/* Recommended content (episodes, articles, etc.) */}
        {data.recommendations && data.recommendations.length > 0 && (
          <>
            <hr className="border-surface-container/10 my-8" />
            <div>
              <h3 className="font-headline text-xl font-bold text-surface-container mb-4">
                {data.recommendationsTitle || "Recommended for you"}
              </h3>
              <div className="space-y-4">
                {data.recommendations.map((item, i) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden bg-surface-container/5 hover:bg-surface-container/10 transition-colors p-4"
                  >
                    <p className="font-body text-sm font-semibold text-surface-container">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="font-body text-xs text-surface-container/40 mt-1">
                        {item.description}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
