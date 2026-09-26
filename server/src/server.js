import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// -------------------------------------
// GEMINI CLIENT (fallback when OpenRouter fails/hits its limit)
// -------------------------------------

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// -------------------------------------
// HOME
// -------------------------------------

app.get("/", (req, res) => {
  res.json({ name: "A.T.L.A.S 3K", status: "ONLINE" });
});

// -------------------------------------
// IMAGE FETCH (Wikimedia Commons — free, no API key)
// -------------------------------------

async function fetchImageUrl(query) {
  if (!query || !query.trim()) return "";

  try {
    const searchUrl =
      "https://commons.wikimedia.org/w/api.php" +
      "?action=query&format=json&origin=*&generator=search" +
      `&gsrsearch=${encodeURIComponent(query + " -logo -icon -flag")}` +
      "&gsrlimit=5&gsrnamespace=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=1200";

    const response = await fetch(searchUrl);
    if (!response.ok) return "";

    const data = await response.json();
    const pages = data?.query?.pages;

    if (!pages) return "";

    const candidates = Object.values(pages)
      .map((p) => p.imageinfo?.[0])
      .filter(Boolean)
      .filter((info) =>
        ["image/jpeg", "image/png"].includes(info.mime)
      );

    const chosen = candidates[0];

    return chosen ? chosen.thumburl || chosen.url || "" : "";
  } catch (error) {
    console.error("IMAGE FETCH ERROR:", error);
    return "";
  }
}

// -------------------------------------
// LIVE NEWS FETCH (Google News RSS — free, no API key)
// -------------------------------------

const NEWS_TRIGGER_WORDS = [
  "latest",
  "news",
  "recent",
  "recently",
  "today",
  "this week",
  "this month",
  "current",
  "currently",
  "update",
  "breaking",
  "happening now",
];

function isNewsQuery(question) {
  const q = question.toLowerCase();

  return NEWS_TRIGGER_WORDS.some((word) =>
    q.includes(word)
  );
}

async function fetchNewsHeadlines(question) {
  try {
    const url =
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(question) +
      "&hl=en-US&gl=US&ceid=US:en";

    const response = await fetch(url);

    if (!response.ok) return [];

    const xml = await response.text();

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(
      0,
      6
    );

    return items
      .map((match) => {
        const block = match[1];

        const titleMatch = block.match(
          /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/
        );

        const pubDateMatch = block.match(
          /<pubDate>(.*?)<\/pubDate>/
        );

        const sourceMatch = block.match(
          /<source[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/source>/
        );

        return {
          title: titleMatch
            ? titleMatch[1].trim()
            : "",

          pubDate: pubDateMatch
            ? pubDateMatch[1].trim()
            : "",

          source: sourceMatch
            ? sourceMatch[1].trim()
            : "",
        };
      })
      .filter((item) => item.title);
  } catch (error) {
    console.error("NEWS FETCH ERROR:", error);
    return [];
  }
}

// -------------------------------------
// MUSIC SEARCH (YouTube Data API — key stays server-side)
// -------------------------------------

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

app.get("/api/music/search", async (req, res) => {
  try {
    const q = req.query.q;

    if (!q || !q.trim()) {
      return res
        .status(400)
        .json({ error: "No search query provided" });
    }

    if (!YOUTUBE_API_KEY) {
      return res.status(503).json({
        error:
          "Online music search is not configured on the server.",
      });
    }

    const searchUrl =
      "https://www.googleapis.com/youtube/v3/search" +
      "?part=snippet&type=video&videoCategoryId=10&maxResults=8" +
      `&q=${encodeURIComponent(q)}` +
      `&key=${YOUTUBE_API_KEY}`;

    const ytRes = await fetch(searchUrl);
    const ytData = await ytRes.json();

    if (!ytRes.ok) {
      console.error("YOUTUBE SEARCH ERROR:", ytData);

      return res
        .status(502)
        .json({ error: "YouTube search failed" });
    }

    const results = (ytData.items || [])
      .filter((item) => item?.id?.videoId)
      .map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail:
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url ||
          "",
      }));

    res.json({ results });
  } catch (error) {
    console.error("MUSIC SEARCH ERROR:", error);

    res
      .status(500)
      .json({ error: "Music search failed" });
  }
});

// =====================================================================
// AI PROVIDER FAILOVER CHAIN
//
//   OPENROUTER (own model-list fallback inside it)
//     ├─ 404 → next model
//     ├─ 429 → next model
//     ├─ 5xx → next model
//     └─ timeout → next model
//   → GEMINI
//     ├─ timeout → continue
//     └─ error → continue
//   → GROQ (optional — only runs if GROQ_API_KEY is set)
//     ├─ timeout → continue
//     └─ error → continue
//   → controlled 503
//
// Every provider call goes through fetchWithTimeout() (raw fetch
// calls) or withTimeout() (SDK calls that don't take an
// AbortSignal), so nothing can hang the whole chain waiting on a
// single slow provider.
// =====================================================================

// -------------------------------------
// PROVIDER CONFIG (env-driven, no code changes needed to retune)
// -------------------------------------

const OPENROUTER_MODELS = (
  process.env.OPENROUTER_MODELS || "openrouter/free"
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

// How long a single provider attempt gets before we give up on it
// and move to the next one in the chain.
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 20000);

const GROQ_API_KEY = process.env.GROQ_API_KEY || null;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

// -------------------------------------
// SHARED ERROR TYPE + STATUS CLASSIFICATION
// -------------------------------------

class ProviderError extends Error {
  constructor(message, { status, code, provider, model } = {}) {
    super(message);
    this.name = "ProviderError";
    this.status = status ?? null;
    this.code = code ?? null;
    this.provider = provider ?? null;
    this.model = model ?? null;
  }
}

function classifyStatus(status) {
  if (status === 404) return "MODEL_UNAVAILABLE";
  if (status === 408) return "REQUEST_TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500 && status < 600) return "PROVIDER_ERROR";
  if (status >= 400) return "CLIENT_ERROR";
  return "UNKNOWN";
}

// -------------------------------------
// TIMEOUT HELPERS
// -------------------------------------

// For raw fetch() calls (OpenRouter, Groq) — real cancellation via
// AbortController, so a slow provider's socket is actually closed
// instead of just being ignored.
async function fetchWithTimeout(url, options, timeoutMs, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ProviderError(`${label} timed out after ${timeoutMs}ms`, {
        code: "TIMEOUT",
      });
    }

    // Covers DNS failures, ECONNRESET, "fetch failed", etc.
    throw new ProviderError(`${label} network error: ${error.message}`, {
      code: "NETWORK_ERROR",
    });
  } finally {
    clearTimeout(timer);
  }
}

// For SDK calls that don't expose an AbortSignal (Gemini's SDK) —
// a race against a timer. This doesn't cancel the underlying
// request, but it does stop ATLAS from waiting on it forever and
// lets the chain move on to the next provider.
function withTimeout(promise, timeoutMs, label) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new ProviderError(`${label} timed out after ${timeoutMs}ms`, {
          code: "TIMEOUT",
        })
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// -------------------------------------
// LLM CALL (OpenRouter — with model-list fallback + full status handling)
// -------------------------------------

async function callOpenRouter(systemPrompt, question) {
  let lastError = null;

  for (const model of OPENROUTER_MODELS) {
    try {
      const response = await fetchWithTimeout(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: question },
            ],
            max_tokens: 1800,
          }),
        },
        AI_TIMEOUT_MS,
        `OpenRouter (${model})`
      );

      if (!response.ok) {
        let data = null;

        try {
          data = await response.json();
        } catch {
          // Body wasn't JSON (common on 404/5xx from upstream
          // proxies) — we still have response.status to classify.
        }

        const reason = classifyStatus(response.status);

        console.error(
          `OPENROUTER ERROR (${model}) [${response.status} → ${reason}]:`,
          data || response.statusText
        );

        lastError = new ProviderError(
          data?.error?.message || `OpenRouter ${model} failed`,
          {
            status: response.status,
            code: reason,
            provider: "openrouter",
            model,
          }
        );

        // 404 (model gone), 429 (rate limited), 5xx (provider
        // trouble), or any other 4xx — all of these mean "try the
        // next candidate model", not "kill the whole chain".
        continue;
      }

      const data = await response.json();

      const rawContent = data?.choices?.[0]?.message?.content;
      const finishReason = data?.choices?.[0]?.finish_reason;

      if (!rawContent) {
        lastError = new ProviderError(
          `OpenRouter ${model} returned an empty response`,
          { code: "EMPTY_RESPONSE", provider: "openrouter", model }
        );

        continue;
      }

      return {
        rawContent,
        modelUsed: model,
        providerUsed: "openrouter",
        finishReason,
      };
    } catch (error) {
      // fetchWithTimeout already wraps timeouts/network errors as
      // ProviderError; anything else gets wrapped here too so the
      // chain always deals with a consistent error shape.
      const providerError =
        error instanceof ProviderError
          ? error
          : new ProviderError(error.message, {
              code: "NETWORK_ERROR",
              provider: "openrouter",
              model,
            });

      console.error(
        `OPENROUTER FETCH FAILED (${model}) [${providerError.code}]:`,
        providerError.message
      );

      lastError = providerError;
      continue;
    }
  }

  throw (
    lastError ||
    new ProviderError("All OpenRouter models failed", {
      provider: "openrouter",
    })
  );
}

// -------------------------------------
// LLM CALL (Gemini — fallback when OpenRouter fails entirely)
// -------------------------------------

async function callGemini(systemPrompt, question) {
  if (!genAI) {
    throw new ProviderError("Gemini not configured", {
      code: "NOT_CONFIGURED",
      provider: "gemini",
    });
  }

  try {
    const response = await withTimeout(
      genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: question,
        config: { systemInstruction: systemPrompt },
      }),
      AI_TIMEOUT_MS,
      "Gemini"
    );

    const rawContent = response.text;

    if (!rawContent) {
      throw new ProviderError("Empty Gemini response", {
        code: "EMPTY_RESPONSE",
        provider: "gemini",
      });
    }

    return {
      rawContent,
      modelUsed: "gemini-2.5-flash",
      providerUsed: "gemini",
      finishReason: "stop",
    };
  } catch (error) {
    if (error instanceof ProviderError) throw error;

    // The Gemini SDK throws its own error shapes on 4xx/5xx from
    // Google's API; pull a status out if one is present so this
    // still gets classified consistently with the fetch-based
    // providers instead of just being a generic "PROVIDER_ERROR".
    const status = error?.status || error?.response?.status || null;
    const reason = status ? classifyStatus(status) : "PROVIDER_ERROR";

    console.error(`GEMINI ERROR [${reason}]:`, error.message);

    throw new ProviderError(error.message, {
      status,
      code: reason,
      provider: "gemini",
    });
  }
}

// -------------------------------------
// LLM CALL (Groq — optional third fallback, OpenAI-compatible API)
//
// Entirely opt-in: with no GROQ_API_KEY set, this throws a
// NOT_CONFIGURED ProviderError immediately (no network call at
// all), which the handler below treats the same as any other
// provider failure and moves on from — so leaving Groq unset is
// completely safe and adds no latency.
// -------------------------------------

async function callGroq(systemPrompt, question) {
  if (!GROQ_API_KEY) {
    throw new ProviderError("Groq not configured", {
      code: "NOT_CONFIGURED",
      provider: "groq",
    });
  }

  let response;

  try {
    response = await fetchWithTimeout(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question },
          ],
          max_tokens: 1800,
        }),
      },
      AI_TIMEOUT_MS,
      `Groq (${GROQ_MODEL})`
    );
  } catch (error) {
    const providerError =
      error instanceof ProviderError
        ? error
        : new ProviderError(error.message, {
            code: "NETWORK_ERROR",
            provider: "groq",
            model: GROQ_MODEL,
          });

    console.error(
      `GROQ FETCH FAILED (${GROQ_MODEL}) [${providerError.code}]:`,
      providerError.message
    );

    throw providerError;
  }

  if (!response.ok) {
    let data = null;

    try {
      data = await response.json();
    } catch {
      // non-JSON error body — fall back to status classification
    }

    const reason = classifyStatus(response.status);

    console.error(
      `GROQ ERROR (${GROQ_MODEL}) [${response.status} → ${reason}]:`,
      data || response.statusText
    );

    throw new ProviderError(
      data?.error?.message || `Groq ${GROQ_MODEL} failed`,
      { status: response.status, code: reason, provider: "groq", model: GROQ_MODEL }
    );
  }

  const data = await response.json();

  const rawContent = data?.choices?.[0]?.message?.content;
  const finishReason = data?.choices?.[0]?.finish_reason;

  if (!rawContent) {
    throw new ProviderError(`Groq ${GROQ_MODEL} returned an empty response`, {
      code: "EMPTY_RESPONSE",
      provider: "groq",
      model: GROQ_MODEL,
    });
  }

  return {
    rawContent,
    modelUsed: GROQ_MODEL,
    providerUsed: "groq",
    finishReason,
  };
}

// -------------------------------------
// PLAIN-TEXT RESPONSE FORMAT
// -------------------------------------

const RESPONSE_TEMPLATE = `
Respond in EXACTLY this plain-text format. Do not use JSON. Do not
use markdown symbols like ** or #. Use plain sentences only.

TITLE: <a short title for the topic>

ANSWER:
<paragraph 1>

<paragraph 2>

<paragraph 3 (add a 4th or 5th only if genuinely needed)>

FACTS:
- <short fact 1>
- <short fact 2>
- <short fact 3>

LINKS:
- <site name> | <full URL> | <one-line description>

IMAGE: <2-4 words describing the main visual subject, plain noun phrase>

Rules:
- Keep the ANSWER section to 3-5 paragraphs, each adding new
  information — no filler.
- FACTS and LINKS are optional — write "FACTS:" and "LINKS:" with
  nothing under them if none apply.
- Only include links to well-known reliable sites
  (Wikipedia, NASA, Britannica, official gov/org sites).
- Never guess a URL you're not sure exists — omit it instead.
- IMAGE should be a plain noun phrase, not a URL.
- Write ANSWER and everything else only ONCE.
- For mathematical questions, perform the calculation yourself
  and explain the result clearly.
`;

// -------------------------------------
// LANGUAGE + PERSONAL/EMOTIONAL HANDLING
// Appended onto the main system prompt below, inside the actual
// request handler where `req`/`question` exist.
// -------------------------------------

function buildLanguageInstruction(language) {
  return language === "hi"
    ? "Respond in Hindi (Devanagari script), in a natural, conversational tone."
    : "Respond in English.";
}

const EMOTIONAL_SUPPORT_INSTRUCTION = `
Most questions are ordinary — answer them directly and helpfully. Some
questions will be personal or emotional (breakups, stress, loneliness,
exhaustion, sadness). For those:

- Respond with genuine warmth and empathy, not a clinical or robotic tone.
- Keep it brief and practical for the first 2-3 sentences — your response
  will be partially read aloud, so front-load the most important,
  reassuring part first. Longer detail after that is fine; it will be
  shown on screen even if not fully spoken.
- Offer grounded, practical suggestions where appropriate (talking to
  someone they trust, taking a break, small concrete next steps) — not
  generic platitudes.
- Gently encourage talking to a trusted person, family member, or
  counsellor for anything ongoing or serious. Don't diagnose or claim to
  replace professional help.
- If the message contains ANY signal of self-harm, suicidal thoughts, or
  immediate danger to the person or someone else, your first priority is
  their safety, not being polite. Respond with care, take it seriously,
  and clearly provide these India-based resources in your reply:
    - Tele-MANAS (India's national mental health helpline): 14416, or
      1-800-891-4416 — free, 24/7, multiple languages.
    - In immediate danger: 112 (India's unified emergency number).
  Encourage them to reach out to one of these right now, or to a trusted
  person nearby. Do not just mention resources in passing — make sure
  they are clearly visible in the response, not buried.
- Never be dismissive, never joke about self-harm or suicide, and never
  try to diagnose a mental health condition.
`;

// -------------------------------------
// PARSE ATLAS RESPONSE
// -------------------------------------

function parseAtlasResponse(rawContent, wasTruncated) {
  const text = rawContent.trim();

  const getSection = (label, nextLabels) => {
    const startMatch = text.match(
      new RegExp(`${label}:\\s*`, "i")
    );

    if (!startMatch) return "";

    const startIndex =
      startMatch.index + startMatch[0].length;

    let endIndex = text.length;

    for (const next of nextLabels) {
      const nextMatch = text
        .slice(startIndex)
        .match(
          new RegExp(`\\n\\s*${next}:`, "i")
        );

      if (nextMatch) {
        endIndex = Math.min(
          endIndex,
          startIndex + nextMatch.index
        );
      }
    }

    return text
      .slice(startIndex, endIndex)
      .trim();
  };

  const ALL_LABELS = [
    "TITLE",
    "ANSWER",
    "FACTS",
    "LINKS",
    "IMAGE",
  ];

  const title = getSection(
    "TITLE",
    ALL_LABELS.filter((l) => l !== "TITLE")
  );

  let answerBlock = getSection(
    "ANSWER",
    ["FACTS", "LINKS", "IMAGE"]
  );

  const factsBlock = getSection(
    "FACTS",
    ["LINKS", "IMAGE"]
  );

  const linksBlock = getSection(
    "LINKS",
    ["IMAGE"]
  );

  const imageQuery = getSection(
    "IMAGE",
    []
  )
    .split("\n")[0]
    .trim();

  let paragraphs = answerBlock
    .split(/\n\s*\n/)
    .map((p) =>
      p.replace(/\s+/g, " ").trim()
    )
    .filter(Boolean);

  if (wasTruncated && paragraphs.length > 1) {
    const last =
      paragraphs[paragraphs.length - 1];

    const endsCleanly =
      /[.!?]["')]?$/.test(last.trim());

    if (!endsCleanly) {
      paragraphs = paragraphs.slice(0, -1);
    }
  }

  const answer = paragraphs.join("\n\n");

  const keyFacts = factsBlock
    .split("\n")
    .map((line) =>
      line.replace(/^-\s*/, "").trim()
    )
    .filter(Boolean);

  const relatedLinks = linksBlock
    .split("\n")
    .map((line) =>
      line.replace(/^-\s*/, "").trim()
    )
    .map((line) => {
      const parts = line
        .split("|")
        .map((p) => p.trim());

      if (parts.length < 2) return null;

      return {
        title: parts[0],
        url: parts[1],
        description: parts[2] || "",
      };
    })
    .filter(
      (link) =>
        link &&
        /^https?:\/\//.test(link.url)
    );

  if (paragraphs.length === 0) {
    // FIX: previously this just gave up with a generic "couldn't
    // answer" message and no visibility into why. Two changes:
    //
    // 1. Log the raw model output whenever this path fires, so a
    //    one-off formatting miss is actually diagnosable from
    //    terminal logs next time, instead of leaving you with
    //    nothing to go on (which is exactly what happened here).
    //
    // 2. Degrade gracefully instead of failing outright: if the
    //    model returned real, substantial text that just didn't
    //    match the strict TITLE/ANSWER/FACTS/LINKS/IMAGE format
    //    (common on free/rate-limited models — markdown instead
    //    of plain text, a missing label, a truncated response),
    //    show that raw text as the answer rather than discarding
    //    a perfectly good response. Only fall back to the "try
    //    again" message when there's truly nothing usable.

    console.error(
      "PARSE FAILURE — model output didn't match expected format. Raw content was:\n" +
        "----------------------------------------\n" +
        rawContent +
        "\n----------------------------------------"
    );

    const fallbackText = rawContent
      .replace(/```/g, "")
      .trim();

    const hasUsableText = fallbackText.length >= 20;

    return {
      title: title || "ATLAS Intelligence Report",

      answer: hasUsableText
        ? fallbackText
        : "I wasn't able to put together a complete answer that time. Please try asking again.",

      paragraphs: hasUsableText
        ? fallbackText
            .split(/\n\s*\n/)
            .map((p) => p.replace(/\s+/g, " ").trim())
            .filter(Boolean)
        : [
            "I wasn't able to put together a complete answer that time. Please try asking again.",
          ],

      keyFacts: [],
      relatedLinks: [],
      imageQuery: "",
    };
  }

  return {
    title:
      title || "ATLAS Intelligence Report",

    answer,
    paragraphs,
    keyFacts,
    relatedLinks,
    imageQuery,
  };
}

// -------------------------------------
// ASK ATLAS
// -------------------------------------

app.post("/api/ask", async (req, res) => {
  try {
    const { question, language } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        error: "No question provided",
      });
    }

    // -------------------------------------
    // LIVE NEWS FETCH
    // -------------------------------------

    let newsContext = "";
    let usedLiveNews = false;

    if (isNewsQuery(question)) {
      const headlines =
        await fetchNewsHeadlines(question);

      if (headlines.length > 0) {
        usedLiveNews = true;

        newsContext =
          "\n\nCURRENT HEADLINES (real, fetched just now — treat these as ground truth, ignore any conflicting internal knowledge):\n" +
          headlines
            .map(
              (h, i) =>
                `${i + 1}. "${h.title}" — ${
                  h.source || "unknown source"
                } (${
                  h.pubDate || "date unknown"
                })`
            )
            .join("\n");
      }
    }

    // -------------------------------------
    // BUILD SYSTEM PROMPT
    // (this is the ONE place req/question are actually in
    // scope — language + emotional-support instructions are
    // appended here, not at module top-level)
    // -------------------------------------

    const languageInstruction = buildLanguageInstruction(language);

    const systemPrompt = `
You are A.T.L.A.S 3K.

A.T.L.A.S stands for:
Advanced Technology and Learning Assistant System.

You are a futuristic educational AI assistant being demonstrated
at a student science and technology exhibition.

The user is looking at a visual knowledge screen while you speak
your answer aloud.

You handle:
- General questions
- Science
- Mathematics
- History
- Technology
- Programming
- Logic
- Problem solving
- Current events
- Educational explanations
- Personal or emotional questions, handled with care (see below)

${
  usedLiveNews
    ? `This question is about current events. You have been given real, freshly-fetched headlines below. Base your answer primarily on those headlines and reference source/date inline. Do NOT rely on older internal knowledge if it conflicts with the headlines.`
    : `Answer from your general knowledge. For mathematical and logical questions, work through the problem carefully and provide the correct result.`
}

PERSONALITY:
Intelligent, calm, helpful, slightly futuristic,
confident, educational.

Do not say you are a language model.

Do not invent facts, sources, or URLs.

${languageInstruction}

${EMOTIONAL_SUPPORT_INSTRUCTION}

${RESPONSE_TEMPLATE}

User question:
${question}

${newsContext}
`;

    // -------------------------------------
    // LLM CALL — OpenRouter → Gemini → Groq → controlled 503
    // -------------------------------------

    let rawContent;
    let modelUsed;
    let providerUsed;
    let finishReason;

    const providerErrors = [];

    try {
      ({ rawContent, modelUsed, providerUsed, finishReason } =
        await callOpenRouter(systemPrompt, question));
    } catch (openRouterErr) {
      console.error(
        `OPENROUTER CHAIN FAILED [${openRouterErr.code}], TRYING GEMINI:`,
        openRouterErr.message
      );

      providerErrors.push({
        provider: "openrouter",
        code: openRouterErr.code,
        message: openRouterErr.message,
      });

      try {
        ({ rawContent, modelUsed, providerUsed, finishReason } =
          await callGemini(systemPrompt, question));
      } catch (geminiErr) {
        console.error(
          `GEMINI ALSO FAILED [${geminiErr.code}], TRYING GROQ:`,
          geminiErr.message
        );

        providerErrors.push({
          provider: "gemini",
          code: geminiErr.code,
          message: geminiErr.message,
        });

        try {
          ({ rawContent, modelUsed, providerUsed, finishReason } =
            await callGroq(systemPrompt, question));
        } catch (groqErr) {
          // groqErr.code === "NOT_CONFIGURED" just means no
          // GROQ_API_KEY was set — logged the same as any other
          // provider failure, nothing breaks either way.
          console.error(
            `GROQ ALSO FAILED [${groqErr.code}]:`,
            groqErr.message
          );

          providerErrors.push({
            provider: "groq",
            code: groqErr.code,
            message: groqErr.message,
          });

          return res.status(503).json({
            error:
              "All configured AI providers are currently unavailable. Please try again shortly.",
            providers: providerErrors,
          });
        }
      }
    }

    const wasTruncated =
      finishReason === "length";

    const parsed =
      parseAtlasResponse(
        rawContent,
        wasTruncated
      );

    const imageUrl =
      await fetchImageUrl(
        parsed.imageQuery
      );

    res.json({
      title: parsed.title,
      answer: parsed.answer,
      paragraphs: parsed.paragraphs,
      keyFacts: parsed.keyFacts,
      relatedLinks: parsed.relatedLinks,
      imageQuery: parsed.imageQuery,
      imageUrl,
      modelUsed,
      providerUsed,
      usedLiveNews,
      wasTruncated,
    });
  } catch (error) {
    console.error(
      "ATLAS AI ERROR:",
      error
    );

    res.status(500).json({
      error:
        "A.T.L.A.S could not process the request.",
    });
  }
});

// -------------------------------------
// SERVER
// -------------------------------------

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `ATLAS backend running on port ${PORT}`
  );
});