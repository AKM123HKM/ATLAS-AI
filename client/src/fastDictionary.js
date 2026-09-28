const CACHE_PREFIX = "atlas-dictionary-v1:";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function readCachedResult(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.result;
    localStorage.removeItem(key);
  } catch {
    // Continue with the live lookup if browser storage is unavailable.
  }
  return null;
}

function saveCachedResult(key, result) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), result }));
  } catch {
    // The lookup still succeeds when storage is full or disabled.
  }
}

async function translateText(text, source, target, signal) {
  const params = new URLSearchParams({
    q: text.slice(0, 450),
    langpair: `${source}|${target}`,
  });
  const response = await fetch(
    `https://api.mymemory.translated.net/get?${params.toString()}`,
    { signal },
  );
  if (!response.ok) return "";
  const data = await response.json();
  if (data.responseStatus && data.responseStatus !== 200) return "";
  return String(data.responseData?.translatedText || "").trim();
}

export async function lookupFastDictionary(word, language, signal) {
  const cacheKey = `${CACHE_PREFIX}${language}:${word.toLocaleLowerCase()}`;
  const cached = readCachedResult(cacheKey);
  if (cached) return cached;

  let lookupWord = word;
  if (/[\u0900-\u097F]/.test(word)) {
    lookupWord = await translateText(word, "hi", "en", signal);
    if (!lookupWord) return null;
  }

  const params = new URLSearchParams({ sp: lookupWord, md: "d", max: "5" });
  const response = await fetch(
    `https://api.datamuse.com/words?${params.toString()}`,
    { signal },
  );
  if (!response.ok) return null;

  const matches = await response.json();
  const exactMatch = matches.find(
    (item) => item.word?.toLocaleLowerCase() === lookupWord.toLocaleLowerCase(),
  );
  const definitions = (exactMatch?.defs || [])
    .map((definition) => definition.replace(/^[a-z]+\t/i, "").trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!definitions.length) return null;

  let finalDefinitions = definitions;
  if (language === "hi") {
    finalDefinitions = await Promise.all(
      definitions.map((definition) => translateText(definition, "en", "hi", signal)),
    );
    if (finalDefinitions.some((definition) => !definition)) return null;
  }

  const result = {
    title: word,
    answer: finalDefinitions.map((definition, index) => `${index + 1}. ${definition}`).join(" "),
    paragraphs: finalDefinitions,
    keyFacts: [],
    relatedLinks: [],
    imageQuery: "",
    imageUrl: "",
    modelUsed: "FAST DICTIONARY API",
    language,
  };
  saveCachedResult(cacheKey, result);
  return result;
}
