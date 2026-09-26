// ============================================================
// A.T.L.A.S 3K — NEWS ENGINE
// Dedicated live-news client
//
// Voice/UI
//   ↓
// newsEngine.js
//   ↓
// /api/news
//   ↓
// A.T.L.A.S Express Backend
//   ↓
// Google News RSS
//
// IMPORTANT:
// This file does NOT call the LLM.
// ============================================================


// ------------------------------------------------------------
// BACKEND CONFIGURATION
// ------------------------------------------------------------

// If VITE_ATLAS_API_URL exists, use it.
//
// Otherwise use the deployed A.T.L.A.S backend.
//
// This prevents the browser from incorrectly requesting:
//
//     localhost:5173/api/news
//
// which is the Vite frontend server.
//
// Instead it requests:
//
//     https://atlas-ai-1wd9.onrender.com/api/news
// ------------------------------------------------------------

const API_BASE =
  (
    typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_ATLAS_API_URL
  ) ||
  "https://atlas-ai-1wd9.onrender.com";


// Remove a trailing slash if the environment variable
// contains one.
const NORMALIZED_API_BASE =
  String(API_BASE).replace(/\/+$/, "");


const NEWS_ENDPOINT =
  `${NORMALIZED_API_BASE}/api/news`;


// ------------------------------------------------------------
// CATEGORY ALIASES
// ------------------------------------------------------------

const CATEGORY_ALIASES = {
  technology: "technology",
  tech: "technology",

  science: "science",

  business: "business",
  finance: "business",
  financial: "business",

  sports: "sports",
  sport: "sports",

  entertainment: "entertainment",
  movies: "entertainment",
  movie: "entertainment",

  health: "health",
  medical: "health",

  politics: "politics",
  political: "politics",

  world: "world",
  international: "world",

  india: "india",
  indian: "india",
};


// ------------------------------------------------------------
// WORDS THAT SHOULD NOT BECOME SEARCH TERMS
// ------------------------------------------------------------

const STOP_WORDS = new Set([
  "atlas",
  "hey",
  "hello",
  "hi",

  "show",
  "give",
  "tell",
  "get",
  "fetch",

  "me",
  "the",

  "latest",
  "recent",
  "current",

  "today",
  "todays",
  "today's",

  "breaking",

  "news",
  "headlines",
  "headline",

  "updates",
  "update",

  "what",
  "is",
  "are",
  "whats",
  "what's",

  "happening",

  "right",
  "now",

  "in",
  "from",
  "about",
  "on",
  "for",
  "of",
  "with",

  "please",
  "can",
  "you",

  "some",
  "top",
  "stories",

  "latest",

  "news",
]);


// ------------------------------------------------------------
// NORMALIZE USER INPUT
// ------------------------------------------------------------

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// ------------------------------------------------------------
// DETECT NEWS QUESTION
// ------------------------------------------------------------

export function isNewsQuestion(input) {
  const q = normalize(input);

  if (!q) {
    return false;
  }

  return (
    /\bnews\b/.test(q) ||
    /\bheadlines?\b/.test(q) ||
    /\bbreaking\b/.test(q) ||
    /\blatest\b/.test(q) ||
    /\brecent\b/.test(q) ||
    /\bcurrent\b/.test(q) ||
    /\btoday\b/.test(q) ||
    /\bupdates?\b/.test(q) ||
    /\bhappening now\b/.test(q)
  );
}


// ------------------------------------------------------------
// PARSE NEWS COMMAND
// ------------------------------------------------------------

export function parseNewsCommand(input) {
  const normalized = normalize(input);

  let category = "general";

  // ----------------------------------------------------------
  // Detect explicit category
  // ----------------------------------------------------------

  for (const [
    alias,
    canonical,
  ] of Object.entries(
    CATEGORY_ALIASES
  )) {
    const regex =
      new RegExp(
        `\\b${alias}\\b`
      );

    if (
      regex.test(normalized)
    ) {
      category = canonical;
      break;
    }
  }


  // ----------------------------------------------------------
  // Detect India/location-specific request
  // ----------------------------------------------------------

  const wantsIndia =
    /\b(india|indian|delhi|mumbai|bangalore|bengaluru|noida|gurgaon|gurugram)\b/
      .test(normalized);


  if (
    wantsIndia &&
    category === "general"
  ) {
    category = "india";
  }


  // ----------------------------------------------------------
  // Detect country
  // ----------------------------------------------------------

  const country =
    wantsIndia
      ? "in"
      : "us";


  // ----------------------------------------------------------
  // Build custom query
  //
  // Example:
  //
  // "latest technology news"
  //
  // becomes:
  //
  // category: technology
  // query: ""
  //
  //
  // "latest Tesla technology news"
  //
  // becomes:
  //
  // category: technology
  // query: "tesla"
  // ----------------------------------------------------------

  const words =
    normalized
      .split(" ")
      .filter(Boolean)
      .filter(
        (word) =>
          !STOP_WORDS.has(word)
      );


  let query =
    words.join(" ").trim();


  // ----------------------------------------------------------
  // Don't send a redundant query when the user only asked
  // for a category.
  // ----------------------------------------------------------

  if (
    query === category ||
    query === "general"
  ) {
    query = "";
  }


  return {
    category,
    query,
    country,
  };
}


// ------------------------------------------------------------
// FETCH LATEST NEWS
// ------------------------------------------------------------

export async function fetchLatestNews(
  input = "latest news",
  options = {}
) {
  const parsed =
    parseNewsCommand(input);


  const params =
    new URLSearchParams();


  // ----------------------------------------------------------
  // CATEGORY
  // ----------------------------------------------------------

  params.set(
    "category",
    options.category ||
      parsed.category ||
      "general"
  );


  // ----------------------------------------------------------
  // COUNTRY
  // ----------------------------------------------------------

  params.set(
    "country",
    options.country ||
      parsed.country ||
      "us"
  );


  // ----------------------------------------------------------
  // CUSTOM QUERY
  // ----------------------------------------------------------

  const customQuery =
    options.query ||
    parsed.query;


  if (
    customQuery &&
    customQuery.trim()
  ) {
    params.set(
      "q",
      customQuery.trim()
    );
  }


  // ----------------------------------------------------------
  // NUMBER OF ARTICLES
  // ----------------------------------------------------------

  params.set(
    "limit",
    String(
      options.limit || 10
    )
  );


  // ----------------------------------------------------------
  // FINAL URL
  // ----------------------------------------------------------

  const requestUrl =
    `${NEWS_ENDPOINT}?${params.toString()}`;


  console.log(
    "========================================"
  );

  console.log(
    "ATLAS NEWS ENGINE"
  );

  console.log(
    "BACKEND:",
    NORMALIZED_API_BASE
  );

  console.log(
    "ENDPOINT:",
    NEWS_ENDPOINT
  );

  console.log(
    "INPUT:",
    input
  );

  console.log(
    "PARSED REQUEST:",
    parsed
  );

  console.log(
    "REQUEST URL:",
    requestUrl
  );

  console.log(
    "========================================"
  );


  // ----------------------------------------------------------
  // REQUEST
  // ----------------------------------------------------------

  let response;

  try {
    response =
      await fetch(
        requestUrl,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },

          cache: "no-store",
        }
      );
  } catch (networkError) {
    console.error(
      "ATLAS NEWS NETWORK ERROR:",
      networkError
    );

    throw new Error(
      "Unable to connect to the A.T.L.A.S news server."
    );
  }


  // ----------------------------------------------------------
  // PARSE RESPONSE
  // ----------------------------------------------------------

  const data =
    await response
      .json()
      .catch(() => ({}));


  // ----------------------------------------------------------
  // SERVER ERROR
  // ----------------------------------------------------------

  if (!response.ok) {
    console.error(
      "ATLAS NEWS SERVER ERROR:",
      response.status,
      data
    );

    throw new Error(
      data?.error ||
        `News service returned HTTP ${response.status}.`
    );
  }


  // ----------------------------------------------------------
  // NORMALIZE ARTICLES
  // ----------------------------------------------------------

  const articles =
    Array.isArray(
      data?.articles
    )
      ? data.articles
      : [];


  // ----------------------------------------------------------
  // RETURN NORMALIZED RESULT
  // ----------------------------------------------------------

  return {
    ...data,

    articles,

    fetchedAt:
      data?.fetchedAt ||
      new Date().toISOString(),

    request: parsed,

    endpoint:
      NEWS_ENDPOINT,
  };
}


// ------------------------------------------------------------
// NEWS → SPEECH
// ------------------------------------------------------------

export function newsToSpeech(
  data
) {
  const articles =
    Array.isArray(
      data?.articles
    )
      ? data.articles
      : [];


  if (
    articles.length === 0
  ) {
    return (
      "I couldn't find any current headlines."
    );
  }


  // Speak only the first three headlines
  // so A.T.L.A.S doesn't read ten articles aloud.

  const first =
    articles.slice(0, 3);


  const headlines =
    first
      .map(
        (
          article,
          index
        ) =>
          `${index + 1}. ${
            article?.title ||
            "Untitled headline"
          }`
      )
      .join(". ");


  return (
    `Here are the latest headlines. ${headlines}`
  );
}


// ------------------------------------------------------------
// OPTIONAL HELPER
// Get a clean display name for the channel.
// ------------------------------------------------------------

export function getNewsChannelName(
  category
) {
  const names = {
    general: "WORLD",
    world: "WORLD",
    india: "INDIA",
    technology: "TECHNOLOGY",
    science: "SCIENCE",
    business: "BUSINESS",
    sports: "SPORTS",
    entertainment:
      "ENTERTAINMENT",
    health: "HEALTH",
    politics: "POLITICS",
  };


  return (
    names[
      String(
        category || "general"
      ).toLowerCase()
    ] ||
    "WORLD"
  );
}


// ------------------------------------------------------------
// OPTIONAL HELPER
// Format article publication time.
// ------------------------------------------------------------

export function formatNewsDate(
  value
) {
  if (!value) {
    return "";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }


  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}