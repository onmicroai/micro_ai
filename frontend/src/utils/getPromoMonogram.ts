const LEADING_ARTICLES = /^(a|an|the)$/i;

function firstAlphanumericChar(word: string): string {
  const match = word.match(/[a-zA-Z0-9]/);
  return match ? match[0].toUpperCase() : "";
}

/**
 * Derives a 1–2 character monogram from an app title for card headers.
 * Multi-word titles use the first and last significant word; single words use the first two letters.
 */
export function getPromoMonogram(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((word, index) => index > 0 || !LEADING_ARTICLES.test(word));

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    const letters = words[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return letters.slice(0, 2) || "?";
  }

  const first = firstAlphanumericChar(words[0]);
  const last = firstAlphanumericChar(words[words.length - 1]);
  return first + last || "?";
}
