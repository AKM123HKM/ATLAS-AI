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
// ASK ATLAS
// -------------------------------------

app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        error: "No question provided",
      });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model: "openrouter/free",

          messages: [
            {
              role: "system",

              content: `
You are A.T.L.A.S 3K.

A.T.L.A.S stands for:
Advanced Technology and Learning Assistant System.

You are a futuristic educational AI assistant being demonstrated
at a student science and technology exhibition.

Your job is NOT simply to give a short chatbot answer.

The user is looking at a large visual knowledge screen while
you speak your answer aloud.

Therefore, generate TWO things conceptually:

1. A rich educational explanation for the visual screen.
2. The SAME explanation in a form that can naturally be spoken aloud.

IMPORTANT:

The final "answer" must contain the complete explanation.
It should NOT be limited to 4-5 lines.

For normal educational questions, provide approximately
5-8 meaningful paragraphs.

Each paragraph should add new information.

Explain:
- what the thing is
- how it works
- why it is important
- useful examples
- interesting facts
- related concepts when appropriate

Do NOT pad the answer with meaningless sentences.

For simple questions, you may use fewer paragraphs.
For complicated questions, provide more detailed explanations.

Do not make the answer unnecessarily complicated.

PERSONALITY:

- Intelligent
- Calm
- Helpful
- Slightly futuristic
- Confident
- Educational

Do not say that you are a language model.

Do not pretend to have searched the internet.

Do not invent facts.

Return ONLY valid JSON.

Use EXACTLY this structure:

{
  "title": "Short title of the topic",

  "answer": "The complete detailed explanation in plain text. Use multiple paragraphs separated by \\n\\n.",

  "paragraphs": [
    "First substantial paragraph.",
    "Second substantial paragraph.",
    "Third substantial paragraph.",
    "Fourth substantial paragraph."
  ],

  "keyFacts": [
    "Important fact 1",
    "Important fact 2",
    "Important fact 3",
    "Important fact 4"
  ],

  "relatedLinks": [
    {
      "title": "Wikipedia",
      "url": "https://en.wikipedia.org/wiki/RELEVANT_TOPIC",
      "description": "A general reference about the topic."
    }
  ],

  "imageQuery": "2-4 simple words describing the main topic"
}

LINK RULES:

Only provide links to reliable, well-known websites.

Good examples:
- Wikipedia
- NASA
- Britannica
- official government websites
- official scientific organizations
- official documentation

Do NOT invent obscure websites.

If you are unsure about an exact URL,
use a Wikipedia URL only when you know the article exists.
Otherwise return an empty relatedLinks array.

IMAGE RULE:

imageQuery should describe the main visual subject.

Examples:

"solar system planets"

"human heart anatomy"

"computer processor"

"black hole space"

"DNA molecule"

Do not provide an image URL.

The frontend will obtain the visual separately.

IMPORTANT:

The "answer" field is what A.T.L.A.S will speak aloud.

Therefore it must contain the complete explanation,
not a summary.

The "paragraphs" field is what the visual knowledge screen
will display.

Keep the paragraphs consistent with the answer.

User question:

${question}
`,
            },

            {
              role: "user",
              content: question,
            },
          ],

          // Much larger than before.
          max_tokens: 1500,
        }),
      }
    );

    const data = await response.json();

    // -------------------------------------
    // OPENROUTER ERROR
    // -------------------------------------

    if (!response.ok) {
      console.error("OPENROUTER ERROR:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "OpenRouter request failed.",
      });
    }

    // -------------------------------------
    // GET MODEL RESPONSE
    // -------------------------------------

    const rawContent =
      data?.choices?.[0]?.message?.content;

    if (!rawContent) {
      console.error(
        "OPENROUTER RESPONSE:",
        data
      );

      return res.status(500).json({
        error: "OpenRouter returned no answer.",
      });
    }

    // -------------------------------------
    // CLEAN JSON
    // -------------------------------------

    let parsed;

    try {
      let cleaned = rawContent.trim();

      // Sometimes models wrap JSON in ```json
      if (cleaned.startsWith("```")) {
        cleaned = cleaned
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "");
      }

      parsed = JSON.parse(cleaned);
    } catch (jsonError) {
      console.error(
        "JSON PARSE ERROR:",
        jsonError
      );

      console.error(
        "RAW MODEL RESPONSE:",
        rawContent
      );

      // Fallback if model ignored JSON instruction.
      parsed = {
        title: "ATLAS Intelligence Report",

        answer: rawContent.trim(),

        paragraphs: [
          rawContent.trim(),
        ],

        keyFacts: [],

        relatedLinks: [],

        imageQuery: "",
      };
    }

    // -------------------------------------
    // NORMALIZE RESPONSE
    // -------------------------------------

    const answer =
      typeof parsed.answer === "string"
        ? parsed.answer.trim()
        : "";

    const paragraphs = Array.isArray(
      parsed.paragraphs
    )
      ? parsed.paragraphs.filter(
          (item) =>
            typeof item === "string" &&
            item.trim()
        )
      : [];

    const keyFacts = Array.isArray(
      parsed.keyFacts
    )
      ? parsed.keyFacts.filter(
          (item) =>
            typeof item === "string" &&
            item.trim()
        )
      : [];

    const relatedLinks = Array.isArray(
      parsed.relatedLinks
    )
      ? parsed.relatedLinks.filter(
          (link) =>
            link &&
            typeof link.title === "string" &&
            typeof link.url === "string"
        )
      : [];

    res.json({
      title:
        parsed.title ||
        "ATLAS Intelligence Report",

      answer,

      paragraphs:
        paragraphs.length > 0
          ? paragraphs
          : answer
          ? [answer]
          : [],

      keyFacts,

      relatedLinks,

      imageQuery:
        typeof parsed.imageQuery === "string"
          ? parsed.imageQuery
          : "",
    });
  } catch (error) {
    console.error("ATLAS AI ERROR:", error);

    res.status(500).json({
      error:
        "A.T.L.A.S could not process the request.",
    });
  }
});

// -------------------------------------
// SERVER
// -------------------------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `ATLAS backend running on port ${PORT}`
  );
});