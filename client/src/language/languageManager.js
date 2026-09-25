import english from "./english";
import hindi from "./hindi";

// =========================================================
// A.T.L.A.S — LANGUAGE MANAGER
//
// Deliberately NOT a React Context / stateful store. Every other
// piece of shared state in this app (showMusic, showWeather,
// listening, etc.) lives in App.jsx and gets passed down as
// props — this keeps that same pattern instead of introducing a
// second, inconsistent way of managing state. App.jsx owns the
// `language` state; this file just provides pure lookup/helper
// functions that take a language code as input.
// =========================================================

export const LANGUAGES = {
  en: english,
  hi: hindi,
};

export function getLanguagePack(code) {
  return LANGUAGES[code] || LANGUAGES.en;
}

export function getSpeechLang(code) {
  return getLanguagePack(code).speechLang;
}

// -----------------------------------------------------------
// TEXT LANGUAGE DETECTION
// Used for *typed* input, where mixed Hindi/English in one
// string is genuinely easy to detect. Voice input doesn't need
// this — whichever recognizer language is active already tags
// the transcript.
// -----------------------------------------------------------

const DEVANAGARI_RANGE = /[\u0900-\u097F]/;

// Common romanized Hindi/Hinglish function words. Not
// exhaustive — good enough to catch typed Hinglish like
// "aaj weather kaisa hai" without a full NLP model.
const HINGLISH_MARKERS = [
  "kya",
  "kaisa",
  "kaise",
  "kaisi",
  "kitna",
  "kitni",
  "hai",
  "ho",
  "kar",
  "karo",
  "batao",
  "bata",
  "chalao",
  "chala",
  "bajao",
  "suna",
  "sunao",
  "mausam",
  "gaana",
  "gana",
  "aaj",
  "kal",
  "abhi",
];

export function detectTextLanguage(text) {
  if (!text) return "en";

  if (DEVANAGARI_RANGE.test(text)) {
    return "hi";
  }

  const lower = text.toLowerCase();
  const hitCount = HINGLISH_MARKERS.filter((word) =>
    new RegExp(`\\b${word}\\b`).test(lower)
  ).length;

  return hitCount >= 1 ? "hi" : "en";
}

// -----------------------------------------------------------
// WAKE WORD MATCHING
// -----------------------------------------------------------

export function matchesWakeWord(transcript, languageCode) {
  const pack = getLanguagePack(languageCode);
  const lower = (transcript || "").toLowerCase().trim();

  return pack.wakeWords.some((phrase) => lower.includes(phrase));
}

// -----------------------------------------------------------
// TEXT-TO-SPEECH VOICE SELECTION
// Not every browser/OS ships a Hindi voice. This picks the best
// available match and falls back gracefully — if no Hindi voice
// exists, the browser's default voice will still attempt to read
// the Devanagari text (quality varies by platform), rather than
// throwing or staying silent.
// -----------------------------------------------------------

export function pickVoiceForLanguage(languageCode) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return null;

  if (languageCode === "hi") {
    return (
      voices.find((v) => v.lang === "hi-IN") ||
      voices.find((v) => v.lang?.toLowerCase().startsWith("hi")) ||
      null
    );
  }

  return (
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
    null
  );
}