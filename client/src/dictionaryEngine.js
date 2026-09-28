const DICTIONARY_PATTERNS = [
  /^(?:(?:what(?:'s| is)\s+)?(?:the\s+)?(?:meaning|definition)\s+of\s+|define\s+)(.+?)(?:\s+in\s+(?:hindi|english))?[?.!]*$/i,
  /^what\s+does\s+(.+?)\s+mean(?:\s+in\s+(?:hindi|english))?[?.!]*$/i,
  /^(.+?)\s+(?:meaning|definition)\s+(?:kya\s+hai|batao|bataiye)[?.!]*$/i,
  /^(.+?)\s+(?:ka|ki|ke)\s+(?:matlab|meaning|arth)(?:\s+(?:kya\s+(?:hai|hota\s+hai)|batao|bataiye|samjhao))?[?.!]*$/i,
  /^(.+?)\s+का\s+(?:मतलब|अर्थ)(?:\s+(?:क्या\s+(?:है|होता\s+है)|बताओ|बताइए|समझाओ))?[?.!]*$/u,
];

export function parseDictionaryQuestion(input) {
  const phrase = String(input || "").trim();
  for (const pattern of DICTIONARY_PATTERNS) {
    const match = phrase.match(pattern);
    if (!match) continue;

    const word = (match[1] || "")
      .replace(/^(?:the\s+)?(?:word\s+)?/i, "")
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
      .replace(/[?.!,;:]+$/g, "")
      .trim();

    if (word && word.length <= 80) return word;
  }
  return null;
}
