/**
 * Scoring Logic — Quiz Template
 *
 * Customize `computeResult` for your quiz's scoring rules.
 * The default implementation counts occurrences of each style
 * and picks the most frequent as the primary result.
 */

export function computeResult(answers) {
  // Count occurrences of each style
  const counts = {};
  for (const style of answers) {
    if (style) {
      counts[style] = (counts[style] || 0) + 1;
    }
  }

  const total = answers.filter(Boolean).length || 1;

  // Calculate percentages
  const percentages = {};
  for (const [key, count] of Object.entries(counts)) {
    percentages[key] = Math.round((count / total) * 100);
  }

  // Primary = highest count (first alphabetically if tied)
  const primary = Object.entries(counts)
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    [0]?.[0] || "unknown";

  return { primary, counts, percentages };
}

/**
 * Fisher-Yates shuffle — returns a new shuffled array.
 */
export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
