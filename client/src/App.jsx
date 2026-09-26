import { useEffect, useRef, useState } from "react";
import "./App.css";
import "./Results.css";
import "./FuturisticHud.css";
import MusicPlayer from "./MusicPlayer";
import WeatherDialog from "./WeatherDialog";
import MathDialog from "./MathDialog";
import { solveMath, isMathQuestion } from "./mathEngine";
import AtlasGlobe from "./AtlasGlobe";
import LanguageToggle from "./components/LanguageToggle";
import {
  getLanguagePack,
  getSpeechLang,
  matchesWakeWord,
  pickVoiceForLanguage,
} from "./language/languageManager";

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
// LIVE CLOCK (topbar date/time readout)
// =========================================================

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="topbar-clock">
      <span className="clock-date">{dateStr}</span>
      <span className="clock-time">{timeStr}</span>
    </div>
  );
}

// =========================================================
// APPROXIMATE LOCATION VIA IP (fallback when GPS/geolocation
// permission is denied or unavailable)
// =========================================================

async function getApproxLocationByIP() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();

    if (data && data.latitude && data.longitude) {
      return { lat: data.latitude, lon: data.longitude };
    }
  } catch (err) {
    console.error("IP LOCATION FAILED:", err);
  }

  return null;
}

// =========================================================
// APP
// =========================================================

function App() {
  const [showMusic, setShowMusic] = useState(false);
  const [songToPlay, setSongToPlay] = useState(null);

  // =========================================================
  // LANGUAGE STATE — "en" or "hi". This is the single source of
  // truth, same pattern as every other piece of shared state in
  // this app. languageRef mirrors it for use inside setTimeout/
  // speech-recognition callbacks, which otherwise read a stale
  // value from whichever render created the closure (the same
  // bug class that hit showMusic/showWeather earlier).
  // =========================================================

  const [language, setLanguage] = useState("en");
  const languageRef = useRef("en");

  useEffect(() => {
    languageRef.current = language;

    // If the wake-word listener is currently idle-listening (not
    // mid-question, not mid-dialog), restart it so the new
    // recognition.lang takes effect immediately instead of only
    // on the next natural restart cycle.
    if (
      wakeWordRecognitionRef.current &&
      !isProcessingRef.current &&
      !showMusicRef.current &&
      !showWeatherRef.current &&
      !showMathRef.current
    ) {
      try {
        wakeWordRecognitionRef.current.stop();
      } catch (error) {
        console.log("ATLAS: language-change wake restart:", error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const lang = getLanguagePack(language);

  // =========================================================
  // WEATHER STATE
  // =========================================================

  const [showWeather, setShowWeather] = useState(false);
  const [showMath, setShowMath] = useState(false);
  const [mathResult, setMathResult] = useState(null);
  const [weatherLocation, setWeatherLocation] =
    useState("Greater Noida");
  const [weatherCoords, setWeatherCoords] = useState(null);

  const [booted, setBooted] = useState(false);
  const [status, setStatus] = useState("SYSTEM INITIALIZING");

  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");

  const [result, setResult] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef(null);
  const overlayRecognitionRef = useRef(null);
  const overlayRestartTimerRef = useRef(null);
  const wakeWordRecognitionRef = useRef(null);
  const wakeRestartTimerRef = useRef(null);
  const wakeSessionIdRef = useRef(0);

  // Always-current mirrors of showMusic/showWeather, used inside
  // setTimeout/speech callbacks so they never read a stale value
  // from the render that created the closure.
  const showMusicRef = useRef(false);
  const showWeatherRef = useRef(false);
  const showMathRef = useRef(false);

  useEffect(() => {
    showMusicRef.current = showMusic;
  }, [showMusic]);

  useEffect(() => {
    showWeatherRef.current = showWeather;
  }, [showWeather]);

  useEffect(() => {
    showMathRef.current = showMath;
  }, [showMath]);

  const isProcessingRef = useRef(false);

  const speechQueueRef = useRef([]);
  const speechIndexRef = useRef(0);

  // =========================================================
  // LIVE FEED LOG (right panel) — a running record of what
  // ATLAS has actually handled, purely visual, no functional
  // impact on routing.
  // =========================================================

  const [interactionLog, setInteractionLog] = useState([]);

  const logInteraction = (label) => {
    setInteractionLog((prev) => {
      const entry = {
        id: Date.now() + Math.random(),
        label:
          label.length > 46
            ? label.slice(0, 46) + "…"
            : label,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      return [entry, ...prev].slice(0, 6);
    });
  };

  // =========================================================
  // LOCAL ATLAS KNOWLEDGE
  // =========================================================

  const getLocalAnswer = (question) => {
    const q = question.toLowerCase().trim();
    const pack = getLanguagePack(languageRef.current);

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
        ...pack.local.whoAreYou,
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
        ...pack.local.whatCanYouDo,
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
        ...pack.local.whoCreatedYou,
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
      q === "hey atlas" ||
      q === "atlas" ||
      q === "नमस्ते" ||
      q === "नमस्ते एटलस" ||
      q === "हैलो एटलस"
    ) {
      return {
        ...pack.local.greetingReply,
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

    if (
      q.includes("thank you") ||
      q.includes("thanks") ||
      q.includes("धन्यवाद") ||
      q.includes("शुक्रिया")
    ) {
      return {
        ...pack.local.thankYou,
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

    const command = q
      .replace(/\bplay\b/g, "")
      .replace(/\bsong\b/g, "")
      .replace(/\bmusic\b/g, "")
      .replace(/\bthe\b/g, "")
      .trim();

    console.log("ATLAS MUSIC REQUEST:", command);

    const genericFillers = [
      "",
      "a",
      "a song",
      "some",
      "something",
      "anything",
    ];

    const cleanedCommand = genericFillers.includes(command)
      ? null
      : command;

    const pack = getLanguagePack(languageRef.current);

    isProcessingRef.current = true;

    setSongToPlay(cleanedCommand);
    setShowMusic(true);

    setStatus(
      cleanedCommand
        ? pack.systemStatus.searchingMusic + ": " + cleanedCommand.toUpperCase()
        : pack.systemStatus.musicSystem
    );

    return true;
  };

  // =========================================================
  // LOCAL MATH CORE — ZERO AI/API REQUESTS
  // =========================================================

  const handleMathCommand = (question) => {
    if (!isMathQuestion(question)) {
      return false;
    }

    const pack = getLanguagePack(languageRef.current);

    try {
      console.log("ATLAS: LOCAL MATH ENGINE → MathJS");
      const result = solveMath(question);

      if (!result) {
        throw new Error("Unable to parse this expression locally.");
      }

      setMathResult(result);
      setShowMath(true);
      setUserText(question);
      setAiText("");
      setResult(null);
      setShowResults(false);
      setStatus(pack.systemStatus.mathActive);
      isProcessingRef.current = true;

      const spoken =
        result.type === "equation" && result.solutions
          ? (result.solutions.length
              ? pack.math.solutionIs(
                  result.solutions
                    .map((v) =>
                      pack.math.equalsPart(result.variable || "x", v)
                    )
                    .join(" " + (pack.code === "hi" ? "और" : "and") + " ")
                )
              : pack.math.noRealSolution)
          : result.result
            ? pack.math.answerIs(result.result)
            : pack.math.analysisComplete;
      setTimeout(() => speak(spoken), 80);

      return true;
    } catch (error) {
      console.error("ATLAS MATH ERROR:", error);
      setMathResult({
        type: "calculation",
        title: "MATH CORE ERROR",
        expression: question,
        value: null,
        error: error?.message || "Unable to solve this expression locally.",
        engine: "MathJS LOCAL ENGINE",
      });
      setShowMath(true);
      setUserText(question);
      setAiText("");
      setResult(null);
      setShowResults(false);
      setStatus(pack.systemStatus.mathError);
      isProcessingRef.current = true;
      setTimeout(() => speak(pack.math.couldNotSolve), 80);
      return true;
    }
  };

  // =========================================================
  // ASK ATLAS
  // =========================================================

  const askAtlas = async (question) => {
    const localAnswer = getLocalAnswer(question);
    const pack = getLanguagePack(languageRef.current);

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

    if (localAnswer) {
      console.log("ATLAS: LOCAL RESPONSE");

      return localAnswer;
    }

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
            language: languageRef.current,
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
        title: pack.connectionError.title,

        answer: pack.connectionError.answer,

        paragraphs: [pack.connectionError.paragraph],

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
    if (!text || !text.trim()) {
      isProcessingRef.current = false;

      if (
        !showMusicRef.current &&
        !showWeatherRef.current
      ) {
        setStatus(
          getLanguagePack(languageRef.current).systemStatus.waitingWake
        );

        setTimeout(() => {
          startWakeWordDetection();
        }, 300);
      }

      return;
    }

    window.speechSynthesis.cancel();

    const speechLang = getSpeechLang(languageRef.current);
    const voice = pickVoiceForLanguage(languageRef.current);

    const cleanText = text
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .trim();

    const allSentences =
      cleanText.match(/[^.!?।]+[.!?।]+/g) ||
      [cleanText];

    // Only read the first few sentences aloud — a 250-word answer
    // read start-to-finish is exhausting to listen to at an
    // exhibition. The full text is already on screen (set by
    // processQuestion before speak() is called), so this only
    // changes what gets voiced, not what's shown.
    const MAX_SPOKEN_SENTENCES = 3;
    const wasTruncated = allSentences.length > MAX_SPOKEN_SENTENCES;
    const sentences = allSentences.slice(0, MAX_SPOKEN_SENTENCES);

    if (wasTruncated) {
      sentences.push(
        getLanguagePack(languageRef.current).readMoreOnScreen
      );
    }

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
    setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);

    speakNextChunk(speechLang, voice);
  };

  const speakNextChunk = (speechLang, voice) => {
    const queue = speechQueueRef.current;

    const index =
      speechIndexRef.current;

    if (index >= queue.length) {
      setSpeaking(false);

      if (showMusicRef.current) {
        return;
      }

      if (showWeatherRef.current) {
        return;
      }

      if (showMathRef.current) {
        return;
      }

      isProcessingRef.current = false;

      setStatus(
        getLanguagePack(languageRef.current).systemStatus.waitingWake
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

    utterance.lang = speechLang || getSpeechLang(languageRef.current);

    const resolvedVoice =
      voice || pickVoiceForLanguage(languageRef.current);

    if (resolvedVoice) {
      utterance.voice = resolvedVoice;
    }

    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    utterance.volume = 1;

    utterance.onstart = () => {
      setSpeaking(true);
      setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
    };

    utterance.onend = () => {
      speechIndexRef.current += 1;

      setTimeout(() => {
        speakNextChunk(speechLang, voice);
      }, 50);
    };

    utterance.onerror = (event) => {
      console.error(
        "Speech error:",
        event
      );

      speechIndexRef.current += 1;

      setTimeout(() => {
        speakNextChunk(speechLang, voice);
      }, 50);
    };

    window.speechSynthesis.speak(
      utterance
    );
  };

  // =========================================================
  // WEATHER / MATH VOICE CLOSE COMMANDS
  // =========================================================

  const isOverlayCloseCommand = (text) => {
    const normalized = text
      .toLowerCase()
      .replace(/[.,!?]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) return false;

    return /^(atlas\s+)?(back|go back|close|close it|exit|return|return back|hide|dismiss|cancel|stop)$/.test(
      normalized
    ) || /^(atlas\s+)?(close|exit|hide|dismiss|cancel|stop)\s+(weather|climate|weather dialog|math|math dialog|calculator|calculation)$/.test(
      normalized
    ) || /^(weather|climate|math|calculator|calculation)\s+(close|closed|back|exit)$/.test(
      normalized
    );
  };

  const stopOverlayCommandListening = () => {
    if (overlayRestartTimerRef.current) {
      clearTimeout(overlayRestartTimerRef.current);
      overlayRestartTimerRef.current = null;
    }

    if (overlayRecognitionRef.current) {
      const activeRecognition = overlayRecognitionRef.current;
      overlayRecognitionRef.current = null;

      try {
        activeRecognition.stop();
      } catch (error) {
        console.log("ATLAS overlay listener stop:", error);
      }
    }
  };

  const closeActiveOverlay = () => {
    stopOverlayCommandListening();
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setListening(false);

    if (showWeatherRef.current) {
      setShowWeather(false);
    }

    if (showMathRef.current) {
      setShowMath(false);
      setMathResult(null);
    }

    isProcessingRef.current = false;
    setStatus("WAITING FOR WAKE WORD");

    setTimeout(() => {
      if (
        !showWeatherRef.current &&
        !showMathRef.current &&
        !showMusicRef.current
      ) {
        startWakeWordDetection();
      }
    }, 50);
  };

  const startOverlayCommandListening = () => {
    if (!showWeatherRef.current && !showMathRef.current) return;
    if (overlayRecognitionRef.current) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = getSpeechLang(languageRef.current);
    recognition.continuous = true;
    // Use interim results so commands like "back" close the overlay
    // as soon as Chrome recognizes the word instead of waiting for
    // the browser to decide that the user has finished speaking.
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (!showWeatherRef.current && !showMathRef.current) return;
      setListening(true);
      setStatus("SAY BACK OR CLOSE TO EXIT");
    };

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript.trim();

      console.log("ATLAS OVERLAY COMMAND HEARD:", transcript, lastResult.isFinal ? "final" : "interim");

      // Close immediately on an interim match. We do not need to wait
      // for Chrome's final speech boundary for a one/two-word command.
      if (isOverlayCloseCommand(transcript)) {
        closeActiveOverlay();
      }
    };

    recognition.onerror = (event) => {
      console.log("ATLAS overlay command error:", event.error);

      if (event.error === "not-allowed") {
        overlayRecognitionRef.current = null;
        setListening(false);
      }
    };

    recognition.onend = () => {
      setListening(false);

      if (overlayRecognitionRef.current !== recognition) return;
      overlayRecognitionRef.current = null;

      if (!showWeatherRef.current && !showMathRef.current) return;
      if (overlayRestartTimerRef.current) return;

      overlayRestartTimerRef.current = setTimeout(() => {
        overlayRestartTimerRef.current = null;
        startOverlayCommandListening();
      }, 100);
    };

    overlayRecognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.log("ATLAS overlay listener start error:", error);
      overlayRecognitionRef.current = null;
    }
  };

  // =========================================================
  // PROCESS QUESTION
  // =========================================================

  const processQuestion = async (
    question
  ) => {
    if (!question.trim()) return;

    logInteraction(question);

    const lowerQuestion =
      question.toLowerCase().trim();

    if (
      (showWeatherRef.current || showMathRef.current) &&
      isOverlayCloseCommand(lowerQuestion)
    ) {
      closeActiveOverlay();
      return;
    }

    if (handleMathCommand(question)) {
      return;
    }

    if (
      lowerQuestion.includes("weather") ||
      lowerQuestion.includes("climate") ||
      lowerQuestion.includes("temperature")
    ) {
      console.log(
        "ATLAS: WEATHER COMMAND"
      );

      const locationMatch =
        lowerQuestion.match(
          /(?:weather|climate|temperature)\s+(?:in|for|at|of)\s+([a-zA-Z\s]+?)(?:\s+today|\s+tomorrow|\s+right now|\s+now)?$/i
        );

      let location = null;

      if (
        locationMatch &&
        locationMatch[1].trim()
      ) {
        location =
          locationMatch[1].trim();
      }

      setUserText(question);

      setAiText("");

      setResult(null);

      setShowResults(false);

      setStatus(getLanguagePack(languageRef.current).systemStatus.weatherSystem);

      isProcessingRef.current = true;

      if (location) {
        console.log(
          "ATLAS WEATHER LOCATION:",
          location
        );

        setWeatherCoords(null);
        setWeatherLocation(location);
        setShowWeather(true);

        return;
      }

      console.log(
        "ATLAS WEATHER: NO CITY NAMED, USING CURRENT LOCATION"
      );

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setWeatherCoords({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            });

            setWeatherLocation(null);
            setShowWeather(true);
          },
          async () => {
            const ipLoc =
              await getApproxLocationByIP();

            if (ipLoc) {
              setWeatherCoords(ipLoc);
              setWeatherLocation(null);
            } else {
              setWeatherCoords(null);
              setWeatherLocation(
                getLanguagePack(languageRef.current).weather.fallbackCity
              );
            }

            setShowWeather(true);
          },
          { timeout: 6000 }
        );
      } else {
        const ipLoc =
          await getApproxLocationByIP();

        if (ipLoc) {
          setWeatherCoords(ipLoc);
          setWeatherLocation(null);
        } else {
          setWeatherCoords(null);
          setWeatherLocation(
            getLanguagePack(languageRef.current).weather.fallbackCity
          );
        }

        setShowWeather(true);
      }

      return;
    }

    if (
      handleMusicCommand(question)
    ) {
      setUserText(question);

      setAiText(
        "Opening local music library."
      );

      return;
    }

    setUserText(question);

    setAiText("");

    setResult(null);

    setShowResults(false);

    setStatus(getLanguagePack(languageRef.current).systemStatus.processing);

    isProcessingRef.current = true;

    const data =
      await askAtlas(question);

    const answer =
      data.answer || "";

    setAiText(answer);

    setResult(data);

    setShowResults(true);

    setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);

    speak(answer);
  };

  // =========================================================
  // WAKE WORD DETECTION
  // =========================================================

  const startWakeWordDetection = () => {
    if (showMusicRef.current) return;
    if (showWeatherRef.current) return;
    if (showMathRef.current) return;
    if (isProcessingRef.current) return;

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus(getLanguagePack(languageRef.current).systemStatus.unsupported);
      return;
    }

    if (wakeWordRecognitionRef.current || recognitionRef.current) {
      return;
    }

    if (wakeRestartTimerRef.current) {
      return;
    }

    const sessionId = ++wakeSessionIdRef.current;
    const recognition = new SpeechRecognition();

    recognition.lang = getSpeechLang(languageRef.current);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let wakeWordTriggered = false;
    let intentionallyStopped = false;

    console.log("ATLAS: creating wake session", sessionId, recognition.lang);

    recognition.onstart = () => {
      console.log("ATLAS: WAKE LISTENER STARTED", sessionId);
      setListening(false);
      setStatus(getLanguagePack(languageRef.current).systemStatus.waitingWake);
    };

    recognition.onresult = (event) => {
      if (wakeWordTriggered) return;

      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      transcript = transcript.toLowerCase().trim();

      console.log("ATLAS WAKE HEARD:", transcript);

      const wakeDetected = matchesWakeWord(
        transcript,
        languageRef.current
      );

      if (!wakeDetected) return;

      console.log("ATLAS WAKE WORD DETECTED", sessionId);

      wakeWordTriggered = true;
      intentionallyStopped = true;
      isProcessingRef.current = true;

      setStatus(getLanguagePack(languageRef.current).systemStatus.wakeDetected);

      try {
        recognition.stop();
      } catch (error) {
        console.log("ATLAS wake stop:", error);
      }
    };

    recognition.onerror = (event) => {
      console.log("ATLAS: wake recognition error", sessionId, event.error);

      if (event.error === "aborted") {
        console.log("ATLAS: wake session aborted by browser", sessionId);
        return;
      }

      if (event.error === "not-allowed") {
        wakeWordRecognitionRef.current = null;
        isProcessingRef.current = false;
        setStatus(getLanguagePack(languageRef.current).systemStatus.micDenied);
        return;
      }

      console.log("ATLAS: wake error will be handled by onend", event.error);
    };

    recognition.onend = () => {
      console.log("ATLAS: WAKE LISTENER ENDED", sessionId);

      if (wakeWordRecognitionRef.current === recognition) {
        wakeWordRecognitionRef.current = null;
      }

      if (wakeWordTriggered) {
        console.log("ATLAS: STARTING QUESTION LISTENER", sessionId);

        setTimeout(() => {
          if (sessionId !== wakeSessionIdRef.current) return;
          startQuestionListening();
        }, 350);

        return;
      }

      if (intentionallyStopped) return;
      if (isProcessingRef.current) return;
      if (showMusicRef.current || showWeatherRef.current || showMathRef.current) {
        return;
      }

      if (wakeRestartTimerRef.current) return;

      wakeRestartTimerRef.current = setTimeout(() => {
        wakeRestartTimerRef.current = null;

        if (
          !wakeWordRecognitionRef.current &&
          !recognitionRef.current &&
          !isProcessingRef.current &&
          !showMusicRef.current &&
          !showWeatherRef.current &&
          !showMathRef.current
        ) {
          startWakeWordDetection();
        }
      }, 700);
    };

    wakeWordRecognitionRef.current = recognition;

    try {
      recognition.start();
      console.log("ATLAS: WAKE RECOGNITION STARTED REQUEST", sessionId);
    } catch (error) {
      console.log("ATLAS WAKE START ERROR:", error);

      if (wakeWordRecognitionRef.current === recognition) {
        wakeWordRecognitionRef.current = null;
      }

      if (!wakeRestartTimerRef.current) {
        wakeRestartTimerRef.current = setTimeout(() => {
          wakeRestartTimerRef.current = null;
          startWakeWordDetection();
        }, 1000);
      }
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

      recognition.lang = getSpeechLang(languageRef.current);

      recognition.continuous = false;

      recognition.interimResults = false;

      recognition.onstart = () => {
        setListening(true);

        setStatus(getLanguagePack(languageRef.current).systemStatus.listening);

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

        const pack = getLanguagePack(languageRef.current);

        if (
          event.error ===
          "no-speech"
        ) {
          setStatus(
            pack.systemStatus.noQuestion
          );
        } else {
          setStatus(
            pack.systemStatus.voiceError
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

  // Keep a dedicated voice listener active while Weather/Math is open.
  // This lets the user say "back" or "close" without saying the wake word again.
  useEffect(() => {
    if (showWeather || showMath) {
      const timer = setTimeout(() => {
        startOverlayCommandListening();
      }, 50);

      return () => clearTimeout(timer);
    }

    stopOverlayCommandListening();
    setListening(false);
  }, [showWeather, showMath]);

  // =========================================================
  // AUTOMATIC BOOT
  // =========================================================

  useEffect(() => {
    const bootTimer =
      setTimeout(() => {
        setBooted(true);

        const greeting =
          getLanguagePack(languageRef.current).greeting;

        setAiText(greeting);

        setTimeout(() => {
          speak(greeting);
        }, 500);
      }, 3000);

    return () => {
      clearTimeout(bootTimer);

      if (wakeRestartTimerRef.current) {
        clearTimeout(wakeRestartTimerRef.current);
        wakeRestartTimerRef.current = null;
      }

      window.speechSynthesis.cancel();

      stopOverlayCommandListening();

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

      {showWeather && (
        <WeatherDialog
          location={weatherLocation}
          coords={weatherCoords}
          onClose={closeActiveOverlay}
        />
      )}

      {showMath && mathResult && (
        <MathDialog
          result={mathResult}
          question={userText}
          onClose={closeActiveOverlay}
        />
      )}

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

            <LanguageToggle language={language} onChange={setLanguage} />

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

            <LiveClock />

            <LanguageToggle language={language} onChange={setLanguage} />

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
                      ? lang.systemStatus.listening
                      : speaking
                        ? lang.systemStatus.output
                        : showMusic
                          ? lang.systemStatus.music
                          : showWeather
                            ? lang.systemStatus.weather
                            : showMath
                              ? lang.systemStatus.math
                              : lang.systemStatus.ready}
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

              <div className="panel quick-panel">
                <div className="panel-title">
                  QUICK COMMANDS
                </div>

                <div className="quick-grid">
                  <button
                    type="button"
                    className="quick-btn"
                    onClick={() => {
                      if (
                        !isProcessingRef.current &&
                        !listening &&
                        !showMusicRef.current &&
                        !showWeatherRef.current &&
                        !showMathRef.current
                      ) {
                        startQuestionListening();
                      }
                    }}
                  >
                    <span className="quick-btn-dot" />
                    ASK A QUESTION
                  </button>

                  <button
                    type="button"
                    className="quick-btn"
                    onClick={() => {
                      if (!isProcessingRef.current) {
                        processQuestion("what's the weather");
                      }
                    }}
                  >
                    <span className="quick-btn-dot" />
                    CHECK WEATHER
                  </button>

                  <button
                    type="button"
                    className="quick-btn"
                    onClick={() => {
                      if (!isProcessingRef.current) {
                        processQuestion("play a song");
                      }
                    }}
                  >
                    <span className="quick-btn-dot" />
                    PLAY MUSIC
                  </button>

                  <button
                    type="button"
                    className="quick-btn"
                    onClick={() => {
                      if (!isProcessingRef.current) {
                        processQuestion("what is 18 times 24");
                      }
                    }}
                  >
                    <span className="quick-btn-dot" />
                    SOLVE MATH
                  </button>
                </div>
              </div>
            </aside>

            <section className="dashboard-center">
              <AtlasGlobe
                listening={listening}
                speaking={speaking}
              />

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

              <div className="talk-bar">
                <div className="talk-bar-track">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <span
                      key={`l-${i}`}
                      className="talk-bar-wave"
                      style={{ animationDelay: `${i * 0.06}s` }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className={`talk-bar-btn ${
                    listening ? "listening" : ""
                  }`}
                  onClick={() => {
                    if (listening) {
                      try {
                        recognitionRef.current?.stop();
                      } catch (error) {
                        console.log("ATLAS mic stop:", error);
                      }
                      return;
                    }

                    if (
                      !isProcessingRef.current &&
                      !showMusicRef.current &&
                      !showWeatherRef.current &&
                      !showMathRef.current
                    ) {
                      startQuestionListening();
                    }
                  }}
                  aria-label="Voice microphone"
                >
                  <span className="talk-bar-icon">
                    {listening ? "■" : "●"}
                  </span>
                  <span className="talk-bar-text">
                    {listening
                      ? lang.voiceHintListening
                      : lang.voiceHintIdle}
                  </span>
                </button>

                <div className="talk-bar-track">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <span
                      key={`r-${i}`}
                      className="talk-bar-wave"
                      style={{ animationDelay: `${i * 0.06}s` }}
                    />
                  ))}
                </div>
              </div>
            </section>

            <aside className="right-panel">
              <div className="panel response-panel">
                <div className="panel-title">
                  LIVE FEED
                </div>

                {interactionLog.length === 0 ? (
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
                ) : (
                  <div className="feed-list">
                    {interactionLog.map((entry) => (
                      <div className="feed-item" key={entry.id}>
                        <span className="feed-dot" />
                        <div className="feed-body">
                          <span className="feed-label">
                            {entry.label}
                          </span>
                          <span className="feed-time">
                            {entry.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    : showMath
                      ? "MATH CORE ACTIVE"
                      : "ALL SYSTEMS NOMINAL"}
            </span>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;