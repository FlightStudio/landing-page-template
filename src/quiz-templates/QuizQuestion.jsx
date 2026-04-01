import { useState } from "react";

export default function QuizQuestion({
  question,
  questionIndex,
  totalQuestions,
  onAnswer,
  onBack,
  selectedAnswer,
}) {
  const [animating, setAnimating] = useState(null);
  const progress = ((questionIndex + 1) / totalQuestions) * 100;

  function handleSelect(option) {
    if (animating) return;
    setAnimating(option.style);
    onAnswer(option.style);
    setTimeout(() => setAnimating(null), 300);
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 font-body text-sm text-surface-container/60 hover:text-surface-container transition-colors mb-6"
      >
        <span className="text-lg leading-none">&larr;</span> Back
      </button>

      {/* Progress */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1" />
        <span className="font-body text-sm text-surface-container/50">
          {questionIndex + 1} / {totalQuestions}
        </span>
      </div>

      <div className="w-full h-1 bg-surface-container/10 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-surface-container rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question label */}
      <p className="font-label text-xs uppercase tracking-[0.2em] text-surface-container/50 mb-3">
        Question {String(questionIndex + 1).padStart(2, "0")}
      </p>

      {/* Question text */}
      <h2 className="font-headline text-2xl md:text-4xl font-bold text-surface-container leading-tight mb-8">
        {question.question}
      </h2>

      {/* Answer cards */}
      <div className="space-y-4">
        {question.options.map((option) => {
          const isSelected = selectedAnswer === option.style;
          const isAnimatingThis = animating === option.style;

          return (
            <button
              key={option.label}
              onClick={() => handleSelect(option)}
              className={`w-full text-left bg-white rounded-xl p-5 border-2 transition-all duration-200 ${
                isSelected || isAnimatingThis
                  ? "border-surface-container bg-surface-container/5 scale-[0.98]"
                  : "border-transparent hover:border-surface-container/20 hover:shadow-md"
              }`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-md border-2 flex items-center justify-center font-label text-xs font-bold transition-colors ${
                    isSelected || isAnimatingThis
                      ? "border-surface-container bg-surface-container text-primary"
                      : "border-surface-container/20 text-surface-container/40"
                  }`}
                >
                  {option.label}
                </span>
                <span className="font-body text-sm md:text-base text-surface-container leading-relaxed pt-1">
                  {option.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
