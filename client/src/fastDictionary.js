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

export async function lookupFastDictionary(word, language, signal, intent = "meaning", secondWord = "") {
  if (intent === "synonym" || intent === "antonym") {
    const relation = intent === "synonym" ? "rel_syn" : "rel_ant";
    const params = new URLSearchParams({ [relation]: word, max: "8" });
    const response = await fetch(`https://api.datamuse.com/words?${params.toString()}`, { signal });
    if (!response.ok) return null;
    const matches = await response.json();
    let terms = matches.map((item) => item.word).filter(Boolean).slice(0, 6);
    if (!terms.length) return null;
    if (language === "hi") {
      terms = await Promise.all(terms.map((term) => translateText(term, "en", "hi", signal)));
      terms = terms.filter(Boolean);
    }
    const label = intent === "synonym" ? "Synonyms" : "Antonyms";
    const answer = `${label} of “${word}”: ${terms.join(", ")}.`;
    return { title: word, answer, paragraphs: [answer], keyFacts: [], relatedLinks: [], imageQuery: "", imageUrl: "", modelUsed: "FAST DICTIONARY API", language };
  }

  const cacheKey = `${CACHE_PREFIX}${language}:${word.toLocaleLowerCase()}`;
  const cached = intent === "meaning" ? readCachedResult(cacheKey) : null;
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

  let answer = finalDefinitions.map((definition, index) => `${index + 1}. ${definition}`).join(" ");
  if (intent === "example") {
    let sentence = `${word} can make a meaningful difference.`;
    if (language === "hi") sentence = await translateText(sentence, "en", "hi", signal);
    answer = language === "hi" ? `उदाहरण: ${sentence}` : `Example: ${sentence}`;
  } else if (intent === "difference") {
    const secondParams = new URLSearchParams({ sp: secondWord, md: "d", max: "5" });
    const secondResponse = await fetch(`https://api.datamuse.com/words?${secondParams.toString()}`, { signal });
    if (!secondResponse.ok) return null;
    const secondMatches = await secondResponse.json();
    const secondEntry = secondMatches.find((item) => item.word?.toLowerCase() === secondWord.toLowerCase());
    const secondDefinitions = (secondEntry?.defs || []).map((entry) => entry.replace(/^[a-z]+\t/i, "").trim()).filter(Boolean).slice(0, 1);
    if (!secondDefinitions.length) return null;
    let secondMeaning = secondDefinitions[0];
    if (language === "hi") secondMeaning = await translateText(secondMeaning, "en", "hi", signal);
    answer = `${word}: ${finalDefinitions[0]} ${secondWord}: ${secondMeaning}.`;
  }
  const result = {
    title: word,
    answer,
    paragraphs: [answer],
    keyFacts: [],
    relatedLinks: [],
    imageQuery: "",
    imageUrl: "",
    modelUsed: "FAST DICTIONARY API",
    language,
  };
  if (intent === "meaning") saveCachedResult(cacheKey, result);
  return result;
}
