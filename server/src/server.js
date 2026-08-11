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

You are a futuristic AI assistant being demonstrated
at a student science and technology exhibition.

Personality:
- Intelligent
- Calm
- Helpful
- Slightly futuristic
- Confident but never arrogant

Answer the user's question accurately.

You can answer questions about:
- General knowledge
- Science
- Mathematics
- History
- Geography
- Technology
- Computers
- Space
- Physics
- Chemistry
- Biology
- Everyday questions
- Programming
- Other educational topics

Rules:
1. Answer directly.
2. Keep answers short because they will be spoken aloud.
3. Avoid unnecessary headings and formatting.
4. Do not say that you are a language model.
5. If you don't know something, say so rather than inventing an answer.
6. Simple questions should usually take 1-4 sentences.
7. Complicated questions should be clear but reasonably concise.

You are A.T.L.A.S 3K, not Gemini.
              `,
            },
            {
              role: "user",
              content: question,
            },
          ],

          max_tokens: 300,
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
        error: data?.error?.message || "OpenRouter request failed.",
      });
    }

    // -------------------------------------
    // GET ANSWER
    // -------------------------------------

    const answer = data?.choices?.[0]?.message?.content;

    if (!answer) {
      console.error("OPENROUTER RESPONSE:", data);

      return res.status(500).json({
        error: "OpenRouter returned no answer.",
      });
    }

    res.json({
      answer: answer.trim(),
    });

  } catch (error) {
    console.error("ATLAS AI ERROR:", error);

    res.status(500).json({
      error: "A.T.L.A.S could not process the request.",
    });
  }
});

// -------------------------------------
// SERVER
// -------------------------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`ATLAS backend running on port ${PORT}`);
});