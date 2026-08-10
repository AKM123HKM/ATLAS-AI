import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});


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


    const response = await ai.models.generateContent({

      model: "gemini-3.6-flash",

      contents: question,

      config: {
        systemInstruction: `
You are A.T.L.A.S 3K.

A.T.L.A.S stands for:
Advanced Technology and Learning Assistant System.

You are a futuristic AI assistant being demonstrated
at a student science and technology exhibition.

Your personality:
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
2. Keep normal answers relatively short because your
   answer will be spoken aloud.
3. Avoid unnecessary headings and formatting.
4. Do not say that you are a language model.
5. If you don't know something, say so rather than
   inventing an answer.
6. For simple questions, answer in 1-4 sentences.
7. For complicated questions, explain them clearly
   but remain reasonably concise.

You are A.T.L.A.S 3K, not Gemini.
        `,

        maxOutputTokens: 1000,
      },

    });


    const answer = response.text;


    res.json({
      answer,
    });

  } catch (error) {

    console.error("ATLAS AI ERROR:");
    console.error(error);

    res.status(500).json({
      error: "A.T.L.A.S could not process the request.",
    });

  }

});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

  console.log(
    `ATLAS backend running on port ${PORT}`
  );

});