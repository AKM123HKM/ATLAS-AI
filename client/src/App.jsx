import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [booted, setBooted] = useState(false);
  const [status, setStatus] = useState("READY FOR COMMAND");
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef(null);

  // -----------------------------
  // AI RESPONSE
  // -----------------------------

  const askAtlas = async (question) => {
    try {
      const response = await fetch("https://atlas-ai-1wd9.onrender.com/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to ATLAS backend");
      }

      const data = await response.json();

      return data.answer;

    } catch (error) {
      console.error("ATLAS API ERROR:", error);

      return "I am unable to connect to my intelligence core right now.";
    }
  };

  // -----------------------------
  // SPEAK
  // -----------------------------

  const speak = (text) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    utterance.volume = 1;

    utterance.onstart = () => {
      setSpeaking(true);
      setStatus("SPEAKING");
    };

    utterance.onend = () => {
      setSpeaking(false);
      setStatus("READY FOR COMMAND");
    };

    utterance.onerror = () => {
      setSpeaking(false);
      setStatus("READY FOR COMMAND");
    };

    window.speechSynthesis.speak(utterance);
  };

  // -----------------------------
  // PROCESS QUESTION
  // -----------------------------

  const processQuestion = async (question) => {
    if (!question.trim()) return;

    // Show what the visitor asked
    setUserText(question);

    // Clear previous answer
    setAiText("");

    // Start thinking animation
    setStatus("PROCESSING");

    // Ask backend
    const response = await askAtlas(question);

    // Show AI subtitles
    setAiText(response);

    // Start speaking animation
    setStatus("SPEAKING");

    // Speak the answer
    speak(response);
  };

  // -----------------------------
  // SPEECH RECOGNITION
  // -----------------------------

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech recognition is not supported in this browser. Please use Google Chrome."
      );
      return;
    }

    window.speechSynthesis.cancel();

    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setStatus("LISTENING");
      setUserText("");
      setAiText("");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;

      processQuestion(transcript);
    };

    recognition.onerror = (event) => {
      console.log("Speech recognition error:", event.error);

      setListening(false);

      if (event.error === "no-speech") {
        setStatus("NO SPEECH DETECTED");
      } else {
        setStatus("VOICE ERROR");
      }

      setTimeout(() => {
        setStatus("READY FOR COMMAND");
      }, 1500);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    recognition.start();
  };

  // -----------------------------
  // BOOT GREETING
  // -----------------------------

  const initializeAtlas = () => {
    setBooted(true);

    const greeting =
      "Hello. I am A.T.L.A.S 3K. Advanced Technology and Learning Assistant System. I am online and ready.";

    setAiText(greeting);

    setTimeout(() => {
      speak(greeting);
    }, 700);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();

      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // -----------------------------
  // BOOT SCREEN
  // -----------------------------

  if (!booted) {
    return (
      <div className="boot-screen">

        <div className="boot-core">
          <div className="boot-ring ring-1"></div>
          <div className="boot-ring ring-2"></div>
          <div className="boot-ring ring-3"></div>

          <div className="boot-center">
            A
          </div>
        </div>

        <h1>
          A.T.L.A.S <span>3K</span>
        </h1>

        <p>
          ADVANCED TECHNOLOGY & LEARNING ASSISTANT SYSTEM
        </p>

        <button onClick={initializeAtlas}>
          INITIALIZE SYSTEM
        </button>

      </div>
    );
  }

  // -----------------------------
  // MAIN UI
  // -----------------------------

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

        {/* LEFT */}

        <aside className="left-panel">

          <div className="panel brand-panel">

            <small>
              ADVANCED TECHNOLOGY
            </small>

            <h2>
              A.T.L.A.S <span>3K</span>
            </h2>

            <small>
              INTELLIGENCE SYSTEM
            </small>

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


        {/* CENTER */}

        <section className="center">

          <div
            className={`ai-core ${listening
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


          {/* USER SPEECH */}

          {userText && (

            <div className="user-subtitle">

              <span className="subtitle-label">
                YOU
              </span>

              {userText}

            </div>

          )}


          {/* AI SPEECH */}

          {aiText && (

            <div
              className={`ai-subtitle ${speaking ? "subtitle-speaking" : ""
                }`}
            >

              <span className="subtitle-label">
                A.T.L.A.S
              </span>

              {aiText}

            </div>

          )}


          <button
            className={`mic-button ${listening ? "mic-active" : ""
              }`}
            onClick={startListening}
          >

            <span>
              {listening ? "■" : "●"}
            </span>

          </button>


          <div className="voice-hint">

            {listening
              ? "LISTENING..."
              : "PRESS TO SPEAK"}

          </div>

        </section>


        {/* RIGHT */}

        <aside className="right-panel">

          <div className="panel response-panel">

            <div className="panel-title">
              INTELLIGENCE OUTPUT
            </div>


            <div className="waiting">

              {!aiText ? (
                <>
                  <div className="waiting-symbol">
                    ◈
                  </div>

                  <p>
                    A.T.L.A.S is waiting
                    for your command.
                  </p>

                  <small>
                    Ask a question to begin.
                  </small>
                </>
              ) : (
                <>
                  <div className="output-indicator">
                    {speaking ? "●" : "○"}
                  </div>

                  <p className="output-text">
                    {aiText}
                  </p>
                </>
              )}

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