import { useEffect, useRef, useState } from "react";
import "./App.css";
import "./Results.css";
import "./FuturisticHud.css";
import MusicPlayer from "./MusicPlayer";
import WeatherDialog from "./WeatherDialog";
import MathDialog from "./MathDialog";
import NewsDialog from "./NewsDialog";
import { isNewsQuestion } from "./newsEngine";
import { parseDictionaryQuestion } from "./dictionaryEngine";
import { lookupFastDictionary } from "./fastDictionary";
import { usePersonPresence } from "./usePersonPresence";
import {
  getAtlasFeaturesResult,
  isAtlasFeaturesQuestion,
} from "./featuresAnswer";
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

function isHomeCommandPhrase(value) {
  const phrase = String(value || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /^(?:(?:please|hey|okay|ok|atlas) )*(?:(?:go|navigate|return|take me|bring me)(?: back)?(?: to)? |back to )?(?:the )?(?:atlas )?home(?: page| screen)?(?: please)?$/.test(
    phrase,
  );
}

function isHindiMusicCommand(value) {
  const phrase = String(value || "").toLowerCase();
  return /(?:गाना|गाने|गीत|संगीत|म्यूजिक|gaana|gana|geet|music)/i.test(phrase) &&
    /(?:बजाओ|बजाइए|चलाओ|चलाइए|सुनाओ|सुनाइए|लगाओ|चला दो|bajao|bajaiye|chalao|chala do|sunao|lagao|play)/i.test(phrase);
}

function isWeatherCommand(value) {
  const phrase = String(value || "").toLowerCase();
  return /\b(?:weather|climate|temperature|forecast|mausam|taapmaan|tapman|barish)\b/i.test(phrase) ||
    /(?:मौसम|तापमान|बारिश|वर्षा|मौसम कैसा)/.test(phrase);
}

function detectLanguagePreference(value) {
  const phrase = String(value || "").toLowerCase();
  const wantsHindi = /\b(hindi|hindee)\b|हिंदी|हिन्दी/.test(phrase);
  const wantsEnglish = /\b(english|englis|angrezi)\b|अंग्रेज़ी|अंग्रेजी|इंग्लिश/.test(phrase);

  if (wantsHindi === wantsEnglish) return null;
  return wantsHindi ? "hi" : "en";
}

function extractWeatherLocation(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(?:weather|climate|temperature|forecast|mausam|taapmaan|tapman|barish|today|tomorrow|now|right now|aaj|abhi|ka|ki|ke|mein|me|par|batao|bataiye|dikhao|dikhaiye|please|what|is|the|for|in|at|of|kya|kaisa|kaisi|hai|hoga|hogi|rahega|rahegi)\b/gi, " ")
    .replace(/(?:आज|अभी|का|की|के|में|मे|पर|बताओ|बताइए|दिखाओ|दिखाइए|क्या|कैसा|कैसी|है|होगा|होगी|रहेगा|रहेगी|मौसम|तापमान|बारिश|वर्षा|कितना|कितनी)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
      !showMathRef.current &&
      !showNewsRef.current
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
  const [showNews, setShowNews] = useState(false);
  const [newsQuery, setNewsQuery] = useState("latest news");
  const [mathResult, setMathResult] = useState(null);
  const [weatherLocation, setWeatherLocation] = useState("Greater Noida");
  const [weatherCoords, setWeatherCoords] = useState(null);

  const [booted, setBooted] = useState(false);
  const [presenceArmed, setPresenceArmed] = useState(false);
  const [presenceVideoReady, setPresenceVideoReady] = useState(false);
  const [presenceDetected, setPresenceDetected] = useState(false);
  const [status, setStatus] = useState("SYSTEM INITIALIZING");

  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");

  const [result, setResult] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef(null);
  const presenceVideoRef = useRef(null);
  const wakeWordRecognitionRef = useRef(null);
  const dialogCommandRecognitionRef = useRef(null);
  const preferenceRecognitionRef = useRef(null);
  const startupPreferenceActiveRef = useRef(false);
  const preferenceSessionRef = useRef(0);
  const speechCompletionRef = useRef(null);
  const musicControlsRef = useRef(null);
  const questionAbortRef = useRef(null);
  const questionGenerationRef = useRef(0);
  const lastMusicCommandRef = useRef({ command: "", time: 0 });
  const wakeRestartTimerRef = useRef(null);
  const wakeSessionIdRef = useRef(0);

  // Always-current mirrors of showMusic/showWeather, used inside
  // setTimeout/speech callbacks so they never read a stale value
  // from the render that created the closure.
  const showMusicRef = useRef(false);
  const showWeatherRef = useRef(false);
  const showMathRef = useRef(false);
  const showNewsRef = useRef(false);
  const showResultsRef = useRef(false);

  useEffect(() => {
    showMusicRef.current = showMusic;
  }, [showMusic]);

  useEffect(() => {
    showWeatherRef.current = showWeather;
  }, [showWeather]);

  useEffect(() => {
    showMathRef.current = showMath;
  }, [showMath]);

  useEffect(() => {
    showNewsRef.current = showNews;
  }, [showNews]);

  useEffect(() => {
    showResultsRef.current = showResults;
  }, [showResults]);

  const handleBack = () => {
    const hasActiveView =
      showNewsRef.current ||
      showNews ||
      showMathRef.current ||
      showMath ||
      showWeatherRef.current ||
      showWeather ||
      showMusicRef.current ||
      showMusic ||
      showResults;

    if (!hasActiveView) return false;

    speechSessionRef.current += 1;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    speechQueueRef.current = [];
    speechIndexRef.current = 0;

    if (showNewsRef.current || showNews) {
      setShowNews(false);
      setNewsQuery("latest news");
    } else if (showMathRef.current || showMath) {
      setShowMath(false);
      setMathResult(null);
    } else if (showWeatherRef.current || showWeather) {
      setShowWeather(false);
    } else if (showMusicRef.current || showMusic) {
      if (musicControlsRef.current?.close) {
        musicControlsRef.current.close();
      } else {
        setShowMusic(false);
        setSongToPlay(null);
      }
    } else if (showResults) {
      setShowResults(false);
      setResult(null);
      setAiText("");
      setUserText("");
    }

    isProcessingRef.current = false;
    setStatus("WAITING FOR WAKE WORD");
    setTimeout(() => startWakeWordDetection(), 300);
    return true;
  };

  const handleHome = () => {
    questionGenerationRef.current += 1;
    questionAbortRef.current?.abort();
    questionAbortRef.current = null;
    startupPreferenceActiveRef.current = false;
    preferenceSessionRef.current += 1;
    speechCompletionRef.current = null;
    try {
      preferenceRecognitionRef.current?.abort();
    } catch (error) {
      console.log("ATLAS language selection cancel:", error);
    }
    preferenceRecognitionRef.current = null;
    console.log("ATLAS COMMAND: HOME — returning to the globe dashboard");
    speechSessionRef.current += 1;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    speechQueueRef.current = [];
    speechIndexRef.current = 0;

    setShowNews(false);
    setNewsQuery("latest news");
    setShowMath(false);
    setMathResult(null);
    setShowWeather(false);
    musicControlsRef.current?.close?.();
    setShowMusic(false);
    setSongToPlay(null);
    setShowResults(false);
    setResult(null);
    setAiText("");
    setUserText("");

    isProcessingRef.current = false;
    setStatus("WAITING FOR WAKE WORD");
    setTimeout(() => startWakeWordDetection(), 300);
  };

  const handleHomeRef = useRef(handleHome);
  handleHomeRef.current = handleHome;

  const cancelCurrentQuestion = () => {
    try {
      recognitionRef.current?.stop();
    } catch (error) {
      console.log("ATLAS question cancel:", error);
    }
    handleHomeRef.current();
  };

  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;

  useEffect(() => {
    const handleBackShortcut = (event) => {
      if (event.altKey && event.key === "ArrowLeft") {
        if (handleBackRef.current()) event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleBackShortcut);
    return () => window.removeEventListener("keydown", handleBackShortcut);
  }, []);

  const isProcessingRef = useRef(false);

  const speechQueueRef = useRef([]);
  const speechIndexRef = useRef(0);
  const speechSessionRef = useRef(0);

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
        label: label.length > 46 ? label.slice(0, 46) + "…" : label,
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
    const pack = getLanguagePack("en");

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

    if (
      musicCommands.some((command) => q.includes(command)) ||
      isHindiMusicCommand(q)
    ) {
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
    const hindiMusicCommand = isHindiMusicCommand(q);

    if (!q.includes("play") && !hindiMusicCommand) {
      return false;
    }

    const command = hindiMusicCommand
      ? q
          .replace(/(?:गाना|गाने|गीत|संगीत|म्यूजिक|बजाओ|बजाइए|चलाओ|चलाइए|सुनाओ|सुनाइए|लगाओ|चला दो|कोई|एक|अच्छा|अच्छी|प्लीज़|कृपया)/g, " ")
          .replace(/\b(?:gaana|gana|geet|music|bajao|chalao|sunao|lagao|play|song|please|koi|ek|accha|achha|good|some)\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim()
      : q
          .replace(/\bplay\b/g, "")
          .replace(/\bsong\b/g, "")
          .replace(/\bmusic\b/g, "")
          .replace(/\bthe\b/g, "")
          .trim();

    console.log("ATLAS MUSIC REQUEST:", command);

    const genericFillers = ["", "a", "a song", "some", "something", "anything", "best", "song"];

    const cleanedCommand =
      genericFillers.includes(command) ||
      (hindiMusicCommand && /^(?:बढ़िया|पसंदीदा|कोई भी|अच्छा सा|accha sa|best song)$/i.test(command))
        ? null
        : command;

    const pack = getLanguagePack(languageRef.current);

    isProcessingRef.current = true;

    setSongToPlay(cleanedCommand);
    setShowMusic(true);

    setStatus(
      cleanedCommand
        ? pack.systemStatus.searchingMusic + ": " + cleanedCommand.toUpperCase()
        : pack.systemStatus.musicSystem,
    );

    return true;
  };

  // =========================================================
  // LOCAL NEWS CORE — ZERO LLM REQUESTS
  // =========================================================

  const handleNewsCommand = (question) => {
    if (!isNewsQuestion(question)) return false;

    console.log("ATLAS: LIVE NEWS CORE → DIRECT NEWS RELAY");

    setNewsQuery(question);
    setUserText(question);
    setAiText("");
    setResult(null);
    setShowResults(false);
    setShowNews(true);
    setStatus(
      languageRef.current === "hi"
        ? "ताज़ा समाचार लोड हो रहे हैं"
        : "LIVE NEWS FEED // DIRECT SOURCE // NO LLM REQUEST",
    );
    isProcessingRef.current = true;

    return true;
  };

  // =========================================================
  // LOCAL MATH CORE — ZERO AI/API REQUESTS
  // =========================================================

  const handleMathCommand = (question) => {
    if (!isMathQuestion(question)) {
      return false;
    }

    const pack = getLanguagePack("en");

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
          ? result.solutions.length
            ? pack.math.solutionIs(
                result.solutions
                  .map((v) => pack.math.equalsPart(result.variable || "x", v))
                  .join(" " + (pack.code === "hi" ? "और" : "and") + " "),
              )
            : pack.math.noRealSolution
          : result.result
            ? pack.math.answerIs(result.result)
            : pack.math.analysisComplete;
      setTimeout(() => speak(spoken, "en"), 80);

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
      setTimeout(() => speak(pack.math.couldNotSolve, "en"), 80);
      return true;
    }
  };

  // =========================================================
  // ASK ATLAS
  // =========================================================

  const askAtlas = async (question, signal) => {
    const localAnswer = getLocalAnswer(question);
    const pack = getLanguagePack("en");

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

          signal,

          body: JSON.stringify({
            question,
            language: "en",
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to connect to ATLAS backend");
      }

      const data = await response.json();

      return data;
    } catch (error) {
      if (signal?.aborted) return null;
      console.error("ATLAS API ERROR:", error);

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

  const speak = (text, outputLanguage = languageRef.current, onComplete = null) => {
    if (!text || !text.trim()) {
      isProcessingRef.current = false;

      if (!showMusicRef.current && !showWeatherRef.current) {
        setStatus(
          getLanguagePack(languageRef.current).systemStatus.waitingWake,
        );

        setTimeout(() => {
          startWakeWordDetection();
        }, 300);
      }

      return;
    }

    const speechSession = ++speechSessionRef.current;
    window.speechSynthesis.cancel();

    const speechLang = getSpeechLang(outputLanguage);
    const voice = pickVoiceForLanguage(outputLanguage);

    const cleanText = text.replace(/\n+/g, ". ").replace(/\s+/g, " ").trim();

    const allSentences = cleanText.match(/[^.!?।]+[.!?।]+/g) || [cleanText];

    // Keep spoken answers brief. The complete answer remains visible on the
    // Results page; voice playback only reads the first two sentences.
    const MAX_SPOKEN_SENTENCES = 2;
    const sentences = allSentences.slice(0, MAX_SPOKEN_SENTENCES);

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
    speechCompletionRef.current = onComplete;

    setSpeaking(true);
    setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);

    speakNextChunk(speechLang, voice, speechSession);
  };

  const speakNextChunk = (speechLang, voice, speechSession) => {
    if (speechSession !== speechSessionRef.current) return;

    const queue = speechQueueRef.current;

    const index = speechIndexRef.current;

    if (index >= queue.length) {
      setSpeaking(false);

      const onComplete = speechCompletionRef.current;
      speechCompletionRef.current = null;
      if (onComplete) {
        onComplete();
        return;
      }

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

      setStatus(getLanguagePack(languageRef.current).systemStatus.waitingWake);

      setTimeout(() => {
        startWakeWordDetection();
      }, 500);

      return;
    }

    const utterance = new SpeechSynthesisUtterance(queue[index]);

    utterance.lang = speechLang || getSpeechLang(languageRef.current);

    const resolvedVoice = voice || pickVoiceForLanguage(languageRef.current);

    if (resolvedVoice) {
      utterance.voice = resolvedVoice;
    }

    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    utterance.volume = 1;

    utterance.onstart = () => {
      if (speechSession !== speechSessionRef.current) return;
      setSpeaking(true);
      setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
    };

    utterance.onend = () => {
      if (speechSession !== speechSessionRef.current) return;
      speechIndexRef.current += 1;

      setTimeout(() => {
        speakNextChunk(speechLang, voice, speechSession);
      }, 50);
    };

    utterance.onerror = (event) => {
      if (speechSession !== speechSessionRef.current) return;

      if (event.error !== "interrupted" && event.error !== "canceled") {
        console.error("Speech error:", event);
      }

      if (event.error === "interrupted" || event.error === "canceled") {
        return;
      }

      speechIndexRef.current += 1;

      setTimeout(() => {
        speakNextChunk(speechLang, voice, speechSession);
      }, 50);
    };

    window.speechSynthesis.speak(utterance);
  };

  // =========================================================
  // PROCESS QUESTION
  // =========================================================

  const processQuestion = async (question) => {
    if (!question.trim()) return;

    const questionGeneration = ++questionGenerationRef.current;

    const lowerQuestion = question.toLowerCase().trim();

    if (isHomeCommandPhrase(lowerQuestion)) {
      handleHomeRef.current();
      return;
    }

    if (
      /^(?:please\s+)?(?:go\s+)?(?:back|close|exit|return)(?:\s+(?:(?:to|this|the)\s+)?(?:atlas|home|previous|screen|page|window|dialog|box|menu|news|weather|music|math))?$/i.test(
        lowerQuestion,
      )
    ) {
      handleBack();
      return;
    }

    logInteraction(question);

    if (isAtlasFeaturesQuestion(question)) {
      questionAbortRef.current?.abort();
      questionAbortRef.current = null;
      const featureResult = getAtlasFeaturesResult(languageRef.current);
      setUserText(question);
      setAiText(featureResult.answer);
      setResult(featureResult);
      setShowResults(true);
      setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
      isProcessingRef.current = true;
      speak(featureResult.spokenAnswer, languageRef.current);
      return;
    }

    if (handleNewsCommand(question)) {
      return;
    }

    if (handleMathCommand(question)) {
      return;
    }

    if (isWeatherCommand(question)) {
      console.log("ATLAS: WEATHER COMMAND");

      const englishLocationMatch = lowerQuestion.match(
        /(?:weather|climate|temperature|forecast)\s+(?:in|for|at|of)\s+([a-zA-Z\s]+?)(?:\s+today|\s+tomorrow|\s+right now|\s+now)?$/i,
      );
      const location = languageRef.current === "hi"
        ? extractWeatherLocation(question)
        : englishLocationMatch?.[1]?.trim() || "";

      setUserText(question);

      setAiText("");

      setResult(null);

      setShowResults(false);

      setStatus(
        getLanguagePack(languageRef.current).systemStatus.weatherSystem,
      );

      isProcessingRef.current = true;

      if (location) {
        console.log("ATLAS WEATHER LOCATION:", location);

        setWeatherCoords(null);
        setWeatherLocation(location);
        setShowWeather(true);

        return;
      }

      console.log("ATLAS WEATHER: NO CITY NAMED, USING CURRENT LOCATION");

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
            const ipLoc = await getApproxLocationByIP();

            if (ipLoc) {
              setWeatherCoords(ipLoc);
              setWeatherLocation(null);
            } else {
              setWeatherCoords(null);
              setWeatherLocation(
                getLanguagePack(languageRef.current).weather.fallbackCity,
              );
            }

            setShowWeather(true);
          },
          { timeout: 6000 },
        );
      } else {
        const ipLoc = await getApproxLocationByIP();

        if (ipLoc) {
          setWeatherCoords(ipLoc);
          setWeatherLocation(null);
        } else {
          setWeatherCoords(null);
          setWeatherLocation(
            getLanguagePack(languageRef.current).weather.fallbackCity,
          );
        }

        setShowWeather(true);
      }

      return;
    }

    if (handleMusicCommand(question)) {
      setUserText(question);

      setAiText(
        languageRef.current === "hi"
          ? "संगीत लाइब्रेरी खोली जा रही है।"
          : "Opening local music library.",
      );

      return;
    }

    const dictionaryWord = parseDictionaryQuestion(question);
    if (dictionaryWord) {
      setUserText(question);
      setAiText("");
      setResult(null);
      setShowResults(false);
      setStatus(getLanguagePack(languageRef.current).systemStatus.processing);
      isProcessingRef.current = true;

      const controller = new AbortController();
      questionAbortRef.current = controller;
      try {
        const selectedLanguage = languageRef.current;
        let fastResult = null;
        try {
          fastResult = await lookupFastDictionary(
            dictionaryWord,
            selectedLanguage,
            controller.signal,
          );
        } catch (fastLookupError) {
          if (controller.signal.aborted) return;
          console.warn("ATLAS FAST DICTIONARY LOOKUP:", fastLookupError);
        }
        if (
          controller.signal.aborted ||
          questionGeneration !== questionGenerationRef.current
        ) return;

        if (fastResult) {
          questionAbortRef.current = null;
          setAiText(fastResult.answer);
          setResult(fastResult);
          setShowResults(true);
          setStatus(getLanguagePack(selectedLanguage).systemStatus.speaking);
          speak(fastResult.answer, selectedLanguage);
          return;
        }

        const params = new URLSearchParams({
          word: dictionaryWord,
          language: selectedLanguage,
        });
        const response = await fetch(
          `https://atlas-ai-1wd9.onrender.com/api/dictionary?${params.toString()}`,
          { signal: controller.signal },
        );
        if (
          controller.signal.aborted ||
          questionGeneration !== questionGenerationRef.current
        ) return;

        if (!response.ok) {
          throw new Error("Dictionary entry unavailable");
        }

        const data = await response.json();
        if (
          controller.signal.aborted ||
          questionGeneration !== questionGenerationRef.current
        ) return;

        questionAbortRef.current = null;
        setAiText(data.answer || "");
        setResult(data);
        setShowResults(true);
        setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
        speak(data.answer || "", languageRef.current);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("ATLAS DICTIONARY LOOKUP:", error);
        questionAbortRef.current = null;
        const message = languageRef.current === "hi"
          ? `“${dictionaryWord}” का अर्थ अभी नहीं मिल पाया।`
          : `I couldn't find a dictionary meaning for “${dictionaryWord}”.`;
        const failure = {
          title: dictionaryWord,
          answer: message,
          paragraphs: [message],
          keyFacts: [],
          relatedLinks: [],
          imageQuery: "",
          imageUrl: "",
          modelUsed: "DICTIONARY LOOKUP",
        };
        setAiText(message);
        setResult(failure);
        setShowResults(true);
        setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
        speak(message, languageRef.current);
      }
      return;
    }

    setUserText(question);

    setAiText("");

    setResult(null);

    setShowResults(false);

    setStatus(getLanguagePack(languageRef.current).systemStatus.processing);

    isProcessingRef.current = true;

    const controller = new AbortController();
    questionAbortRef.current = controller;
    const data = await askAtlas(question, controller.signal);

    if (
      controller.signal.aborted ||
      questionGeneration !== questionGenerationRef.current ||
      !data
    ) {
      return;
    }

    questionAbortRef.current = null;

    const answer = data.answer || "";

    setAiText(answer);

    setResult(data);

    setShowResults(true);

    setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);

    speak(answer, "en");
  };

  // =========================================================
  // WAKE WORD DETECTION
  // =========================================================

  const startWakeWordDetection = () => {
    if (showMusicRef.current) return;
    if (showWeatherRef.current) return;
    if (showMathRef.current) return;
    if (showNewsRef.current) return;
    if (showResultsRef.current) return;
    if (isProcessingRef.current) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

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

      const wakeDetected = matchesWakeWord(transcript, languageRef.current);

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
      if (
        showMusicRef.current ||
        showWeatherRef.current ||
        showMathRef.current ||
        showNewsRef.current ||
        showResultsRef.current
      ) {
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
          !showMathRef.current &&
          !showNewsRef.current &&
          !showResultsRef.current
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

  const startQuestionListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    if (recognitionRef.current) return;

    const recognition = new SpeechRecognition();

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

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;

      console.log("Question:", transcript);

      setListening(false);

      isProcessingRef.current = true;

      processQuestion(transcript);
    };

    recognition.onerror = (event) => {
      console.log("Question recognition error:", event.error);

      setListening(false);

      recognitionRef.current = null;

      const pack = getLanguagePack(languageRef.current);

      if (event.error === "no-speech") {
        setStatus(pack.systemStatus.noQuestion);
      } else {
        setStatus(pack.systemStatus.voiceError);
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

  // Keep back/close voice commands available in dialogs and results,
  // when users should not need to say the wake word first.
  useEffect(() => {
    const backCommandActive =
      showMusic || showWeather || showMath || showNews || showResults;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!backCommandActive) return undefined;
    if (!SpeechRecognition) {
      console.warn(
        "ATLAS COMMAND LISTENER: SpeechRecognition is unavailable in this browser",
      );
      return undefined;
    }

    console.log("ATLAS COMMAND LISTENER: opening back/home voice listener");

    let disposed = false;
    let restartTimer = null;
    let recognition = null;

    const startDialogListener = () => {
      if (disposed) return;

      // Only one SpeechRecognition instance should own the microphone.
      // When a dialog is open, this command listener takes ownership.
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }

      recognition = new SpeechRecognition();
      dialogCommandRecognitionRef.current = recognition;
      recognition.lang = getSpeechLang(languageRef.current);
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        console.log("ATLAS COMMAND LISTENER: listening for home/back/close");
        setListening(true);
      };

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          for (let alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex += 1) {
            const heard = result[alternativeIndex].transcript;
            const phrase = heard
              .toLowerCase()
              .normalize("NFKC")
              .replace(/[.,!?।]/g, " ")
              .replace(/\s+/g, " ")
              .trim();

            console.log("ATLAS COMMAND LISTENER HEARD:", heard, "=>", phrase);

            // Navigation always takes priority over player commands.
            if (isHomeCommandPhrase(phrase) || /\bhome\b/.test(phrase)) {
              console.log("ATLAS COMMAND MATCH: HOME");
              handleHomeRef.current();
              return;
            }

            if (/\b(?:back|close|closed|closer|exit|return|dismiss|leave)\b/i.test(phrase)) {
              console.log("ATLAS COMMAND MATCH: BACK/CLOSE", phrase);
              if (showResultsRef.current || showResults) {
                handleHomeRef.current();
              } else {
                handleBackRef.current();
              }
              return;
            }

            const commandPhrase = phrase
              .replace(/^(?:(?:please|hey|okay|ok|atlas|can you|could you|would you)\s+)+/i, "")
              .replace(/\s+please$/i, "")
              .trim();

            if (/^(?:atlas|at last|एटलस|नमस्ते एटलस)$/i.test(commandPhrase)) {
              console.log("ATLAS COMMAND MATCH: ATLAS HOME ALIAS");
              handleHomeRef.current();
              return;
            }

            if (/^(?:back|go back|close|close it|exit|return|return back|बंद|बंद करो|बंद कर दो|वापस|वापस जाओ|पीछे जाओ)$/i.test(commandPhrase)) {
              console.log("ATLAS COMMAND MATCH: BACK/CLOSE", commandPhrase);
              if (showResultsRef.current || showResults) {
                handleHomeRef.current();
              } else {
                handleBackRef.current();
              }
              return;
            }

            if (showMusicRef.current && musicControlsRef.current) {
              const command = commandPhrase;
              const controls = musicControlsRef.current;

              const runMusicCommand = (name, action) => {
                const now = Date.now();
                const previous = lastMusicCommandRef.current;
                if (previous.command === name && now - previous.time < 900) {
                  return true;
                }
                lastMusicCommandRef.current = { command: name, time: now };
                action();
                console.log(`ATLAS MUSIC COMMAND: ${name.toUpperCase()}`);
                return true;
              };

              if (/^(?:रोक|रोकें|रोक दो|रुक जाओ)(?: संगीत| गाना)?$/.test(command)) {
                runMusicCommand("pause", controls.pause);
                return;
              }
              if (/^(?:pause|hold|stop)(?:\s+(?:it|the\s+)?(?:music|song|track))?$|^(?:pause|hold|stop) it$/.test(command)) {
                runMusicCommand("pause", controls.pause);
                return;
              }
              if (/^(?:चलाओ|चलाइए|बजाओ|बजाइए|सुनाओ|सुनाइए)(?: गाना| संगीत| गाने)?$/.test(command)) {
                runMusicCommand("play", controls.play);
                return;
              }
              if (/^(?:play|resume|continue)(?:\s+(?:it|the\s+)?(?:music|song|track))?$|^(?:play|resume|continue) it$/.test(command)) {
                runMusicCommand("play", controls.play);
                return;
              }
              if (/^(?:अगला|अगली|अगले)(?: गाना| गाने| गीत| ट्रैक)?$/.test(command)) {
                runMusicCommand("next", controls.next);
                return;
              }
              if (/^(?:next(?:\s+(?:the\s+)?(?:song|track|one))?|skip(?:\s+(?:(?:the\s+)?(?:song|track|one)|to\s+the\s+next(?:\s+(?:song|track))?))?)$/.test(command)) {
                runMusicCommand("next", controls.next);
                return;
              }
              if (/^(?:पिछला|पिछली|पिछले)(?: गाना| गाने| गीत| ट्रैक)?$/.test(command)) {
                runMusicCommand("previous", controls.previous);
                return;
              }
              if (/^(?:previous|prev|last)(?:\s+(?:the\s+)?(?:song|track|one))?$/.test(command)) {
                runMusicCommand("previous", controls.previous);
                return;
              }

              if (/^(?:volume up|increase (?:the )?volume|louder|turn (?:the )?volume up|आवाज़ बढ़ाओ|आवाज बढ़ाओ|वॉल्यूम बढ़ाओ|awaaz badhao|awaz badhao|volume badhao|volume badha do)$/.test(command)) {
                runMusicCommand("volumeUp", controls.volumeUp);
                return;
              }

              if (/^(?:volume down|decrease (?:the )?volume|quieter|turn (?:the )?volume down|आवाज़ कम करो|आवाज कम करो|वॉल्यूम कम करो|awaaz kam karo|awaz kam karo|volume kam karo|volume kam kar do)$/.test(command)) {
                runMusicCommand("volumeDown", controls.volumeDown);
                return;
              }

              if (/^(?:mute|mute music|म्यूट|म्यूट करो|आवाज़ बंद करो|mute karo|music mute karo)$/.test(command)) {
                runMusicCommand("mute", controls.mute);
                return;
              }

              if (/^(?:unmute|unmute music|अनम्यूट|आवाज़ चालू करो|unmute karo|music unmute karo)$/.test(command)) {
                runMusicCommand("unmute", controls.unmute);
                return;
              }
            }
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") {
          console.log("ATLAS COMMAND LISTENER:", event.error, "— restarting");
        } else {
          console.error(
            "ATLAS COMMAND LISTENER ERROR:",
            event.error,
            event.message || "",
          );
        }
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          disposed = true;
        }
      };

      recognition.onend = () => {
        setListening(false);
        console.log(
          "ATLAS COMMAND LISTENER: stopped",
          disposed ? "(closed)" : "(restarting)",
        );
        if (dialogCommandRecognitionRef.current === recognition) {
          dialogCommandRecognitionRef.current = null;
        }
        if (!disposed) {
          restartTimer = setTimeout(startDialogListener, 100);
        }
      };

      try {
        recognition.start();
      } catch (error) {
        console.error("ATLAS COMMAND LISTENER START ERROR:", error);
        if (!disposed) restartTimer = setTimeout(startDialogListener, 100);
      }
    };

    startDialogListener();

    return () => {
      disposed = true;
      setListening(false);
      console.log("ATLAS COMMAND LISTENER: closing");
      if (restartTimer) clearTimeout(restartTimer);
      if (dialogCommandRecognitionRef.current === recognition) {
        dialogCommandRecognitionRef.current = null;
      }
      try {
        recognition?.stop();
      } catch (error) {
        // Recognition may already have stopped as the dialog closed.
      }
    };
  }, [showMusic, showWeather, showMath, showNews, showResults]);

  // =========================================================
  // AUTOMATIC BOOT
  // =========================================================

  const finishLanguagePreference = (choice, announce = true) => {
    startupPreferenceActiveRef.current = false;
    preferenceSessionRef.current += 1;
    try {
      preferenceRecognitionRef.current?.stop();
    } catch (error) {
      console.log("ATLAS language preference stop:", error);
    }
    preferenceRecognitionRef.current = null;
    setListening(false);
    isProcessingRef.current = false;
    languageRef.current = choice;
    setLanguage(choice);

    if (announce) {
      const confirmation = choice === "hi"
        ? "हिंदी चुनी गई है। अब हिंदी में जारी रखते हैं।"
        : "English selected. Let’s continue in English.";
      speak(confirmation, choice);
    } else {
      setStatus(getLanguagePack(choice).systemStatus.waitingWake);
      setTimeout(() => startWakeWordDetection(), 300);
    }
  };

  const handleLanguageToggle = (choice) => {
    if (startupPreferenceActiveRef.current) {
      finishLanguagePreference(choice, false);
      return;
    }
    languageRef.current = choice;
    setLanguage(choice);
  };

  const startLanguagePreferenceListening = (attempt = 0, session = preferenceSessionRef.current) => {
    if (!startupPreferenceActiveRef.current || session !== preferenceSessionRef.current) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      startupPreferenceActiveRef.current = false;
      isProcessingRef.current = false;
      setStatus("VOICE RECOGNITION UNSUPPORTED — SELECT A LANGUAGE ABOVE");
      return;
    }

    if (attempt >= 4) {
      startupPreferenceActiveRef.current = false;
      isProcessingRef.current = false;
      setStatus("LANGUAGE NOT DETECTED — SELECT ENGLISH OR HINDI ABOVE");
      setTimeout(() => startWakeWordDetection(), 500);
      return;
    }

    const recognition = new SpeechRecognition();
    const locale = attempt % 2 === 0 ? "en-IN" : "hi-IN";
    let retryScheduled = false;
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = false;
    preferenceRecognitionRef.current = recognition;

    const retry = () => {
      if (retryScheduled || !startupPreferenceActiveRef.current) return;
      retryScheduled = true;
      setListening(false);
      setTimeout(() => {
        if (preferenceRecognitionRef.current === recognition) {
          preferenceRecognitionRef.current = null;
        }
        startLanguagePreferenceListening(attempt + 1, session);
      }, 400);
    };

    recognition.onstart = () => {
      setListening(true);
      setStatus("SAY ENGLISH OR HINDI");
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      console.log("ATLAS LANGUAGE PREFERENCE HEARD:", transcript);
      const choice = detectLanguagePreference(transcript);
      if (choice) {
        finishLanguagePreference(choice);
      } else {
        retry();
      }
    };
    recognition.onerror = (event) => {
      console.warn("ATLAS LANGUAGE PREFERENCE ERROR:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        startupPreferenceActiveRef.current = false;
        preferenceRecognitionRef.current = null;
        setListening(false);
        isProcessingRef.current = false;
        setStatus(getLanguagePack(languageRef.current).systemStatus.micDenied);
        return;
      }
      retry();
    };
    recognition.onend = () => {
      setListening(false);
      if (preferenceRecognitionRef.current === recognition) {
        preferenceRecognitionRef.current = null;
      }
      if (
        startupPreferenceActiveRef.current &&
        session === preferenceSessionRef.current &&
        !retryScheduled
      ) {
        retry();
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.warn("ATLAS LANGUAGE PREFERENCE START ERROR:", error);
      retry();
    }
  };

  const askLanguagePreference = () => {
    startupPreferenceActiveRef.current = true;
    isProcessingRef.current = true;
    preferenceSessionRef.current += 1;
    const session = preferenceSessionRef.current;
    setStatus("CHOOSE ENGLISH OR HINDI");

    speak(
      "Would you like English or Hindi?",
      "en",
      () => startLanguagePreferenceListening(0, session),
    );
  };

  usePersonPresence(presenceArmed, presenceVideoRef, {
    onStatus: setStatus,
    onCameraReady: () => setPresenceVideoReady(true),
    onDetected: () => {
      setPresenceDetected(true);
      setStatus("PERSON DETECTED — CAMERA PREVIEW ON");
      const greeting = getLanguagePack("en").greeting;
      setAiText(greeting);
      speak(greeting, "en", askLanguagePreference);
    },
    onUnavailable: (error) => {
      console.warn("ATLAS PRESENCE CAMERA UNAVAILABLE:", error);
      setPresenceVideoReady(false);
      setPresenceArmed(false);
      setPresenceDetected(false);
      setStatus("CAMERA UNAVAILABLE — SAY ATLAS TO START");
      setTimeout(() => startWakeWordDetection(), 300);
    },
  });

  useEffect(() => {
    const bootTimer = setTimeout(() => {
      setBooted(true);
      setStatus("REQUESTING CAMERA ACCESS");
      setPresenceArmed(true);
    }, 3000);

    return () => {
      clearTimeout(bootTimer);
      startupPreferenceActiveRef.current = false;
      preferenceSessionRef.current += 1;
      speechCompletionRef.current = null;

      if (wakeRestartTimerRef.current) {
        clearTimeout(wakeRestartTimerRef.current);
        wakeRestartTimerRef.current = null;
      }

      window.speechSynthesis.cancel();

      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      if (preferenceRecognitionRef.current) {
        preferenceRecognitionRef.current.stop();
      }

      if (wakeWordRecognitionRef.current) {
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

          <div className="boot-center">A</div>
        </div>

        <h1>
          A.T.L.A.S <span>3K</span>
        </h1>

        <p>ADVANCED TECHNOLOGY & LEARNING ASSISTANT SYSTEM</p>

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

      {presenceArmed && (
        <aside className="presence-camera-card" aria-label="Camera presence detection">
          <div className="presence-camera-heading">
            <span className="status-dot" />
            {presenceDetected ? "LIVE CAMERA PREVIEW" : "PRESENCE SCAN"}
          </div>
          <div className="presence-camera-frame">
            <video
              ref={presenceVideoRef}
              autoPlay
              muted
              playsInline
              aria-label="Live camera preview"
            />
            {!presenceVideoReady && (
              <div className="presence-camera-placeholder">ALLOW CAMERA ACCESS</div>
            )}
          </div>
          <div className="presence-camera-footer">
            <span>
              {!presenceVideoReady
                ? "CAMERA STARTING"
                : presenceDetected
                  ? "ON-DEVICE · LIVE"
                  : "ON-DEVICE · 3 SEC CHECK"}
            </span>
            <button
              type="button"
              onClick={() => {
                setPresenceVideoReady(false);
                setPresenceArmed(false);
                setPresenceDetected(false);
                if (!presenceDetected) {
                  setStatus("CAMERA OFF — SAY ATLAS TO START");
                  setTimeout(() => startWakeWordDetection(), 300);
                } else {
                  setStatus(getLanguagePack(languageRef.current).systemStatus.waitingWake);
                }
              }}
              aria-label="Turn off camera"
            >
              CAMERA OFF
            </button>
          </div>
        </aside>
      )}

      {showMusic && (
        <MusicPlayer
          controlsRef={musicControlsRef}
          songToPlay={songToPlay}
          onClose={() => {
            setShowMusic(false);

            setSongToPlay(null);

            isProcessingRef.current = false;

            setStatus("WAITING FOR WAKE WORD");

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
          language={language}
          onClose={() => {
            setShowWeather(false);

            isProcessingRef.current = false;

            setStatus("WAITING FOR WAKE WORD");

            setTimeout(() => {
              startWakeWordDetection();
            }, 300);
          }}
        />
      )}

      {showMath && mathResult && (
        <MathDialog
          result={mathResult}
          question={userText}
          onClose={() => {
            setShowMath(false);
            setMathResult(null);
            isProcessingRef.current = false;
            setStatus("WAITING FOR WAKE WORD");
            setTimeout(() => {
              startWakeWordDetection();
            }, 300);
          }}
        />
      )}

      {showNews && (
        <NewsDialog
          query={newsQuery}
          language={language}
          onSpeak={(text) => {
            setAiText(text);
            speak(text, languageRef.current);
          }}
          onClose={() => {
            setShowNews(false);
            setNewsQuery("latest news");
            speechSessionRef.current += 1;
            window.speechSynthesis.cancel();
            speechQueueRef.current = [];
            speechIndexRef.current = 0;
            setSpeaking(false);
            isProcessingRef.current = false;
            setStatus("WAITING FOR WAKE WORD");
            setTimeout(() => {
              startWakeWordDetection();
            }, 80);
          }}
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
              A.T.L.A.S <span>3K</span>
            </div>

            <LanguageToggle language={language} onChange={handleLanguageToggle} />

            <div className="version">
              {result.modelUsed
                ? `CORE // ${
                    result.modelUsed.split("/")[1] || result.modelUsed
                  }`
                : "V1.0 // KNOWLEDGE CORE"}
            </div>
          </header>

          <main className="results-page">
            <div className="results-header">
              <div className="results-label">INTELLIGENCE REPORT</div>

              <h1>{result.title || "ATLAS Intelligence Report"}</h1>

              <div className="question-display">
                <span>QUERY</span>

                <span className="query-text">{userText}</span>
              </div>
            </div>

            <div className="results-layout">
              <section className="results-main">
                {result.imageUrl && (
                  <div className="results-image-card">
                    <img
                      src={result.imageUrl}
                      alt={result.title}
                      onError={(event) => {
                        event.currentTarget.parentElement.style.display =
                          "none";
                      }}
                    />
                  </div>
                )}

                <div
                  className={`results-content${result.featureList ? " features-content" : ""}`}
                >
                  {result.featureList?.length ? (
                    <ul className="feature-list">
                      {result.featureList.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                  ) : (
                    (result.paragraphs || []).map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))
                  )}

                  {result.answer &&
                    !result.featureList?.length &&
                    (!result.paragraphs || result.paragraphs.length === 0) && (
                      <p>{result.answer}</p>
                    )}
                </div>

              </section>

              <aside className="results-side">
                <div className="atlas-side-card">
                  <div className="side-orb">
                    <span>A</span>
                  </div>

                  <div className="side-status">
                    <span className="status-dot"></span>

                    {speaking ? "ATLAS SPEAKING" : "REPORT READY"}
                  </div>

                  <div className="side-line"></div>

                  <p>
                    A.T.L.A.S has generated an expanded knowledge report based
                    on your query.
                  </p>
                </div>

                {result.keyFacts && result.keyFacts.length > 0 && (
                  <div className="facts-section">
                    <div className="section-heading">KEY FACTS</div>

                    <div className="facts-grid">
                      {result.keyFacts.map((fact, index) => (
                        <div className="fact-card" key={index}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <p>{fact}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.relatedLinks && result.relatedLinks.length > 0 && (
                  <div className="links-section">
                    <div className="section-heading">EXPLORE FURTHER</div>

                    <div className="links-grid">
                      {result.relatedLinks.map((link, index) => (
                        <a
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="knowledge-link"
                        >
                          <span className="link-number">0{index + 1}</span>
                          <div>
                            <strong>{link.title}</strong>
                            <small>{link.description}</small>
                          </div>
                          <span className="link-arrow">↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="results-navigation-actions">
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
                  <button
                    type="button"
                    className="cancel-question-btn results-cancel-btn"
                    onClick={cancelCurrentQuestion}
                    aria-label={language === "hi" ? "सवाल रद्द करें" : "Cancel question"}
                  >
                    {language === "hi" ? "रद्द करें" : "CANCEL QUESTION"}
                  </button>
                </div>
              </aside>
            </div>
          </main>

          <footer>
            <span>A.T.L.A.S 3K // AI EXHIBITION PROTOTYPE</span>

            <span>
              {speaking ? "VOICE OUTPUT ACTIVE" : "ALL SYSTEMS NOMINAL"}
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
              A.T.L.A.S <span>3K</span>
            </div>

            <LiveClock />

            <LanguageToggle language={language} onChange={handleLanguageToggle} />

            <div className="version">V1.0 // VOICE CORE</div>
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
                <div className="panel-title">SYSTEM STATUS</div>

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
                            : showNews
                              ? "LIVE NEWS"
                              : showMath
                                ? lang.systemStatus.math
                                : lang.systemStatus.ready}
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

              <div className="panel quick-panel">
                <div className="panel-title">QUICK COMMANDS</div>

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
                        !showMathRef.current &&
                        !showNewsRef.current
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
                        processQuestion("latest news");
                      }
                    }}
                  >
                    <span className="quick-btn-dot" />
                    LATEST NEWS
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
              <AtlasGlobe listening={listening} speaking={speaking} />

              <div className="voice-status">{status}</div>

              {userText && (
                <div className="user-subtitle">
                  <span className="subtitle-label">YOU</span>
                  <span className="recognized-question-text">{userText}</span>
                  <div className="recognized-question-actions">
                    <button
                      type="button"
                      className="cancel-question-btn"
                      onClick={cancelCurrentQuestion}
                      aria-label={language === "hi" ? "सवाल रद्द करें" : "Cancel question"}
                    >
                      {language === "hi" ? "रद्द करें" : "CANCEL"}
                    </button>
                  </div>
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
                  className={`talk-bar-btn ${listening ? "listening" : ""}`}
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
                      !showMathRef.current &&
                      !showNewsRef.current
                    ) {
                      startQuestionListening();
                    }
                  }}
                  aria-label="Voice microphone"
                >
                  <span className="talk-bar-icon">{listening ? "■" : "●"}</span>
                  <span className="talk-bar-text">
                    {listening ? lang.voiceHintListening : lang.voiceHintIdle}
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
                <div className="panel-title">LIVE FEED</div>

                {interactionLog.length === 0 ? (
                  <div className="waiting">
                    <div className="waiting-symbol">◈</div>

                    <p>A.T.L.A.S is waiting for your command.</p>

                    <small>Say "Hey Atlas" to begin.</small>
                  </div>
                ) : (
                  <div className="feed-list">
                    {interactionLog.map((entry) => (
                      <div className="feed-item" key={entry.id}>
                        <span className="feed-dot" />
                        <div className="feed-body">
                          <span className="feed-label">{entry.label}</span>
                          <span className="feed-time">{entry.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </main>

          <footer>
            <span>A.T.L.A.S 3K // AI EXHIBITION PROTOTYPE</span>

            <span>
              {speaking
                ? "VOICE OUTPUT ACTIVE"
                : showMusic
                  ? "MUSIC SYSTEM ACTIVE"
                  : showWeather
                    ? "WEATHER SYSTEM ACTIVE"
                    : showNews
                      ? "LIVE NEWS ACTIVE"
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
