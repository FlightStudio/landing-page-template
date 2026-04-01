/**
 * Quiz Data — Fill in for your campaign
 *
 * This file defines all quiz content: questions, results, and gate content.
 * The components read from here — no need to edit the JSX.
 */

// ── Klaviyo property name for the quiz result ────────────────────────
// This is the property key written to the Klaviyo profile after quiz completion.
// Use lowercase snake_case, e.g. "attachment_style", "love_island_match"
export const RESULT_PROPERTY_NAME = "quiz_result"; // TODO: Change this

// ── Score categories (for the bar chart on the results page) ─────────
// Each category maps to the `style` value in question options.
// Set to [] if you don't want score bars on the results page.
export const SCORE_CATEGORIES = [
  // { key: "category_a", label: "Category A" },
  // { key: "category_b", label: "Category B" },
  // { key: "category_c", label: "Category C" },
];

// ── Share text ───────────────────────────────────────────────────────
export const SHARE_TEXT = "Take the quiz and find out your result!"; // TODO

// ── Questions ────────────────────────────────────────────────────────
// Each question has a `question` string and an `options` array.
// Each option: { label: "A", text: "Answer text", style: "category_key" }
// The `style` value links to scoring and RESULTS below.
export const QUESTIONS = [
  {
    question: "Question 1 goes here?",
    options: [
      { label: "A", text: "First answer option", style: "category_a" },
      { label: "B", text: "Second answer option", style: "category_b" },
      { label: "C", text: "Third answer option", style: "category_c" },
    ],
  },
  // TODO: Add more questions
];

// ── Results ──────────────────────────────────────────────────────────
// Keyed by the primary result (the `style` value with the highest count).
// Each result can have: title, subtitle, description, traits, recommendations.
export const RESULTS = {
  category_a: {
    title: "Result A Title",
    subtitle: "A short tagline.",
    description: "A longer description of what this result means.",
    traits: [
      { label: "Strength", copy: "Description of a strength." },
      { label: "Watch out for", copy: "Something to be aware of." },
    ],
    recommendations: [
      // { title: "Episode Title", url: "https://...", description: "Optional subtitle" },
    ],
    recommendationsTitle: "Recommended for you",
  },
  // TODO: Add results for each category
};

// ── Gate content (the email capture screen before the quiz) ──────────
export const GATE_CONTENT = {
  label: "Quiz", // Small label above the headline
  // Headline can be a string or an object keyed by variant name for A/B testing
  headline: {
    // "headline-variant-a": "FIND YOUR MATCH",
    // "headline-variant-b": "WHICH ONE ARE YOU?",
  },
  body: "A short description of what the quiz is about and what you'll discover.",
  button: "Start the quiz →",
};

// ── Disclaimers ──────────────────────────────────────────────────────
export const DISCLAIMERS = {
  intro: "This quiz is just for fun. It's not a professional assessment.", // Shown on gate
  result: "Remember, this is for entertainment purposes only.", // Shown on results
};
