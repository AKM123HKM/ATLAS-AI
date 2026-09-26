import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// -------------------------------------
// HOME
// -------------------------------------

app.get("/", (req, res) => {
  res.json({
    name: "A.T.L.A.S 3K",
    status: "ONLINE",
  });
});

// -------------------------------------
// IMAGE FETCH
// Wikimedia Commons — free, no API key
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
      .map((page) => page.imageinfo?.[0])
      .filter(Boolean)
      .filter((info) =>
        ["image/jpeg", "image/png"].includes(info.mime)
      );

    const chosen = candidates[0];

    return chosen
      ? chosen.thumburl || chosen.url || ""
      : "";
  } catch (error) {
    console.error("IMAGE FETCH ERROR:", error);
    return "";
  }
}

// ============================================================
// LIVE NEWS
// Google News RSS — free, no API key
//
// NOTE:
// This section is retained for the existing /api/ask behavior.
// The NEW dedicated /api/news endpoint below is what the
// NewsDialog/newsEngine should use.
// ============================================================

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
  const q = String(question || "").toLowerCase();

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

    const items = [
      ...xml.matchAll(/<item>([\s\S]*?)<\/item>/g),
    ].slice(0, 6);

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

// ============================================================
// DEDICATED LIVE NEWS API
//
// Frontend flow:
//
// Voice
//   ↓
// App.jsx
//   ↓
// newsEngine.js
//   ↓
// /api/news
//   ↓
// Google News RSS
//
// IMPORTANT:
// This endpoint does NOT call OpenRouter/Gemini/Groq.
// ============================================================

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTag(block, tag) {
  const match = block.match(
    new RegExp(
      `<${tag}[^>]*>([\\s\\S]*?)</${tag}>`,
      "i"
    )
  );

  return match
    ? decodeXml(match[1].trim())
    : "";
}

function categoryQuery(category) {
  const queries = {
    general: "latest news",
    world: "world news",
    india: "India latest news",
    technology: "technology latest news",
    science: "science latest news",
    business: "business latest news",
    sports: "sports latest news",
    entertainment: "entertainment latest news",
    health: "health latest news",
    politics: "politics latest news",
  };

  return (
    queries[category] ||
    `${category} latest news`
  );
}

app.get("/api/news", async (req, res) => {
  try {
    const category = String(
      req.query.category || "general"
    ).toLowerCase();

    const country = String(
      req.query.country ||
        (category === "india" ? "in" : "us")
    ).toLowerCase();

    const q = String(
      req.query.q ||
        categoryQuery(category)
    ).trim();

    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 10,
        1
      ),
      20
    );

    const params = new URLSearchParams({
      q,
      hl:
        country === "in"
          ? "en-IN"
          : "en-US",
      gl: country.toUpperCase(),
      ceid:
        `${country.toUpperCase()}:en`,
    });

    const rssUrl =
      `https://news.google.com/rss/search?${params.toString()}`;

    console.log(
      "ATLAS NEWS →",
      rssUrl
    );

    const response = await fetch(
      rssUrl,
      {
        headers: {
          "User-Agent":
            "ATLAS-3K-NewsRelay/1.0",
        },
      }
    );

    if (!response.ok) {
      console.error(
        "GOOGLE NEWS ERROR:",
        response.status
      );

      return res.status(502).json({
        error:
          "Live news provider returned an error.",
      });
    }

    const xml =
      await response.text();

    const articles = [
      ...xml.matchAll(
        /<item>([\s\S]*?)<\/item>/gi
      ),
    ]
      .slice(0, limit)
      .map((match) => {
        const block = match[1];

        return {
          title: extractTag(
            block,
            "title"
          ),

          url: extractTag(
            block,
            "link"
          ),

          description:
            extractTag(
              block,
              "description"
            )
              .replace(
                /<[^>]+>/g,
                ""
              )
              .trim(),

          source: extractTag(
            block,
            "source"
          ),

          publishedAt:
            extractTag(
              block,
              "pubDate"
            ),
        };
      })
      .filter(
        (article) =>
          article.title &&
          article.url
      );

    res.set(
      "Cache-Control",
      "no-store"
    );

    res.json({
      source:
        "Google News RSS",

      category,

      country,

      query: q,

      fetchedAt:
        new Date().toISOString(),

      articles,
    });
  } catch (error) {
    console.error(
      "DEDICATED NEWS API ERROR:",
      error
    );

    res.status(500).json({
      error:
        "Live news feed failed.",
    });
  }
});

// ============================================================
// MUSIC SEARCH
// YouTube Data API — key stays server-side
// ============================================================

const YOUTUBE_API_KEY =
  process.env.YOUTUBE_API_KEY;

app.get(
  "/api/music/search",
  async (req, res) => {
    try {
      const q = req.query.q;

      if (!q || !q.trim()) {
        return res.status(400).json({
          error:
            "No search query provided",
        });
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

      const ytRes =
        await fetch(searchUrl);

      const ytData =
        await ytRes.json();

      if (!ytRes.ok) {
        console.error(
          "YOUTUBE SEARCH ERROR:",
          ytData
        );

        return res.status(502).json({
          error:
            "YouTube search failed",
        });
      }

      const results =
        (ytData.items || [])
          .filter(
            (item) =>
              item?.id?.videoId
          )
          .map((item) => ({
            videoId:
              item.id.videoId,

            title:
              item.snippet.title,

            channel:
              item.snippet.channelTitle,

            thumbnail:
              item.snippet.thumbnails
                ?.medium?.url ||
              item.snippet.thumbnails
                ?.default?.url ||
              "",
          }));

      res.json({
        results,
      });
    } catch (error) {
      console.error(
        "MUSIC SEARCH ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Music search failed",
      });
    }
  }
);

// ============================================================
// LLM CALL
// OpenRouter model fallback
// ============================================================

const MODEL_CANDIDATES = [
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openrouter/free",
];

async function callOpenRouter(
  systemPrompt,
  question
) {
  let lastError = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      const response =
        await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${process.env.OPENROUTER_API_KEY}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              model,

              messages: [
                {
                  role: "system",
                  content:
                    systemPrompt,
                },

                {
                  role: "user",
                  content: question,
                },
              ],

              max_tokens: 1800,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          `OPENROUTER ERROR (${model}):`,
          data
        );

        lastError = data;

        continue;
      }

      const rawContent =
        data?.choices?.[0]
          ?.message?.content;

      const finishReason =
        data?.choices?.[0]
          ?.finish_reason;

      if (!rawContent) {
        lastError = {
          error: {
            message:
              "Empty response",
          },
        };

        continue;
      }

      return {
        rawContent,
        modelUsed: model,
        finishReason,
      };
    } catch (error) {
      console.error(
        `OPENROUTER FETCH FAILED (${model}):`,
        error
      );

      lastError = {
        error: {
          message:
            error.message,
        },
      };
    }
  }

  throw (
    lastError ||
    new Error(
      "All models failed"
    )
  );
}

// ============================================================
// PLAIN-TEXT RESPONSE FORMAT
// ============================================================

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

// ============================================================
// PARSE ATLAS RESPONSE
// ============================================================

function parseAtlasResponse(
  rawContent,
  wasTruncated
) {
  const text =
    rawContent.trim();

  const getSection = (
    label,
    nextLabels
  ) => {
    const startMatch =
      text.match(
        new RegExp(
          `${label}:\\s*`,
          "i"
        )
      );

    if (!startMatch)
      return "";

    const startIndex =
      startMatch.index +
      startMatch[0].length;

    let endIndex =
      text.length;

    for (const next of nextLabels) {
      const nextMatch =
        text
          .slice(startIndex)
          .match(
            new RegExp(
              `\\n\\s*${next}:`,
              "i"
            )
          );

      if (nextMatch) {
        endIndex =
          Math.min(
            endIndex,
            startIndex +
              nextMatch.index
          );
      }
    }

    return text
      .slice(
        startIndex,
        endIndex
      )
      .trim();
  };

  const ALL_LABELS = [
    "TITLE",
    "ANSWER",
    "FACTS",
    "LINKS",
    "IMAGE",
  ];

  const title =
    getSection(
      "TITLE",
      ALL_LABELS.filter(
        (label) =>
          label !== "TITLE"
      )
    );

  let answerBlock =
    getSection(
      "ANSWER",
      [
        "FACTS",
        "LINKS",
        "IMAGE",
      ]
    );

  const factsBlock =
    getSection(
      "FACTS",
      [
        "LINKS",
        "IMAGE",
      ]
    );

  const linksBlock =
    getSection(
      "LINKS",
      ["IMAGE"]
    );

  const imageQuery =
    getSection(
      "IMAGE",
      []
    )
      .split("\n")[0]
      .trim();

  let paragraphs =
    answerBlock
      .split(/\n\s*\n/)
      .map((p) =>
        p
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);

  if (
    wasTruncated &&
    paragraphs.length > 1
  ) {
    const last =
      paragraphs[
        paragraphs.length - 1
      ];

    const endsCleanly =
      /[.!?]["')]?$/.test(
        last.trim()
      );

    if (!endsCleanly) {
      paragraphs =
        paragraphs.slice(
          0,
          -1
        );
    }
  }

  const answer =
    paragraphs.join(
      "\n\n"
    );

  const keyFacts =
    factsBlock
      .split("\n")
      .map((line) =>
        line
          .replace(
            /^-\s*/,
            ""
          )
          .trim()
      )
      .filter(Boolean);

  const relatedLinks =
    linksBlock
      .split("\n")
      .map((line) =>
        line
          .replace(
            /^-\s*/,
            ""
          )
          .trim()
      )
      .map((line) => {
        const parts =
          line
            .split("|")
            .map((p) =>
              p.trim()
            );

        if (
          parts.length < 2
        ) {
          return null;
        }

        return {
          title: parts[0],
          url: parts[1],
          description:
            parts[2] || "",
        };
      })
      .filter(
        (link) =>
          link &&
          /^https?:\/\//.test(
            link.url
          )
      );

  if (
    paragraphs.length === 0
  ) {
    return {
      title:
        title ||
        "ATLAS Intelligence Report",

      answer:
        "I wasn't able to put together a complete answer that time. Please try asking again.",

      paragraphs: [
        "I wasn't able to put together a complete answer that time. Please try asking again.",
      ],

      keyFacts: [],

      relatedLinks: [],

      imageQuery: "",
    };
  }

  return {
    title:
      title ||
      "ATLAS Intelligence Report",

    answer,

    paragraphs,

    keyFacts,

    relatedLinks,

    imageQuery,
  };
}

// ============================================================
// ASK ATLAS
// ============================================================

app.post(
  "/api/ask",
  async (req, res) => {
    try {
      const {
        question,
      } = req.body;

      if (
        !question ||
        !question.trim()
      ) {
        return res.status(400).json({
          error:
            "No question provided",
        });
      }

      // -------------------------------------
      // EXISTING LIVE NEWS CONTEXT
      //
      // IMPORTANT:
      // The dedicated frontend NewsDialog does
      // NOT come through this route.
      // -------------------------------------

      let newsContext = "";
      let usedLiveNews = false;

      if (
        isNewsQuery(question)
      ) {
        const headlines =
          await fetchNewsHeadlines(
            question
          );

        if (
          headlines.length > 0
        ) {
          usedLiveNews = true;

          newsContext =
            "\n\nCURRENT HEADLINES (real, fetched just now — treat these as ground truth, ignore any conflicting internal knowledge):\n" +
            headlines
              .map(
                (h, i) =>
                  `${i + 1}. "${h.title}" — ${
                    h.source ||
                    "unknown source"
                  } (${
                    h.pubDate ||
                    "date unknown"
                  })`
              )
              .join("\n");
        }
      }

      // -------------------------------------
      // LLM SYSTEM PROMPT
      // -------------------------------------

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

${RESPONSE_TEMPLATE}

User question:
${question}

${newsContext}
`;

      // -------------------------------------
      // CALL OPENROUTER
      // -------------------------------------

      let rawContent;
      let modelUsed;
      let finishReason;

      try {
        const result =
          await callOpenRouter(
            systemPrompt,
            question
          );

        rawContent =
          result.rawContent;

        modelUsed =
          result.modelUsed;

        finishReason =
          result.finishReason;
      } catch (err) {
        console.error(
          "ALL MODELS FAILED:",
          err
        );

        return res.status(502).json({
          error:
            err?.error?.message ||
            "All available AI models are currently unavailable. Try again shortly.",
        });
      }

      // -------------------------------------
      // CHECK TRUNCATION
      // -------------------------------------

      const wasTruncated =
        finishReason ===
        "length";

      // -------------------------------------
      // PARSE RESPONSE
      // -------------------------------------

      const parsed =
        parseAtlasResponse(
          rawContent,
          wasTruncated
        );

      // -------------------------------------
      // FETCH VISUAL
      // -------------------------------------

      const imageUrl =
        await fetchImageUrl(
          parsed.imageQuery
        );

      // -------------------------------------
      // RESPONSE
      // -------------------------------------

      res.json({
        title:
          parsed.title,

        answer:
          parsed.answer,

        paragraphs:
          parsed.paragraphs,

        keyFacts:
          parsed.keyFacts,

        relatedLinks:
          parsed.relatedLinks,

        imageQuery:
          parsed.imageQuery,

        imageUrl,

        modelUsed,

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
  }
);

// ============================================================
// SERVER
// ============================================================

const PORT =
  process.env.PORT || 5000;

app.listen(
  PORT,
  () => {
    console.log(
      `ATLAS backend running on port ${PORT}`
    );
  }
);