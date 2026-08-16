import { useEffect, useRef, useState } from "react";
import "./App.css";
import "./Results.css";
import "./FuturisticHud.css";
import MusicPlayer from "./MusicPlayer";
import WeatherDialog from "./WeatherDialog";

// =========================================================
// PARTICLE FIELD
// =========================================================

function ParticleField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const COUNT = 90;

    const points = Array.from({ length: COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.6 + 0.4,
    }));

    const LINK_DIST = 130;

    let frameId;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resize);

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of points) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }

      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];

          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < LINK_DIST) {
            ctx.strokeStyle = `rgba(67, 234, 255, ${
              0.12 * (1 - dist / LINK_DIST)
            })`;

            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of points) {
        ctx.fillStyle = "rgba(120, 240, 255, 0.55)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-field" />;
}

// =========================================================
// HUD FRAME
// =========================================================

function HudFrame() {
  return (
    <>
      <div className="hud-corner hud-corner-tl" />
      <div className="hud-corner hud-corner-tr" />
      <div className="hud-corner hud-corner-bl" />
      <div className="hud-corner hud-corner-br" />
      <div className="hud-scanlines" />
    </>
  );
}

// =========================================================
// APP
// =========================================================

function App() {
  const [showMusic, setShowMusic] = useState(false);
  const [songToPlay, setSongToPlay] = useState(null);

  // =========================================================
  // WEATHER STATE
  // =========================================================

  const [showWeather, setShowWeather] = useState(false);
  const [weatherLocation, setWeatherLocation] =
    useState("Greater Noida");

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
  // LOCAL ATLAS KNOWLEDGE
  // =========================================================

  const getLocalAnswer = (question) => {
    const q = question.toLowerCase().trim();

    // =====================================================
    // MUSIC COMMANDS
    // =====================================================

    const musicCommands = [
      "play a song",
      "play song",
      "play music",
      "play some music",
      "start music",
      "open music",
      "open music player",
      "show music",
      "show music player",
      "music player",
      "i want music",
      "i want to listen to music",
    ];

    if (musicCommands.some((command) => q.includes(command))) {
      return {
        type: "music",
        song: q,
      };
    }

    // =====================================================
    // WHO ARE YOU
    // =====================================================

    if (
      q.includes("who are you") ||
      q.includes("what are you") ||
      q.includes("tell me about yourself") ||
      q.includes("introduce yourself")
    ) {
      return {
        title: "A.T.L.A.S 3K",

        answer:
          "I am A.T.L.A.S 3K, an Advanced Technology and Learning Assistant System. I am a voice-based AI assistant created as an exhibition prototype.",

        paragraphs: [
          "I am A.T.L.A.S 3K, an Advanced Technology and Learning Assistant System.",

          "I am designed to interact with users through voice, answer questions, provide information, and present knowledge through an interactive futuristic interface.",
        ],

        keyFacts: [
          "Voice-based AI assistant",
          "Designed for interactive learning",
          "Built as an exhibition prototype",
        ],

        relatedLinks: [],
        imageQuery: "",
        imageUrl: "",
        modelUsed: "LOCAL CORE",
      };
    }

    // =====================================================
    // WHAT CAN YOU DO
    // =====================================================

    if (
      q.includes("what can you do") ||
      q.includes("what can you perform") ||
      q.includes("what are your capabilities") ||
      q.includes("your capabilities") ||
      q.includes("what do you do")
    ) {
      return {
        title: "ATLAS CAPABILITIES",

        answer:
          "I can listen to your questions through voice, process your requests, answer general knowledge and science questions, and present information through my visual interface.",

        paragraphs: [
          "I can listen to spoken questions and respond using voice.",

          "I can answer questions across subjects such as science, general knowledge, technology and other areas supported by my knowledge systems.",

          "My interface can also display expanded information, images, key facts and useful links when available.",
        ],

        keyFacts: [
          "Voice interaction",
          "Question answering",
          "Science and general knowledge",
          "Visual information display",
        ],

        relatedLinks: [],
        imageQuery: "",
        imageUrl: "",
        modelUsed: "LOCAL CORE",
      };
    }

    // =====================================================
    // WHO CREATED YOU
    // =====================================================

    if (
      q.includes("who created you") ||
      q.includes("who made you") ||
      q.includes("who built you") ||
      q.includes("who developed you")
    ) {
      return {
        title: "ATLAS ORIGIN",

        answer:
          "I was created as an AI exhibition project by my development team as an experimental voice-based learning assistant.",

        paragraphs: [
          "I was created as part of the A.T.L.A.S 3K exhibition project.",

          "The project combines voice interaction, artificial intelligence and a futuristic visual interface to create a more interactive way of accessing information.",
        ],

        keyFacts: [
          "A.T.L.A.S 3K exhibition project",
          "Voice-based interaction",
          "Focused on learning and information",
        ],

        relatedLinks: [],
        imageQuery: "",
        imageUrl: "",
        modelUsed: "LOCAL CORE",
      };
    }

    // =====================================================
    // GREETING
    // =====================================================

    if (
      q === "hello" ||
      q === "hi" ||
      q === "hey" ||
      q === "hello atlas" ||
      q === "hey atlas"
    ) {
      return {
        title: "ATLAS",

        answer:
          "Hello. I am A.T.L.A.S 3K. How can I assist you?",

        paragraphs: [
          "Hello. I am A.T.L.A.S 3K.",
          "How can I assist you?",
        ],

        keyFacts: [],
        relatedLinks: [],
        imageQuery: "",
        imageUrl: "",
        modelUsed: "LOCAL CORE",
      };
    }

    // =====================================================
    // THANK YOU
    // =====================================================

    if (q.includes("thank you") || q.includes("thanks")) {
      return {
        title: "ATLAS",

        answer:
          "You're welcome. I am always ready for your next question.",

        paragraphs: [
          "You're welcome.",
          "I am always ready for your next question.",
        ],

        keyFacts: [],
        relatedLinks: [],
        imageQuery: "",
        imageUrl: "",
        modelUsed: "LOCAL CORE",
      };
    }

    return null;
  };

  // =========================================================
  // MUSIC COMMAND HANDLER
  // =========================================================

  const handleMusicCommand = (question) => {
    const q = question.toLowerCase().trim();

    if (!q.includes("play")) {
      return false;
    }

    const songs = [
      {
        title: "Bairan",
        aliases: [
          "bairan",
          "barren",
          "bairen",
          "byran",
          "byron",
          "biran",
        ],
      },

      {
        title: "Safar",
        aliases: [
          "safar",
          "suffer",
          "saffer",
          "safarh",
        ],
      },

      {
        title: "For a Reason",
        aliases: [
          "for a reason",
          "for the reason",
          "for reason",
        ],
      },
    ];

    const command = q
      .replace(/\bplay\b/g, "")
      .replace(/\bsong\b/g, "")
      .replace(/\bmusic\b/g, "")
      .replace(/\bthe\b/g, "")
      .trim();

    console.log("ATLAS MUSIC SEARCH:", command);

    for (const song of songs) {
      for (const alias of song.aliases) {
        if (command.includes(alias)) {
          console.log(
            "ATLAS SONG FOUND:",
            song.title
          );

          isProcessingRef.current = true;

          setSongToPlay(song.title);

          setShowMusic(true);

          setStatus(
            "PLAYING " +
              song.title.toUpperCase()
          );

          return true;
        }
      }
    }

    if (
      command === "" ||
      command === "a" ||
      command === "a song" ||
      command === "something"
    ) {
      console.log(
        "ATLAS: OPENING MUSIC LIBRARY"
      );

      isProcessingRef.current = true;

      setSongToPlay(null);
      setShowMusic(true);
      setStatus("MUSIC SYSTEM");

      return true;
    }

    return false;
  };

  // =========================================================
  // ASK ATLAS
  // =========================================================

  const askAtlas = async (question) => {
    const localAnswer = getLocalAnswer(question);

    // -------------------------------------------------------
    // SPECIAL LOCAL COMMANDS
    // -------------------------------------------------------

    if (localAnswer?.type === "music") {
      console.log("ATLAS: MUSIC COMMAND");

      return {
        type: "music",

        title: "MUSIC PLAYER",

        answer: "Opening the music player.",

        paragraphs: [],

        keyFacts: [],
        relatedLinks: [],

        imageQuery: "",
        imageUrl: "",

        modelUsed: "LOCAL CORE",
      };
    }

    // -------------------------------------------------------
    // NORMAL LOCAL KNOWLEDGE
    // -------------------------------------------------------

    if (localAnswer) {
      console.log("ATLAS: LOCAL RESPONSE");

      return localAnswer;
    }

    // -------------------------------------------------------
    // UNKNOWN QUESTION -> API
    // -------------------------------------------------------

    console.log("ATLAS: API REQUEST");

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
        throw new Error(
          "Failed to connect to ATLAS backend"
        );
      }

      const data = await response.json();

      return data;
    } catch (error) {
      console.error(
        "ATLAS API ERROR:",
        error
      );

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
        imageUrl: "",

        modelUsed: "CONNECTION ERROR",
      };
    }
  };

  // =========================================================
  // SPEECH
  // =========================================================

  const speak = (text) => {
    if (!text || !text.trim()) return;

    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .trim();

    const sentences =
      cleanText.match(/[^.!?]+[.!?]+/g) ||
      [cleanText];

    const chunks = [];

    let currentChunk = "";

    sentences.forEach((sentence) => {
      if (
        (currentChunk + sentence).length >
        350
      ) {
        if (currentChunk.trim()) {
          chunks.push(
            currentChunk.trim()
          );
        }

        currentChunk = sentence;
      } else {
        currentChunk += " " + sentence;
      }
    });

    if (currentChunk.trim()) {
      chunks.push(
        currentChunk.trim()
      );
    }

    speechQueueRef.current = chunks;
    speechIndexRef.current = 0;

    setSpeaking(true);
    setStatus("SPEAKING");

    speakNextChunk();
  };

  const speakNextChunk = () => {
    const queue = speechQueueRef.current;

    const index =
      speechIndexRef.current;

    if (index >= queue.length) {
      setSpeaking(false);

      // Do not restart wake-word detection
      // while music player is open.
      if (showMusic) {
        return;
      }

      // Do not restart wake-word detection
      // while weather dialog is open.
      if (showWeather) {
        return;
      }

      isProcessingRef.current = false;

      setStatus(
        "WAITING FOR WAKE WORD"
      );

      setTimeout(() => {
        startWakeWordDetection();
      }, 500);

      return;
    }

    const utterance =
      new SpeechSynthesisUtterance(
        queue[index]
      );

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
      console.error(
        "Speech error:",
        event
      );

      speechIndexRef.current += 1;

      setTimeout(() => {
        speakNextChunk();
      }, 50);
    };

    window.speechSynthesis.speak(
      utterance
    );
  };

  // =========================================================
  // PROCESS QUESTION
  // =========================================================

  const processQuestion = async (
    question
  ) => {
    if (!question.trim()) return;

    // =======================================================
    // WEATHER COMMAND
    // =======================================================

    const lowerQuestion =
      question.toLowerCase().trim();

    if (
      lowerQuestion.includes("weather") ||
      lowerQuestion.includes("climate") ||
      lowerQuestion.includes("temperature")
    ) {
      console.log(
        "ATLAS: WEATHER COMMAND"
      );

      // Try to extract location
      const locationMatch =
        lowerQuestion.match(
          /(?:weather|climate|temperature)(?:\s+(?:in|for|at|of))?\s+([a-zA-Z\s]+?)(?:\s+today|\s+tomorrow|\s+right now|\s+now)?$/i
        );

      let location = "Greater Noida";

      if (
        locationMatch &&
        locationMatch[1].trim()
      ) {
        location =
          locationMatch[1].trim();
      }

      console.log(
        "ATLAS WEATHER LOCATION:",
        location
      );

      setUserText(question);

      setAiText("");

      setResult(null);

      setShowResults(false);

      setWeatherLocation(location);

      setShowWeather(true);

      setStatus("WEATHER SYSTEM");

      // Prevent OpenRouter/API request
      isProcessingRef.current = true;

      return;
    }

    // =======================================================
    // MUSIC COMMAND
    // =======================================================

    if (
      handleMusicCommand(question)
    ) {
      setUserText(question);

      setAiText(
        "Opening local music library."
      );

      // Do NOT call speak() here.
      return;
    }

    // =======================================================
    // NORMAL QUESTION
    // =======================================================

    setUserText(question);

    setAiText("");

    setResult(null);

    setShowResults(false);

    setStatus("PROCESSING");

    isProcessingRef.current = true;

    const data =
      await askAtlas(question);

    const answer =
      data.answer || "";

    setAiText(answer);

    setResult(data);

    setShowResults(true);

    setStatus("SPEAKING");

    speak(answer);
  };

  // =========================================================
  // WAKE WORD DETECTION
  // =========================================================

  const startWakeWordDetection = () => {
    // Never listen while music player is open
    if (showMusic) {
      return;
    }

    // Never listen while weather is open
    if (showWeather) {
      return;
    }

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

    const recognition =
      new SpeechRecognition();

    recognition.lang = "en-US";

    recognition.continuous = true;

    recognition.interimResults = true;

    recognition.onstart = () => {
      setListening(false);

      setStatus(
        "WAITING FOR WAKE WORD"
      );
    };

    recognition.onresult = (
      event
    ) => {
      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        transcript +=
          event.results[i][0]
            .transcript;
      }

      transcript =
        transcript
          .toLowerCase()
          .trim();

      console.log(
        "Wake listener heard:",
        transcript
      );

      if (
        transcript.includes(
          "hey atlas"
        ) ||
        transcript.includes(
          "hey at last"
        ) ||
        transcript.includes(
          "hey atlas 3k"
        ) ||
        transcript.includes(
          "okay atlas"
        ) ||
        transcript.includes(
          "ok atlas"
        )
      ) {
        console.log(
          "ATLAS WAKE WORD DETECTED"
        );

        recognition.stop();

        wakeWordRecognitionRef.current =
          null;

        setStatus(
          "WAKE WORD DETECTED"
        );

        setTimeout(() => {
          startQuestionListening();
        }, 400);
      }
    };

    recognition.onerror = (
      event
    ) => {
      console.log(
        "Wake word error:",
        event.error
      );

      wakeWordRecognitionRef.current =
        null;

      if (
        event.error ===
        "not-allowed"
      ) {
        setStatus(
          "MICROPHONE ACCESS DENIED"
        );

        return;
      }

      if (
        !isProcessingRef.current &&
        !showMusic &&
        !showWeather
      ) {
        setTimeout(() => {
          startWakeWordDetection();
        }, 500);
      }
    };

    recognition.onend = () => {
      wakeWordRecognitionRef.current =
        null;

      if (
        !isProcessingRef.current &&
        !showMusic &&
        !showWeather
      ) {
        setTimeout(() => {
          startWakeWordDetection();
        }, 300);
      }
    };

    wakeWordRecognitionRef.current =
      recognition;

    try {
      recognition.start();
    } catch (error) {
      console.log(
        "Wake recognition start error:",
        error
      );
    }
  };

  // =========================================================
  // QUESTION LISTENING
  // =========================================================

  const startQuestionListening =
    () => {
      const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

      if (!SpeechRecognition)
        return;

      if (recognitionRef.current)
        return;

      const recognition =
        new SpeechRecognition();

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

      recognition.onresult = (
        event
      ) => {
        const transcript =
          event.results[0][0]
            .transcript;

        console.log(
          "Question:",
          transcript
        );

        setListening(false);

        isProcessingRef.current =
          true;

        processQuestion(
          transcript
        );
      };

      recognition.onerror = (
        event
      ) => {
        console.log(
          "Question recognition error:",
          event.error
        );

        setListening(false);

        recognitionRef.current =
          null;

        if (
          event.error ===
          "no-speech"
        ) {
          setStatus(
            "NO QUESTION DETECTED"
          );
        } else {
          setStatus(
            "VOICE ERROR"
          );
        }

        isProcessingRef.current =
          false;

        setTimeout(() => {
          startWakeWordDetection();
        }, 1000);
      };

      recognition.onend = () => {
        setListening(false);

        recognitionRef.current =
          null;
      };

      recognitionRef.current =
        recognition;

      try {
        recognition.start();
      } catch (error) {
        console.log(
          "Question recognition start error:",
          error
        );
      }
    };

  // =========================================================
  // AUTOMATIC BOOT
  // =========================================================

  useEffect(() => {
    const bootTimer =
      setTimeout(() => {
        setBooted(true);

        const greeting =
          "Hello. I am ATLAS 3K. Advanced Technology and Learning Assistant System. I am online and ready.";

        setAiText(greeting);

        setTimeout(() => {
          speak(greeting);
        }, 500);
      }, 3000);

    return () => {
      clearTimeout(bootTimer);

      window.speechSynthesis.cancel();

      if (
        recognitionRef.current
      ) {
        recognitionRef.current.stop();
      }

      if (
        wakeWordRecognitionRef.current
      ) {
        wakeWordRecognitionRef.current.stop();
      }
    };
  }, []);

  // =========================================================
  // BOOT SCREEN
  // =========================================================

  if (!booted) {
    return (
      <div className="boot-screen">
        <ParticleField />

        <div className="boot-core">
          <div className="boot-ring ring-1"></div>

          <div className="boot-ring ring-2"></div>

          <div className="boot-ring ring-3"></div>

          <div className="boot-center">
            A
          </div>
        </div>

        <h1>
          A.T.L.A.S{" "}
          <span>3K</span>
        </h1>

        <p>
          ADVANCED TECHNOLOGY &
          LEARNING ASSISTANT SYSTEM
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
  // MAIN APP
  // =========================================================

  return (
    <div className="app">
      <ParticleField />

      <HudFrame />

      {/* ===================================================
          MUSIC PLAYER
      =================================================== */}

      {showMusic && (
        <MusicPlayer
          songToPlay={songToPlay}
          onClose={() => {
            setShowMusic(false);

            setSongToPlay(null);

            isProcessingRef.current =
              false;

            setStatus(
              "WAITING FOR WAKE WORD"
            );

            setTimeout(() => {
              startWakeWordDetection();
            }, 300);
          }}
        />
      )}

      {/* ===================================================
          WEATHER DIALOG
      =================================================== */}

      {showWeather && (
        <WeatherDialog
          location={weatherLocation}
          onClose={() => {
            setShowWeather(false);

            isProcessingRef.current =
              false;

            setStatus(
              "WAITING FOR WAKE WORD"
            );

            setTimeout(() => {
              startWakeWordDetection();
            }, 300);
          }}
        />
      )}

      {/* ===================================================
          RESULTS SCREEN
      =================================================== */}

      {showResults && result ? (
        <>
          <header className="topbar">
            <div className="system-status">
              <span className="status-dot"></span>
              SYSTEM ONLINE
            </div>

            <div className="logo">
              A.T.L.A.S{" "}
              <span>3K</span>
            </div>

            <div className="version">
              {result.modelUsed
                ? `CORE // ${
                    result.modelUsed.split(
                      "/"
                    )[1] ||
                    result.modelUsed
                  }`
                : "V1.0 // KNOWLEDGE CORE"}
            </div>
          </header>

          <main className="results-page">
            <div className="results-header">
              <div className="results-label">
                INTELLIGENCE REPORT
              </div>

              <h1>
                {result.title ||
                  "ATLAS Intelligence Report"}
              </h1>

              <div className="question-display">
                <span>QUERY</span>

                {userText}
              </div>
            </div>

            <div className="results-layout">
              <section className="results-main">
                {result.imageUrl && (
                  <div className="results-image-card">
                    <img
                      src={
                        result.imageUrl
                      }
                      alt={
                        result.title
                      }
                      onError={(
                        event
                      ) => {
                        event.currentTarget.parentElement.style.display =
                          "none";
                      }}
                    />
                  </div>
                )}

                <div className="results-content">
                  {(
                    result.paragraphs ||
                    []
                  ).map(
                    (
                      paragraph,
                      index
                    ) => (
                      <p
                        key={
                          index
                        }
                      >
                        {
                          paragraph
                        }
                      </p>
                    )
                  )}

                  {result.answer &&
                    (!result.paragraphs ||
                      result.paragraphs
                        .length ===
                        0) && (
                      <p>
                        {
                          result.answer
                        }
                      </p>
                    )}
                </div>

                {result.keyFacts &&
                  result.keyFacts
                    .length >
                    0 && (
                    <div className="facts-section">
                      <div className="section-heading">
                        KEY FACTS
                      </div>

                      <div className="facts-grid">
                        {result.keyFacts.map(
                          (
                            fact,
                            index
                          ) => (
                            <div
                              className="fact-card"
                              key={
                                index
                              }
                            >
                              <span>
                                {String(
                                  index +
                                    1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </span>

                              <p>
                                {
                                  fact
                                }
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {result.relatedLinks &&
                  result.relatedLinks
                    .length >
                    0 && (
                    <div className="links-section">
                      <div className="section-heading">
                        EXPLORE FURTHER
                      </div>

                      <div className="links-grid">
                        {result.relatedLinks.map(
                          (
                            link,
                            index
                          ) => (
                            <a
                              key={
                                index
                              }
                              href={
                                link.url
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="knowledge-link"
                            >
                              <span className="link-number">
                                0
                                {index +
                                  1}
                              </span>

                              <div>
                                <strong>
                                  {
                                    link.title
                                  }
                                </strong>

                                <small>
                                  {
                                    link.description
                                  }
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
                    A.T.L.A.S has
                    generated an
                    expanded
                    knowledge report
                    based on your
                    query.
                  </p>
                </div>

                <button
                  className="back-command"
                  onClick={() => {
                    setShowResults(
                      false
                    );

                    setResult(null);

                    setAiText("");

                    setUserText("");

                    setTimeout(() => {
                      startWakeWordDetection();
                    }, 300);
                  }}
                >
                  ← RETURN TO
                  ATLAS
                </button>
              </aside>
            </div>
          </main>

          <footer>
            <span>
              A.T.L.A.S 3K // AI
              EXHIBITION PROTOTYPE
            </span>

            <span>
              {speaking
                ? "VOICE OUTPUT ACTIVE"
                : "ALL SYSTEMS NOMINAL"}
            </span>
          </footer>
        </>
      ) : (
        /* =================================================
           MAIN ATLAS DASHBOARD
        ================================================= */

        <>
          <header className="topbar">
            <div className="system-status">
              <span className="status-dot"></span>
              SYSTEM ONLINE
            </div>

            <div className="logo">
              A.T.L.A.S{" "}
              <span>3K</span>
            </div>

            <div className="version">
              V1.0 // VOICE CORE
            </div>
          </header>

          <main className="dashboard">
            <aside className="left-panel">
              <div className="panel brand-panel">
                <small>
                  ADVANCED TECHNOLOGY
                </small>

                <h2>
                  A.T.L.A.S{" "}
                  <span>3K</span>
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
                        : showMusic
                          ? "MUSIC"
                          : showWeather
                            ? "WEATHER"
                            : "READY"}
                  </b>
                </div>

                <div className="status-row">
                  <span>
                    NEURAL LINK
                  </span>

                  <b>STANDBY</b>
                </div>

                <div className="status-row">
                  <span>
                    VISUAL SYSTEM
                  </span>

                  <b>ACTIVE</b>
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">
                  SYSTEM INFORMATION
                </div>

                <p className="info">
                  A.T.L.A.S 3K is an
                  experimental
                  voice-based
                  artificial
                  intelligence
                  assistant.
                </p>
              </div>
            </aside>

            <section className="center">
              <div className="radar-sweep" />

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
                  listening
                    ? "mic-active"
                    : ""
                }`}
              >
                <span>
                  {listening
                    ? "■"
                    : "●"}
                </span>
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
                    A.T.L.A.S is
                    waiting for your
                    command.
                  </p>

                  <small>
                    Say "Hey Atlas" to
                    begin.
                  </small>
                </div>
              </div>
            </aside>
          </main>

          <footer>
            <span>
              A.T.L.A.S 3K // AI
              EXHIBITION PROTOTYPE
            </span>

            <span>
              {speaking
                ? "VOICE OUTPUT ACTIVE"
                : showMusic
                  ? "MUSIC SYSTEM ACTIVE"
                  : showWeather
                    ? "WEATHER SYSTEM ACTIVE"
                    : "ALL SYSTEMS NOMINAL"}
            </span>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;