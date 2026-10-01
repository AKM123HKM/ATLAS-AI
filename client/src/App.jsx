import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import "./Results.css";
import "./FuturisticHud.css";
import MusicPlayer from "./MusicPlayer";
import WeatherDialog from "./WeatherDialog";
import MathDialog from "./MathDialog";
import NewsDialog from "./NewsDialog";
import PhotoPreview from "./PhotoPreview";
import { searchAtlasImage } from "./imageSearch";
import { fetchNewsFollowUp, isNewsQuestion } from "./newsEngine";
import { parseDictionaryQuestion } from "./dictionaryEngine";
import { lookupFastDictionary } from "./fastDictionary";
import { getAtlasKnowledgeResult } from "./atlasKnowledge";
import { usePersonPresence } from "./usePersonPresence";
import {
  getAtlasFeaturesResult,
  isAtlasFeaturesQuestion,
} from "./featuresAnswer";
import { solveMath, isMathQuestion, mathResultToSpeech } from "./mathEngine";
import { isWeatherCommand as matchesWeatherTerms, parseWeatherQuestion } from "./weatherEngine";
import { parseMusicRequest } from "./musicEngine";
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

function isBackCloseCommandPhrase(value) {
  const rawPhrase = String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:(?:please|hey|okay|ok|atlas|can you|could you|would you)\s+)+/, "")
    .replace(/\s+please$/, "")
    .trim();
  const phrase = rawPhrase.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

  return /^(?:(?:(?:go|take me|bring me|navigate|return)(?: back)?(?: to)?\s+)?(?:back|close|cloze|clothes|exit|return|dismiss|leave))(?:\s+(?:(?:the|this)\s+)?(?:atlas|home|news|latest news|dialog|box|page|screen|window|results?)(?:\s+(?:dialog|box|page|screen))?)?$/.test(phrase) ||
    /^(?:band(?: kar(?:o| do)?)?|wapas(?: jao)?|peeche jao)$/.test(phrase) ||
    /^(?:वापस|वापस जाओ|पीछे जाओ|बंद|बंद करो|बंद कर दो|होम|घर चलो)$/.test(rawPhrase);
}



function isInstantBackCommand(value) {
  const phrase = String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?।]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Keep this intentionally strict.
  // We do NOT want phrases like "go back to school" to trigger navigation.
  return /^(?:back|go back|take me back|bring me back|return|return back|वापस|वापस जाओ|पीछे जाओ)$/.test(
    phrase
  );
}

// Fast, forgiving matcher for close/back/home. Works on interim speech.
// Only short utterances (4 words or fewer) match, so ATLAS's own spoken
// answers or normal sentences can't trigger it by accident.
function getInstantNavCommand(value) {
  const phrase = String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?।]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!phrase) return null;

  // Saying just "Atlas" (or "hey Atlas") returns to the globe. Common
  // mishearings are included. Only the whole utterance can match, so
  // "hey atlas what's the weather" is not affected.
  if (
    /^(?:(?:hey|hi|hello|ok|okay)\s+)?(?:atlas|atlass|at last|at las|at less|etlas|adlas|एटलस|एटलास)(?:\s+(?:atlas|एटलस))?$/.test(
      phrase,
    )
  ) {
    return "home";
  }

  const words = phrase.split(" ");
  if (words.length > 4) return null;

  const FILLER = /^(?:please|hey|okay|ok|atlas|can|you|could|would|just|now|go|take|me|bring|navigate|to|the|this|that|it|a|at)$/;
  const CLOSE = /^(?:close|closed|closes|cloze|clothes|cloth|claws|clause|klose|exit|dismiss|leave|back|bak|bag|return|wapas|band|bandh|वापस|बंद|पीछे)$/;
  const HOME = /^(?:home|होम|घर)$/;
  const TARGET = /^(?:news|dialog|box|page|screen|window|result|results|weather|music|math|player|karo|kar|do|jao|चलो|करो|दो|जाओ)$/;

  const rest = words.filter((w) => !FILLER.test(w));
  if (!rest.length) return null;
  if (!rest.every((w) => CLOSE.test(w) || HOME.test(w) || TARGET.test(w))) return null;

  if (rest.some((w) => HOME.test(w))) return "home";
  if (rest.some((w) => CLOSE.test(w))) return "back";
  return null;
}

function isTakePhotoCommandPhrase(value) {
  const phrase = String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /\b(?:take|click|capture|snap)\s+(?:(?:a|my|the)\s+)?(?:photo|picture|pic|selfie)\b/.test(phrase) ||
    /\b(?:meri|apni)\s+(?:photo|tasveer)\s+(?:lo|khicho|kheencho)\b|\b(?:photo|tasveer)\s+(?:lo|khicho|kheencho)\b/.test(phrase);
}

function parsePhotoSearchQuery(value) {
  const phrase = String(value || "")
    .normalize("NFKC")
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+please$/, "")
    .trim();
  const command = phrase.match(/^(?:(?:please|hey atlas|atlas)\s+)?(?:show|display|find|get|give|send|fetch|search(?:\s+for)?)\s+(?:(?:me|us)\s+)?(?:(?:a|an|the|some)\s+)?(?:photos?|pictures?|images?|pics?|photographs?)(?:\s+(?:of|for|showing))?(?:\s+(.+?))?$/i);
  if (command) return (command[1] || "").replace(/^(?:a|an|the)\s+/i, "").trim();

  const subjectFirst = phrase.match(/^(?:show|give|display|find)\s+(?:me\s+)?(.+?)\s+(?:photo|picture|image|pic)$/i);
  if (subjectFirst) return subjectFirst[1].replace(/^(?:a|an|the)\s+/i, "").trim();

  const direct = phrase.match(/^(?:photo|picture|image)\s+of\s+(.+)$/i);
  if (direct) return direct[1].replace(/^(?:a|an|the)\s+/i, "").trim();

  if (/^(?:photo|picture|image|tasveer)\s+(?:dikhao|dikhaiye)$/i.test(phrase)) return "";

  const hinglish = phrase.match(/^(.+?)\s+(?:ki\s+)?(?:photo|tasveer)\s+(?:dikhao|dikhaiye|dikhana)$/i);
  if (hinglish) return hinglish[1].replace(/^(?:a|an|the)\s+/i, "").trim();

  return null;
}

function isHindiMusicCommand(value) {
  const phrase = String(value || "").toLowerCase();
  return /(?:गाना|गाने|गीत|संगीत|म्यूजिक|gaana|gana|geet|music)/i.test(phrase) &&
    /(?:बजाओ|बजाइए|चलाओ|चलाइए|सुनाओ|सुनाइए|लगाओ|चला दो|bajao|bajaiye|chalao|chala do|sunao|lagao|play)/i.test(phrase);
}

function isWeatherCommand(value) {
  const phrase = String(value || "").toLowerCase();
  return matchesWeatherTerms(phrase) ||
    /(?:मौसम|तापमान|बारिश|वर्षा|मौसम कैसा)/.test(phrase);
}

function detectLanguagePreference(value) {
  const phrase = String(value || "").toLowerCase();
  const wantsHindi = /\b(hindi|hindee)\b|हिंदी|हिन्दी/.test(phrase);
  const wantsEnglish = /\b(english|englis|angrezi)\b|अंग्रेज़ी|अंग्रेजी|इंग्लिश/.test(phrase);

  if (wantsHindi === wantsEnglish) return null;
  return wantsHindi ? "hi" : "en";
}

// =========================================================
// APP
// =========================================================

function App() {
  const [showMusic, setShowMusic] = useState(false);
  const [songToPlay, setSongToPlay] = useState(null);
  const [musicPrompt, setMusicPrompt] = useState("");

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
      !showNewsRef.current &&
      !showPhotoPreviewRef.current
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
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoCaptureError, setPhotoCaptureError] = useState("");
  const [newsQuery, setNewsQuery] = useState("latest news");
  const [mathResult, setMathResult] = useState(null);
  const [weatherLocation, setWeatherLocation] = useState("Greater Noida");
  const [weatherCoords, setWeatherCoords] = useState(null);
  const [weatherQuery, setWeatherQuery] = useState({
    day: "today",
    timeOfDay: "all-day",
    intent: "overview",
  });

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
  const pendingPhotoCaptureRef = useRef(false);
  const takePhotoRef = useRef(null);
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
  const lastWeatherContextRef = useRef(null);
  const latestNewsContextRef = useRef({ articles: [], query: "", fetchedAt: "" });
  const activeNewsArticleIndexRef = useRef(0);
  const musicClarificationRef = useRef(false);
  const wakeRestartTimerRef = useRef(null);
  const wakeSessionIdRef = useRef(0);

  // Always-current mirrors of showMusic/showWeather, used inside
  // setTimeout/speech callbacks so they never read a stale value
  // from the render that created the closure.
  const showMusicRef = useRef(false);
  const showWeatherRef = useRef(false);
  const showMathRef = useRef(false);
  const showNewsRef = useRef(false);
  const showPhotoPreviewRef = useRef(false);
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
    showPhotoPreviewRef.current = showPhotoPreview;
  }, [showPhotoPreview]);

  useEffect(() => {
    showResultsRef.current = showResults;
  }, [showResults]);

  const handleBack = () => {
    const hasActiveView =
      showNewsRef.current ||
      showNews ||
      showPhotoPreviewRef.current ||
      showPhotoPreview ||
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
    } else if (showPhotoPreviewRef.current || showPhotoPreview) {
      pendingPhotoCaptureRef.current = false;
      setShowPhotoPreview(false);
      setPhotoUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return "";
      });
      setStatus(getLanguagePack(languageRef.current).systemStatus.waitingWake);
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
    setStatus(getLanguagePack(languageRef.current).systemStatus.waitingWake);
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
    pendingPhotoCaptureRef.current = false;
    setShowPhotoPreview(false);
    setPhotoCaptureError("");
    setPhotoUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return "";
    });
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
    setStatus(getLanguagePack(languageRef.current).systemStatus.waitingWake);
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
      if (event.key === "Escape") {
        handleHomeRef.current();
        return;
      }
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
    const request = parseMusicRequest(question, languageRef.current);
    if (!request) return false;

    const pack = getLanguagePack(languageRef.current);
    isProcessingRef.current = true;
    setShowMusic(true);
    musicClarificationRef.current = false;

    if (request.type === "clarify") {
      const prompt = languageRef.current === "hi"
        ? "Aap kaunsa gaana sunna chahenge?"
        : "Which song would you like me to play?";
      musicControlsRef.current?.clear?.();
      setSongToPlay(null);
      setMusicPrompt(prompt);
      setStatus(prompt.toUpperCase());
      speak(prompt, languageRef.current, () => {
        musicClarificationRef.current = true;
      });
      return true;
    }

    setMusicPrompt("");
    if (request.type === "open") {
      setSongToPlay(null);
      setStatus(pack.systemStatus.musicSystem);
      return true;
    }

    console.log("ATLAS MUSIC SEARCH:", request.query);
    setSongToPlay(request.query);
    setStatus(pack.systemStatus.searchingMusic + ": " + request.query.toUpperCase());

    return true;
  };

  // =========================================================
  // LOCAL NEWS CORE — ZERO LLM REQUESTS
  // =========================================================

  const handleNewsCommand = (question) => {
    if (!isNewsQuestion(question)) return false;

    console.log("ATLAS: LIVE NEWS CORE → DIRECT NEWS RELAY");

    latestNewsContextRef.current = { articles: [], query: question, fetchedAt: "" };
    activeNewsArticleIndexRef.current = 0;
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

      const explainMath = /\b(?:explain|show (?:the )?(?:steps|working|work)|step by step|how did you solve|show your work)\b/i.test(question);
      setMathResult(explainMath ? result : { ...result, steps: [] });
      setShowMath(true);
      setUserText(question);
      setAiText("");
      setResult(null);
      setShowResults(false);
      setStatus(pack.systemStatus.mathActive);
      isProcessingRef.current = true;

      const oldSpoken =
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
      const spoken = mathResultToSpeech(result, explainMath) || oldSpoken;
      setTimeout(() => speak(spoken, "en", null, true), 80);

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

    const MAX_ATTEMPTS = 4;
    const RETRY_DELAY_MS = 8000;
    const RETRYABLE_STATUSES = [502, 503, 504];

    const sleep = (ms) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const response = await fetch(
            "https://atlas-ai-1wd9.onrender.com/api/ask",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal,
              body: JSON.stringify({ question, language: "en" }),
            },
          );

          if (response.ok) {
            return await response.json();
          }

          // Server waking up or temporarily down: retry
          if (
            RETRYABLE_STATUSES.includes(response.status) &&
            attempt < MAX_ATTEMPTS
          ) {
            console.warn(
              `ATLAS: backend returned ${response.status}, retrying (${attempt}/${MAX_ATTEMPTS})...`,
            );
            await sleep(RETRY_DELAY_MS);
            continue;
          }

          throw new Error("Failed to connect to ATLAS backend");
        } catch (innerError) {
          if (signal?.aborted) throw innerError;

          // Network-level failure (e.g. CORS error on a 502): retry too
          if (attempt < MAX_ATTEMPTS) {
            console.warn(
              `ATLAS: request failed, retrying (${attempt}/${MAX_ATTEMPTS})...`,
            );
            await sleep(RETRY_DELAY_MS);
            continue;
          }

          throw innerError;
        }
      }
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

  const speak = (
    text,
    outputLanguage = languageRef.current,
    onComplete = null,
    readAllSentences = false,
  ) => {
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

    const cleanText = text
      .replace(/\n+/g, ". ")
      .replace(/(\d)\.(\d)/g, "$1<DECIMAL>$2")
      .replace(/\s+/g, " ")
      .trim();

    const allSentences = cleanText.match(/[^.!?।]+[.!?।]+/g) || [cleanText];

    // Keep spoken answers brief. The complete answer remains visible on the
    // Results page; voice playback only reads the first two sentences.
    const MAX_SPOKEN_SENTENCES = readAllSentences ? 6 : 2;
    const sentences = allSentences
      .slice(0, MAX_SPOKEN_SENTENCES)
      .map((sentence) => sentence.replace(/<DECIMAL>/g, "."));

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

  const handleNewsFollowUp = async (question) => {
    const context = latestNewsContextRef.current;
    const fetchedTime = Date.parse(context?.fetchedAt || "");
    if (!context?.articles?.length || (Number.isFinite(fetchedTime) && Date.now() - fetchedTime > 30 * 60 * 1000)) return false;

    const phrase = String(question || "").toLowerCase().trim();
    if (!/(?:\bexplain\b|\bwhy\b|\bimportant\b|\b(?:who|what person) (?:is|was) involved\b|\bwhen did (?:this|that|it) happen\b|\bsource\b|\bfirst one\b|\bsecond one\b|\bthird one\b|\bnumber (?:one|two|three)\b|\bthat story\b|\bthis story\b)/i.test(phrase)) {
      return false;
    }

    const ordinal = phrase.match(/\b(first|1st|one|second|2nd|two|third|3rd|three)\b/);
    if (ordinal) {
      const ordinalIndexes = { first: 0, "1st": 0, one: 0, second: 1, "2nd": 1, two: 1, third: 2, "3rd": 2, three: 2 };
      activeNewsArticleIndexRef.current = ordinalIndexes[ordinal[1]] ?? 0;
    }

    const article = context.articles[activeNewsArticleIndexRef.current] || context.articles[0];
    const index = context.articles.indexOf(article);
    const isHindi = languageRef.current === "hi";
    const wantsSource = /\bsource\b|where did this come from|show me the link/i.test(phrase);
    const wantsWhen = /\bwhen\b|what date|what time/i.test(phrase);
    let answer = "";

    if (wantsSource) {
      answer = article.url
        ? isHindi
          ? `${article.source ? `यह खबर ${article.source} से है। ` : ""}मूल स्रोत का लिंक स्क्रीन पर दिखाया है।`
          : `${article.source ? `This article is from ${article.source}. ` : ""}I’ve displayed the original source link on screen.`
        : isHindi
          ? `“${article.title}” के लिए स्रोत लिंक उपलब्ध नहीं है।`
          : `The source link is not available for “${article.title}”.`;
    } else if (wantsWhen) {
      answer = article.publishedAt
        ? isHindi
          ? `यह लेख ${new Date(article.publishedAt).toLocaleString("hi-IN", { dateStyle: "long", timeStyle: "short" })} को प्रकाशित हुआ था। घटना का समय इससे अलग हो सकता है।`
          : `This article was published ${new Date(article.publishedAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}. That may differ from when the event itself happened.`
        : isHindi
          ? "इस लेख में प्रकाशित होने की तारीख नहीं दी गई है, इसलिए मैं इसकी पुष्टि नहीं कर सकता।"
          : "The article does not include a publication date, so I can’t confirm when it was published.";
    } else {
      setStatus(getLanguagePack(languageRef.current).systemStatus.processing);
      isProcessingRef.current = true;
      try {
        const data = await fetchNewsFollowUp(
          question,
          {
            title: article.title,
            description: article.description,
            source: article.source,
            publishedAt: article.publishedAt,
            url: article.url,
          },
          languageRef.current,
        );
        answer = data.answer || "I couldn’t get a grounded explanation from this article.";
      } catch (error) {
        console.warn("ATLAS NEWS FOLLOW-UP:", error);
        answer = article.description
          ? `The article says: ${article.description}`
          : `I don’t have enough detail in this headline to explain it reliably: ${article.title}`;
      }
    }

    const relatedLinks = article.url
      ? [{ title: article.source || "Original news source", url: article.url, description: article.title }]
      : [];
    const result = {
      title: article.title,
      answer,
      paragraphs: [answer],
      keyFacts: [`Story ${index + 1} of ${context.articles.length}`, ...(article.source ? [`Source: ${article.source}`] : [])],
      relatedLinks,
      imageQuery: "",
      imageUrl: article.image || "",
      modelUsed: wantsSource || wantsWhen ? "LIVE NEWS CONTEXT" : "GROUNDED NEWS ASSISTANT",
    };

    setUserText(question);
    setAiText(answer);
    setResult(result);
    setShowNews(false);
    setShowResults(true);
    setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
    isProcessingRef.current = true;
    speak(answer, languageRef.current);
    return true;
  };

  const capturePhoto = useCallback(() => {
    pendingPhotoCaptureRef.current = false;
    setPhotoCaptureError("");
    speechSessionRef.current += 1;
    window.speechSynthesis.cancel();
    speechQueueRef.current = [];
    speechIndexRef.current = 0;
    setSpeaking(false);
    setShowNews(false);
    setShowResults(false);
    setResult(null);
    setAiText("");
    setUserText("");
    setShowWeather(false);
    setShowMath(false);
    setMathResult(null);
    setShowMusic(false);
    setSongToPlay(null);
    setShowPhotoPreview(false);
    isProcessingRef.current = true;

    const video = presenceVideoRef.current;
    if (!presenceVideoReady || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
      pendingPhotoCaptureRef.current = true;
      setShowPhotoPreview(true);
      if (!presenceArmed) {
        setPresenceDetected(false);
        setPresenceArmed(true);
      }
      setStatus("CAMERA STARTING // READYING PHOTO CAPTURE");
      return true;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setShowPhotoPreview(true);
      setPhotoCaptureError("Photo capture failed. Please try again.");
      setStatus("PHOTO CAPTURE FAILED // CAMERA UNAVAILABLE");
      isProcessingRef.current = false;
      return true;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setShowPhotoPreview(true);
        setPhotoCaptureError("Photo capture failed. Please try again.");
        setStatus("PHOTO CAPTURE FAILED // TRY AGAIN");
        isProcessingRef.current = false;
        return;
      }

      const capturedUrl = URL.createObjectURL(blob);
      setPhotoUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return capturedUrl;
      });
      setShowPhotoPreview(true);
      setStatus("PHOTO CAPTURED // SAVED TO DOWNLOADS");
      isProcessingRef.current = false;

      const download = document.createElement("a");
      download.href = capturedUrl;
      download.download = `atlas-photo-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
      document.body.appendChild(download);
      download.click();
      download.remove();
    }, "image/jpeg", 0.94);

    return true;
  }, [presenceArmed, presenceVideoReady]);

  takePhotoRef.current = capturePhoto;

  useEffect(() => {
    if (presenceVideoReady && pendingPhotoCaptureRef.current) {
      takePhotoRef.current?.();
    }
  }, [presenceVideoReady, capturePhoto]);

  const closePhotoPreview = () => {
    pendingPhotoCaptureRef.current = false;
    setShowPhotoPreview(false);
    setPhotoCaptureError("");
    setPhotoUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return "";
    });
    isProcessingRef.current = false;
    setStatus(getLanguagePack(languageRef.current).systemStatus.waitingWake);
    setTimeout(() => startWakeWordDetection(), 300);
  };

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

    if (await handleNewsFollowUp(question)) return;

    const recentWeather = lastWeatherContextRef.current;
    const weatherContextIsFresh = recentWeather && Date.now() - recentWeather.updatedAt < 10 * 60 * 1000;
    const unresolvedWeatherPlace = /\bweather\s+(?:there|in that place)\b|\b(?:there|that place)'s weather\b/i.test(lowerQuestion);
    let clarification = "";
    if (/\bcapital of (?:a )?banana\b/i.test(lowerQuestion)) {
      clarification = "A banana is not a place with a capital city. Did you mean to ask about a country or city?";
    } else if (/\bwhat(?:'s| is) the colou?r of (?:the )?number \d+\b/i.test(lowerQuestion)) {
      clarification = "Numbers do not have a color by themselves. Are you asking about a colored digit, a number in an image, or a visual pattern?";
    } else if (/\b(?:potato|chair)\b/i.test(lowerQuestion) && /\b(?:calculate|divide|divided|multiply|times|plus|minus)\b/i.test(lowerQuestion)) {
      clarification = "I can calculate expressions with numbers, but “potato” and “chair” are not numeric values. Which numbers should I use?";
    } else if (unresolvedWeatherPlace && !weatherContextIsFresh) {
      clarification = "Which city or location should I check the weather for?";
    } else if (/^(?:search it|search that|look it up|find it)[?.!]*$/i.test(lowerQuestion)) {
      clarification = "What would you like me to search for? Please tell me the topic or item.";
    } else if (/^(?:what does it mean|what does that mean|what is it|what is that)[?.!]*$/i.test(lowerQuestion)) {
      clarification = "Which word or thing are you asking about? Tell me the word or name and I’ll explain it.";
    } else if (/^(?:tell me about him|tell me about her|tell me about them|who is he|who is she)[?.!]*$/i.test(lowerQuestion)) {
      clarification = "Who do you mean? Please share the person’s name or a little more context.";
    } else if (/\bweather\b/i.test(lowerQuestion) && /\b(?:without|don't|do not|no) (?:(?:use|using) )?(?:the )?internet\b/i.test(lowerQuestion)) {
      clarification = "A live forecast needs an online weather service. I won’t make up forecast data; I can check it if you want me to use the weather service.";
    }

    if (clarification) {
      questionAbortRef.current?.abort();
      questionAbortRef.current = null;
      const clarificationResult = {
        title: "A quick clarification",
        answer: clarification,
        paragraphs: [clarification],
        keyFacts: [], relatedLinks: [], imageQuery: "", imageUrl: "",
        modelUsed: "ATLAS CLARIFICATION",
      };
      setUserText(question);
      setAiText(clarification);
      setResult(clarificationResult);
      setShowResults(true);
      setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
      isProcessingRef.current = true;
      speak(clarification, languageRef.current);
      return;
    }

    if (isTakePhotoCommandPhrase(question)) {
      capturePhoto();
      return;
    }

    const imageSearchQuery = parsePhotoSearchQuery(question);
    if (imageSearchQuery !== null) {
      questionAbortRef.current?.abort();
      questionAbortRef.current = null;
      setShowNews(false);
      setShowWeather(false);
      setShowMath(false);
      setShowPhotoPreview(false);
      setShowMusic(false);
      setShowResults(false);
      setResult(null);
      setUserText(question);
      setAiText("");

      if (!imageSearchQuery) {
        const answer = "What should I find a photo of?";
        setResult({
          title: "PHOTO SEARCH",
          answer,
          paragraphs: [answer],
          imageQuery: "",
          imageUrl: "",
          modelUsed: "ATLAS IMAGE SEARCH",
        });
        setShowResults(true);
        setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
        isProcessingRef.current = true;
        speak(answer, "en");
        return;
      }

      setStatus("SEARCHING FREE PHOTO ARCHIVE");
      isProcessingRef.current = true;
      const controller = new AbortController();
      questionAbortRef.current = controller;

      try {
        const photo = await searchAtlasImage(imageSearchQuery, controller.signal);
        if (controller.signal.aborted || questionGeneration !== questionGenerationRef.current) return;
        questionAbortRef.current = null;

        const credit = [photo.artist, photo.license].filter(Boolean).join(" / ");
        const answer = photo.imageUrl
          ? `Photo of ${imageSearchQuery}${credit ? ` / ${credit}` : ""} / Wikimedia Commons`
          : `No photo found for ${imageSearchQuery}.`;
        setResult({
          title: `PHOTO // ${imageSearchQuery.toUpperCase()}`,
          answer,
          paragraphs: [answer],
          keyFacts: [],
          relatedLinks: [],
          imageQuery: imageSearchQuery,
          imageUrl: photo.imageUrl || "",
          sourceUrl: photo.sourceUrl || "",
          modelUsed: "ATLAS IMAGE SEARCH",
        });
        setAiText(answer);
        setShowResults(true);
        setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
        speak(photo.imageUrl ? `Here is a photo of ${imageSearchQuery}.` : answer, "en");
      } catch (error) {
        if (controller.signal.aborted || questionGeneration !== questionGenerationRef.current) return;
        questionAbortRef.current = null;
        const answer = error?.message || "The free photo search is unavailable right now.";
        setResult({
          title: "PHOTO SEARCH",
          answer,
          paragraphs: [answer],
          imageQuery: imageSearchQuery,
          imageUrl: "",
          modelUsed: "ATLAS IMAGE SEARCH",
        });
        setAiText(answer);
        setShowResults(true);
        setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
        speak(answer, "en");
      }
      return;
    }

    const knowledgeResult = getAtlasKnowledgeResult(question);
    if (knowledgeResult) {
      questionAbortRef.current?.abort();
      questionAbortRef.current = null;
      setUserText(question);
      setAiText(knowledgeResult.answer);
      setResult(knowledgeResult);
      setShowResults(true);
      setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
      isProcessingRef.current = true;
      speak(knowledgeResult.answer, "en");
      return;
    }

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

    const weatherFollowUp = weatherContextIsFresh && /^(?:tomorrow|today|kal|aaj|in\s+.+|at\s+.+|for\s+.+)[?.!]*$/i.test(lowerQuestion);
    if (isWeatherCommand(question) || weatherFollowUp) {
      console.log("ATLAS: WEATHER COMMAND");
      const parsedWeather = parseWeatherQuestion(question);
      const onlyDayFollowUp = weatherFollowUp && /^(?:tomorrow|today|kal|aaj)[?.!]*$/i.test(lowerQuestion);
      const onlyLocationFollowUp = weatherFollowUp && /^(?:in|at|for)\s+.+[?.!]*$/i.test(lowerQuestion);
      const weatherRequest = weatherFollowUp
        ? {
            ...recentWeather.request,
            day: onlyLocationFollowUp ? recentWeather.request.day : parsedWeather.day,
            timeOfDay: recentWeather.request.timeOfDay,
            intent: recentWeather.request.intent,
            location: onlyDayFollowUp
              ? recentWeather.request.location
              : parsedWeather.location || recentWeather.request.location,
          }
        : parsedWeather;
      const location = weatherRequest.location;
      lastWeatherContextRef.current = { request: weatherRequest, updatedAt: Date.now() };
      setWeatherQuery(weatherRequest);

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

    const dictionaryRequest = parseDictionaryQuestion(question);
    if (dictionaryRequest) {
      const { word: dictionaryWord, intent: dictionaryIntent, secondWord } = dictionaryRequest;
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
            dictionaryIntent,
            secondWord,
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
          intent: dictionaryIntent,
          ...(secondWord ? { secondWord } : {}),
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
    if (showPhotoPreviewRef.current) return;
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
        showPhotoPreviewRef.current ||
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
          !showPhotoPreviewRef.current &&
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

    // Keep the microphone session open across short pauses. Browsers do not
    // expose a silence-duration setting for SpeechRecognition, so we use the
    // continuous mode and submit only after a longer quiet window.
    recognition.continuous = true;

    recognition.interimResults = true;

    let latestTranscript = "";
    let submitTimer = null;
    let questionSubmitted = false;

    const submitQuestion = () => {
      if (questionSubmitted) return;
      const transcript = latestTranscript.trim();
      if (!transcript) return;

      questionSubmitted = true;
      if (submitTimer) clearTimeout(submitTimer);
      submitTimer = null;
      setListening(false);
      isProcessingRef.current = true;
      try {
        recognition.stop();
      } catch (error) {
        console.log("Question recognition stop:", error);
      }
      processQuestion(transcript);
    };

    recognition.onstart = () => {
      setListening(true);

      setStatus(getLanguagePack(languageRef.current).systemStatus.listening);

      setUserText("");

      setAiText("");

      setResult(null);

      setShowResults(false);
    };

    recognition.onresult = (event) => {
      const parts = [];
      for (let i = 0; i < event.results.length; i++) {
        parts.push(event.results[i][0].transcript);
      }
      latestTranscript = parts.join(" ").replace(/\s+/g, " ").trim();
      if (!latestTranscript) return;

      console.log("Question in progress:", latestTranscript);

      // These curated answers need no extra silence debounce once the browser
      // has finalized the full recognized phrase. Other questions keep the
      // longer pause window so users can finish their thought.
      let allResultsFinal = event.results.length > 0;
      for (let i = 0; i < event.results.length; i++) {
        if (!event.results[i].isFinal) {
          allResultsFinal = false;
          break;
        }
      }
      if (allResultsFinal && getAtlasKnowledgeResult(latestTranscript)) {
        submitQuestion();
        return;
      }

      if (submitTimer) clearTimeout(submitTimer);
      submitTimer = setTimeout(submitQuestion, 2200);
    };

    recognition.onerror = (event) => {
      console.log("Question recognition error:", event.error);

      setListening(false);

      recognitionRef.current = null;

      if (latestTranscript.trim()) {
        if (submitTimer) clearTimeout(submitTimer);
        submitTimer = setTimeout(submitQuestion, 2200);
        return;
      }

      if (submitTimer) clearTimeout(submitTimer);

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
      // A browser may close a continuous recognition session on its own.
      // Keep any recognized words and let the quiet-window timer submit them.
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      if (!questionSubmitted && latestTranscript.trim()) {
        if (submitTimer) clearTimeout(submitTimer);
        submitTimer = setTimeout(submitQuestion, 2200);
      } else if (!questionSubmitted) {
        setListening(false);
      }
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
      showMusic || showWeather || showMath || showNews || showPhotoPreview || showResults;
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
    let lastNavTime = 0;

    const startDialogListener = () => {
      if (disposed) return;
      let navigationTriggered = false;

      // Only one SpeechRecognition instance should own the microphone.
      // When a dialog is open, this command listener takes ownership.
      wakeSessionIdRef.current += 1;
      if (wakeWordRecognitionRef.current) {
        try { wakeWordRecognitionRef.current.stop(); } catch {}
        wakeWordRecognitionRef.current = null;
      }
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

      recognition.onresult = async (event) => {
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

            // INSTANT NAVIGATION: fires on interim speech, tolerates common
            // mishearings, and aborts the recognizer so we never wait for a
            // final result.
            const nav = getInstantNavCommand(phrase);
            if (nav) {
              const now = Date.now();
              if (now - lastNavTime < 800) return; // ignore duplicate interim results
              lastNavTime = now;
              console.log("ATLAS INSTANT NAV:", nav, "<=", phrase);
              window.speechSynthesis.cancel(); // silence ATLAS right away
              try { recognition.abort(); } catch {} // abort = no waiting for final result
              if (nav === "home" || showResultsRef.current) {
                handleHomeRef.current();
              } else {
                handleBackRef.current();
              }
              return;
            }

            if (result.isFinal && parsePhotoSearchQuery(phrase) !== null) {
              console.log("ATLAS COMMAND MATCH: PHOTO SEARCH");
              navigationTriggered = true;
              try { recognition.stop(); } catch {}
              processQuestion(phrase);
              return;
            }

            if (isTakePhotoCommandPhrase(phrase)) {
              console.log("ATLAS COMMAND MATCH: TAKE PHOTO");
              takePhotoRef.current?.();
              return;
            }

            // Navigation always takes priority over player commands.
            if (isHomeCommandPhrase(phrase)) {
              console.log("ATLAS COMMAND MATCH: HOME");
              navigationTriggered = true;
              try { recognition.stop(); } catch {}
              handleHomeRef.current();
              return;
            }

            if (isBackCloseCommandPhrase(phrase)) {
              console.log("ATLAS COMMAND MATCH: BACK/CLOSE", phrase);
              navigationTriggered = true;
              try { recognition.stop(); } catch {}
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

            const selectedNewsTitle = latestNewsContextRef.current.articles?.[activeNewsArticleIndexRef.current]?.title;
            const newsResultIsOpen = showResultsRef.current && result?.title === selectedNewsTitle;
            if (result.isFinal && (showNewsRef.current || newsResultIsOpen) && await handleNewsFollowUp(commandPhrase)) {
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

              if (result.isFinal && controls.search) {
                const musicRequest = parseMusicRequest(command, languageRef.current, true);
                const followUpQuery = musicRequest?.type === "search"
                  ? musicRequest.query
                  : musicClarificationRef.current
                    ? command
                    : "";
                if (followUpQuery.trim()) {
                  musicClarificationRef.current = false;
                  setMusicPrompt("");
                  controls.search(followUpQuery);
                  setStatus(
                    `${getLanguagePack(languageRef.current).systemStatus.searchingMusic}: ${followUpQuery.toUpperCase()}`,
                  );
                  return;
                }
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
        // Always restart unless this effect has been cleaned up, so the
        // listener never goes deaf after a command.
        if (!disposed) {
          restartTimer = setTimeout(startDialogListener, 50);
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
  }, [showMusic, showWeather, showMath, showNews, showPhotoPreview, showResults, result?.title]);

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
    // Accept the language keyword as soon as it appears in interim speech;
    // waiting for a finalized utterance makes this simple choice feel slow.
    recognition.interimResults = true;
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
      const transcript = Array.from(event.results || [])
        .map((result) => result?.[0]?.transcript || "")
        .join(" ")
        .trim();
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
      if (pendingPhotoCaptureRef.current || showPhotoPreviewRef.current) {
        setStatus("CAMERA READY // PHOTO CAPTURE");
        return;
      }
      setStatus("PERSON DETECTED — CAMERA PREVIEW ON");
      const greeting = getLanguagePack("en").greeting;
      setAiText(greeting);
      speak(greeting, "en", askLanguagePreference);
    },
    onUnavailable: (error) => {
      console.warn("ATLAS PRESENCE CAMERA UNAVAILABLE:", error);
      if (pendingPhotoCaptureRef.current) {
        setPhotoCaptureError("Camera access is unavailable. Check browser camera permission, then try again.");
      }
      pendingPhotoCaptureRef.current = false;
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

        <p>A TOTALLY LEGENDARY AI SYSTEM</p>

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

      {presenceArmed && result?.modelUsed !== "ATLAS IMAGE SEARCH" && (
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
          clarificationPrompt={musicPrompt}
          onClose={() => {
            setShowMusic(false);

            setSongToPlay(null);
            setMusicPrompt("");
            musicClarificationRef.current = false;

            isProcessingRef.current = false;

            setStatus(getLanguagePack(languageRef.current).systemStatus.waitingWake);

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
          query={weatherQuery}
          onWeatherReady={(summary) => {
            setStatus(getLanguagePack(languageRef.current).systemStatus.speaking);
            speak(summary, languageRef.current);
          }}
          onClose={() => {
            setShowWeather(false);

            isProcessingRef.current = false;

            setStatus(getLanguagePack(languageRef.current).systemStatus.waitingWake);

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
            setStatus(getLanguagePack(languageRef.current).systemStatus.waitingWake);
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
          onNewsLoaded={(data) => {
            latestNewsContextRef.current = {
              articles: data?.articles || [],
              query: data?.query || newsQuery,
              fetchedAt: data?.fetchedAt || "",
            };
            activeNewsArticleIndexRef.current = 0;
          }}
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
            setStatus(getLanguagePack(languageRef.current).systemStatus.waitingWake);
            setTimeout(() => {
              startWakeWordDetection();
            }, 80);
          }}
        />
      )}

      {showPhotoPreview && (
        <PhotoPreview
          photoUrl={photoUrl}
          error={photoCaptureError}
          loading={!photoUrl}
          onClose={closePhotoPreview}
          onRetake={() => takePhotoRef.current?.()}
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

          <main className={`results-page${result.modelUsed === "ATLAS IMAGE SEARCH" ? " atlas-image-only-page" : ""}`}>
            <div className="results-header">
              <div className="results-label">
                {result.modelUsed === "ATLAS KNOWLEDGE CORE"
                  ? "ATLAS QUICK KNOWLEDGE"
                  : "INTELLIGENCE REPORT"}
              </div>

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
                  className={`results-content${result.featureList ? " features-content" : ""}${result.modelUsed === "ATLAS KNOWLEDGE CORE" ? " knowledge-content" : ""}`}
                >
                  {result.modelUsed === "ATLAS IMAGE SEARCH" ? (
                    <p>
                      {result.sourceUrl ? (
                        <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">{result.answer}</a>
                      ) : result.answer}
                    </p>
                  ) : result.featureList?.length ? (
                    <ul className="feature-list">
                      {result.featureList.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                  ) : result.knowledgePoints?.length ? (
                    <ul className="knowledge-points">
                      {result.knowledgePoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  ) : (
                    (result.paragraphs || []).map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))
                  )}

                  {result.answer &&
                    !result.featureList?.length &&
                    !result.knowledgePoints?.length &&
                    (!result.paragraphs || result.paragraphs.length === 0) && (
                      <p>{result.answer}</p>
                    )}
                </div>

                {result.modelUsed === "ATLAS IMAGE SEARCH" && (
                  <button className="atlas-image-return" type="button" onClick={() => handleHomeRef.current()}>
                    ← BACK TO ATLAS
                  </button>
                )}

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
                    {result.modelUsed === "ATLAS KNOWLEDGE CORE"
                      ? "Answered instantly from Atlas’s built-in knowledge."
                      : "ATLAS // concise answer from connected AI."}
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
                <small>A TOTALLY</small>

                <h2>
                  A.T.L.A.S <span>3K</span>
                </h2>

                <small>LEGENDARY AI SYSTEM</small>
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
                  <button
                    type="button"
                    className="quick-btn"
                    onClick={() => {
                      if (!isProcessingRef.current) {
                        processQuestion("Take my photo");
                      }
                    }}
                  >
                    <span className="quick-btn-dot" />
                    Take Pic
                  </button>
                </div>
              </div>
            </aside>

            <section className="dashboard-center">
              <AtlasGlobe
                listening={listening}
                speaking={speaking}
                thinking={
                  status === lang.systemStatus.processing ||
                  status === lang.systemStatus.weatherSystem ||
                  status === lang.systemStatus.searchingMusic
                }
                answerReady={showResults && Boolean(result)}
              />

              <div className={`voice-status${status === lang.systemStatus.processing ? " is-thinking" : ""}`}>
                <span className="voice-status-label">{status}</span>
                {status === lang.systemStatus.processing && (
                  <span className="thinking-indicator" aria-hidden="true">
                    <i /><i /><i />
                  </span>
                )}
              </div>

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