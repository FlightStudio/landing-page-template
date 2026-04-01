import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EmailGate from "./EmailGate";
import QuizQuestion from "./QuizQuestion";
import ResultsPage from "./ResultsPage";
import { updateKlaviyoProfile } from "./klaviyo";
import { ensureRudderStackSDK } from "./consent";
import { computeResult, shuffle } from "./scoring";
import { QUESTIONS, RESULT_PROPERTY_NAME } from "./quizData";
import {
  PAGE_TITLE,
  CAMPAIGN_SLUG,
  CAMPAIGN_NAME,
  BRAND_LOGO,
  PRIVACY_POLICY_URL,
  COOKIE_POLICY_URL,
  TERMS_URL,
} from "./campaign.config";

export default function QuizPage({ variant }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [phase, setPhase] = useState("gate"); // "gate" | "quiz" | "results"
  const [email, setEmail] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState(Array(QUESTIONS.length).fill(null));
  const [result, setResult] = useState(null);

  // Shuffle question order once on mount
  const questionOrder = useMemo(
    () => shuffle(Array.from({ length: QUESTIONS.length }, (_, i) => i)),
    []
  );

  useEffect(() => {
    document.title = PAGE_TITLE;
    if (searchParams.get("variant") !== variant) {
      setSearchParams({ variant }, { replace: true });
    }
  }, [variant, searchParams, setSearchParams]);

  // Scroll to top on phase/question change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase, currentQ]);

  function handleEmailComplete(capturedEmail) {
    setEmail(capturedEmail);
    setPhase("quiz");
  }

  function handleAnswer(style) {
    const questionIdx = questionOrder[currentQ];
    const newAnswers = [...answers];
    newAnswers[questionIdx] = style;
    setAnswers(newAnswers);

    // Auto-advance after brief delay
    setTimeout(() => {
      if (currentQ < QUESTIONS.length - 1) {
        setCurrentQ(currentQ + 1);
      } else {
        // Quiz complete — compute result
        const computed = computeResult(newAnswers);
        setResult(computed);
        setPhase("results");

        // Update Klaviyo profile with result via Client API (works without cookie consent)
        if (email) {
          updateKlaviyoProfile(email, {
            [RESULT_PROPERTY_NAME]: computed.primary,
          });
        }

        const quizCompletedProps = {
          landing_page: CAMPAIGN_SLUG,
          variant,
          campaign: CAMPAIGN_NAME,
          result: computed.primary,
          ...computed.percentages,
        };
        // RudderStack — fires regardless of cookie consent
        ensureRudderStackSDK();
        window.rudderanalytics.ready(function () {
          window.rudderanalytics.track("Quiz Completed", quizCompletedProps);
        });
        window.fbq?.("track", "CompleteRegistration", { content_name: computed.primary });
        window.__quizCompleted = quizCompletedProps;
      }
    }, 400);
  }

  function handleBack() {
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1);
    } else {
      setPhase("gate");
    }
  }

  return (
    <div className="font-body selection:bg-surface-container selection:text-primary min-h-dvh overflow-x-hidden bg-primary">
      <main className="min-h-dvh flex flex-col">
        {/* Global logo — visible during quiz phase */}
        {phase === "quiz" && (
          <div className="px-6 md:px-12 lg:px-20 pt-8">
            <img src={BRAND_LOGO} alt="Logo" className="h-10 md:h-12 w-auto" />
          </div>
        )}

        <div className={`flex-1 flex ${phase === "gate" ? "items-start" : "items-center justify-center"} px-6 md:px-12 lg:px-20 py-10 md:py-16`}>
          {phase === "gate" && (
            <EmailGate variant={variant} onComplete={handleEmailComplete} />
          )}

          {phase === "quiz" && (
            <QuizQuestion
              question={QUESTIONS[questionOrder[currentQ]]}
              questionIndex={currentQ}
              totalQuestions={QUESTIONS.length}
              onAnswer={handleAnswer}
              onBack={handleBack}
              selectedAnswer={answers[questionOrder[currentQ]]}
            />
          )}

          {phase === "results" && result && (
            <ResultsPage result={result} />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-center gap-6 py-6">
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-[10px] uppercase tracking-widest text-surface-container/30 hover:text-surface-container/60 transition-colors"
          >
            Terms &amp; Conditions
          </a>
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-[10px] uppercase tracking-widest text-surface-container/30 hover:text-surface-container/60 transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href={COOKIE_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-[10px] uppercase tracking-widest text-surface-container/30 hover:text-surface-container/60 transition-colors"
          >
            Cookie Policy
          </a>
        </div>
      </main>
    </div>
  );
}
