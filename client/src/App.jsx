import { useEffect, useRef, useState } from "react";
import "./App.css";
import "./Results.css";

function App() {
  const [booted, setBooted] = useState(false);
  const [status, setStatus] = useState("SYSTEM INITIALIZING");

  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");

  const [result, setResult] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef(null);
  const wakeWordRecognitionRef = useRef(null);

  const isProcessingRef = useRef(false);
  const speechQueueRef = useRef([]);
  const speechIndexRef = useRef(0);

  // =========================================================
  // ASK ATLAS
  // =========================================================

  const askAtlas = async (question) => {
    try {
      const response = await fetch(
        "https://atlas-ai-1wd9.onrender.com/api/ask",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to connect to ATLAS backend");
      }

      const data = await response.json();

      return data;
    } catch (error) {
      console.error("ATLAS API ERROR:", error);

      return {
        title: "Connection Error",
        answer:
          "I am unable to connect to my intelligence core right now.",
        paragraphs: [
          "The ATLAS intelligence service could not be reached.",
        ],
        keyFacts: [],
        relatedLinks: [],
        imageQuery: "",
      };
    }
  };

  // =========================================================
  // SPEECH
  // =========================================================

  const speak = (text) => {
    if (!text || !text.trim()) return;

    window.speechSynthesis.cancel();

    // Break long answers into manageable chunks.
    // Chrome speech synthesis can sometimes stop unexpectedly
    // when one huge utterance is passed to it.
    const cleanText = text
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .trim();

    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [
      cleanText,
    ];

    const chunks = [];

    let currentChunk = "";

    sentences.forEach((sentence) => {
      if ((currentChunk + sentence).length > 350) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }

        currentChunk = sentence;
      } else {
        currentChunk += " " + sentence;
      }
    });

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    speechQueueRef.current = chunks;
    speechIndexRef.current = 0;

    setSpeaking(true);
    setStatus("SPEAKING");

    speakNextChunk();
  };

  const speakNextChunk = () => {
    const queue = speechQueueRef.current;
    const index = speechIndexRef.current;

    if (index >= queue.length) {
      setSpeaking(false);
      isProcessingRef.current = false;

      setStatus("WAITING FOR WAKE WORD");

      setTimeout(() => {
        startWakeWordDetection();
      }, 500);

      return;
    }

    const utterance = new SpeechSynthesisUtterance(queue[index]);

    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    utterance.volume = 1;

    utterance.onstart = () => {
      setSpeaking(true);
      setStatus("SPEAKING");
    };

    utterance.onend = () => {
      speechIndexRef.current += 1;

      setTimeout(() => {
        speakNextChunk();
      }, 50);
    };

    utterance.onerror = (event) => {
      console.error("Speech error:", event);

      speechIndexRef.current += 1;

      setTimeout(() => {
        speakNextChunk();
      }, 50);
    };

    window.speechSynthesis.speak(utterance);
  };

  // =========================================================
  // PROCESS QUESTION
  // =========================================================

  const processQuestion = async (question) => {
    if (!question.trim()) return;

    setUserText(question);
    setAiText("");
    setResult(null);
    setShowResults(false);

    setStatus("PROCESSING");
    isProcessingRef.current = true;

    const data = await askAtlas(question);

    /*
      The backend now returns:

      {
        title,
        answer,
        paragraphs,
        keyFacts,
        relatedLinks,
        imageQuery
      }
    */

    const answer = data.answer || "";

    setAiText(answer);
    setResult(data);

    // Open the results page as soon as the answer arrives.
    setShowResults(true);

    setStatus("SPEAKING");

    // Speak the complete answer.
    speak(answer);
  };

  // =========================================================
  // WAKE WORD DETECTION
  // =========================================================

  const startWakeWordDetection = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech recognition is not supported in this browser. Please use Google Chrome."
      );
      return;
    }

    if (
      wakeWordRecognitionRef.current ||
      recognitionRef.current ||
      isProcessingRef.current
    ) {
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setListening(false);
      setStatus("WAITING FOR WAKE WORD");
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        transcript += event.results[i][0].transcript;
      }

      transcript = transcript.toLowerCase().trim();

      console.log("Wake listener heard:", transcript);

      if (
        transcript.includes("hey atlas") ||
        transcript.includes("hey at last") ||
        transcript.includes("hey atlas 3k") ||
        transcript.includes("okay atlas") ||
        transcript.includes("ok atlas")
      ) {
        console.log("ATLAS WAKE WORD DETECTED");

        recognition.stop();

        wakeWordRecognitionRef.current = null;

        setStatus("WAKE WORD DETECTED");

        setTimeout(() => {
          startQuestionListening();
        }, 400);
      }
    };

    recognition.onerror = (event) => {
      console.log("Wake word error:", event.error);

      wakeWordRecognitionRef.current = null;

      if (event.error === "not-allowed") {
        setStatus("MICROPHONE ACCESS DENIED");
        return;
      }

      if (!isProcessingRef.current) {
        setTimeout(() => {
          startWakeWordDetection();
        }, 500);
      }
    };

    recognition.onend = () => {
      wakeWordRecognitionRef.current = null;

      if (!isProcessingRef.current) {
        setTimeout(() => {
          startWakeWordDetection();
        }, 300);
      }
    };

    wakeWordRecognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.log("Wake recognition start error:", error);
    }
  };

  // =========================================================
  // QUESTION LISTENING
  // =========================================================

  const startQuestionListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setStatus("LISTENING");

      setUserText("");
      setAiText("");
      setResult(null);
      setShowResults(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;

      console.log("Question:", transcript);

      setListening(false);

      isProcessingRef.current = true;

      processQuestion(transcript);
    };

    recognition.onerror = (event) => {
      console.log(
        "Question recognition error:",
        event.error
      );

      setListening(false);

      recognitionRef.current = null;

      if (event.error === "no-speech") {
        setStatus("NO QUESTION DETECTED");
      } else {
        setStatus("VOICE ERROR");
      }

      isProcessingRef.current = false;

      setTimeout(() => {
        startWakeWordDetection();
      }, 1000);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.log("Question recognition start error:", error);
    }
  };

  // =========================================================
  // AUTOMATIC BOOT
  // =========================================================

  useEffect(() => {
    const bootTimer = setTimeout(() => {
      setBooted(true);

      const greeting =
        "Hello. I am A.T.L.A.S 3K. Advanced Technology and Learning Assistant System. I am online and ready.";

      setAiText(greeting);

      setTimeout(() => {
        speak(greeting);
      }, 500);
    }, 3000);

    return () => {
      clearTimeout(bootTimer);

      window.speechSynthesis.cancel();

      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      if (wakeWordRecognitionRef.current) {
        wakeWordRecognitionRef.current.stop();
      }
    };
  }, []);

  // =========================================================
  // LOADING SCREEN
  // =========================================================

  if (!booted) {
    return (
      <div className="boot-screen">
        <div className="boot-core">
          <div className="boot-ring ring-1"></div>
          <div className="boot-ring ring-2"></div>
          <div className="boot-ring ring-3"></div>

          <div className="boot-center">A</div>
        </div>

        <h1>
          A.T.L.A.S <span>3K</span>
        </h1>

        <p>
          ADVANCED TECHNOLOGY & LEARNING ASSISTANT SYSTEM
        </p>

        <p
          style={{
            marginTop: "25px",
            fontSize: "9px",
            letterSpacing: "3px",
            color: "#43eaff",
          }}
        >
          INITIALIZING SYSTEM...
        </p>
      </div>
    );
  }

  // =========================================================
  // RESULTS SCREEN
  // =========================================================

  if (showResults && result) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="system-status">
            <span className="status-dot"></span>
            SYSTEM ONLINE
          </div>

          <div className="logo">
            A.T.L.A.S <span>3K</span>
          </div>

          <div className="version">
            V1.0 // KNOWLEDGE CORE
          </div>
        </header>

        <main className="results-page">
          <div className="results-header">
            <div className="results-label">
              INTELLIGENCE REPORT
            </div>

            <h1>
              {result.title || "ATLAS Intelligence Report"}
            </h1>

            <div className="question-display">
              <span>QUERY</span>
              {userText}
            </div>
          </div>

          <div className="results-layout">
            <section className="results-main">
              {result.imageQuery && (
                <div className="results-image-card">
                  <img
                    src={`https://source.unsplash.com/1200x600/?${encodeURIComponent(
                      result.imageQuery
                    )}`}
                    alt={result.title}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}

              <div className="results-content">
                {(result.paragraphs || []).map(
                  (paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  )
                )}

                {result.answer &&
                  (!result.paragraphs ||
                    result.paragraphs.length === 0) && (
                    <p>{result.answer}</p>
                  )}
              </div>

              {result.keyFacts &&
                result.keyFacts.length > 0 && (
                  <div className="facts-section">
                    <div className="section-heading">
                      KEY FACTS
                    </div>

                    <div className="facts-grid">
                      {result.keyFacts.map(
                        (fact, index) => (
                          <div
                            className="fact-card"
                            key={index}
                          >
                            <span>
                              {String(index + 1).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <p>{fact}</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {result.relatedLinks &&
                result.relatedLinks.length > 0 && (
                  <div className="links-section">
                    <div className="section-heading">
                      EXPLORE FURTHER
                    </div>

                    <div className="links-grid">
                      {result.relatedLinks.map(
                        (link, index) => (
                          <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="knowledge-link"
                          >
                            <span className="link-number">
                              0{index + 1}
                            </span>

                            <div>
                              <strong>
                                {link.title}
                              </strong>

                              <small>
                                {link.description}
                              </small>
                            </div>

                            <span className="link-arrow">
                              ↗
                            </span>
                          </a>
                        )
                      )}
                    </div>
                  </div>
                )}
            </section>

            <aside className="results-side">
              <div className="atlas-side-card">
                <div className="side-orb">
                  <span>A</span>
                </div>

                <div className="side-status">
                  <span className="status-dot"></span>

                  {speaking
                    ? "ATLAS SPEAKING"
                    : "REPORT READY"}
                </div>

                <div className="side-line"></div>

                <p>
                  A.T.L.A.S has generated an expanded
                  knowledge report based on your query.
                </p>
              </div>

              <button
                className="back-command"
                onClick={() => {
                  setShowResults(false);
                  setResult(null);
                  setAiText("");
                  setUserText("");

                  setTimeout(() => {
                    startWakeWordDetection();
                  }, 300);
                }}
              >
                ← RETURN TO ATLAS
              </button>
            </aside>
          </div>
        </main>

        <footer>
          <span>
            A.T.L.A.S 3K // AI EXHIBITION PROTOTYPE
          </span>

          <span>
            {speaking
              ? "VOICE OUTPUT ACTIVE"
              : "ALL SYSTEMS NOMINAL"}
          </span>
        </footer>
      </div>
    );
  }

  // =========================================================
  // MAIN ATLAS SCREEN
  // =========================================================

  return (
    <div className="app">
      <header className="topbar">
        <div className="system-status">
          <span className="status-dot"></span>
          SYSTEM ONLINE
        </div>

        <div className="logo">
          A.T.L.A.S <span>3K</span>
        </div>

        <div className="version">
          V1.0 // VOICE CORE
        </div>
      </header>

      <main className="dashboard">
        <aside className="left-panel">
          <div className="panel brand-panel">
            <small>ADVANCED TECHNOLOGY</small>

            <h2>
              A.T.L.A.S <span>3K</span>
            </h2>

            <small>INTELLIGENCE SYSTEM</small>
          </div>

          <div className="panel">
            <div className="panel-title">
              SYSTEM STATUS
            </div>

            <div className="status-row">
              <span>CORE</span>
              <b>ONLINE</b>
            </div>

            <div className="status-row">
              <span>VOICE</span>

              <b>
                {listening
                  ? "LISTENING"
                  : speaking
                  ? "OUTPUT"
                  : "READY"}
              </b>
            </div>

            <div className="status-row">
              <span>NEURAL LINK</span>
              <b>STANDBY</b>
            </div>

            <div className="status-row">
              <span>VISUAL SYSTEM</span>
              <b>ACTIVE</b>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">
              SYSTEM INFORMATION
            </div>

            <p className="info">
              A.T.L.A.S 3K is an experimental
              voice-based artificial intelligence
              assistant.
            </p>
          </div>
        </aside>

        <section className="center">
          <div
            className={`ai-core ${
              listening
                ? "listening"
                : speaking
                ? "speaking"
                : ""
            }`}
          >
            <div className="ai-aura aura-1"></div>
            <div className="ai-aura aura-2"></div>
            <div className="ai-aura aura-3"></div>

            <div className="ai-orb">
              <div className="orb-light"></div>

              <div className="orb-surface surface-1"></div>
              <div className="orb-surface surface-2"></div>
              <div className="orb-surface surface-3"></div>

              <div className="orb-core"></div>
            </div>
          </div>

          <div className="voice-status">
            {status}
          </div>

          {userText && (
            <div className="user-subtitle">
              <span className="subtitle-label">
                YOU
              </span>

              {userText}
            </div>
          )}

          <div
            className={`mic-button ${
              listening ? "mic-active" : ""
            }`}
          >
            <span>{listening ? "■" : "●"}</span>
          </div>

          <div className="voice-hint">
            {listening
              ? "LISTENING..."
              : 'SAY "OK ATLAS"'}
          </div>
        </section>

        <aside className="right-panel">
          <div className="panel response-panel">
            <div className="panel-title">
              INTELLIGENCE OUTPUT
            </div>

            <div className="waiting">
              <div className="waiting-symbol">
                ◈
              </div>

              <p>
                A.T.L.A.S is waiting for your
                command.
              </p>

              <small>
                Say "Hey Atlas" to begin.
              </small>
            </div>
          </div>
        </aside>
      </main>

      <footer>
        <span>
          A.T.L.A.S 3K // AI EXHIBITION PROTOTYPE
        </span>

        <span>
          {speaking
            ? "VOICE OUTPUT ACTIVE"
            : "ALL SYSTEMS NOMINAL"}
        </span>
      </footer>
    </div>
  );
}

export default App;