// =========================================================
// A.T.L.A.S — ENGLISH LANGUAGE PACK
// Every user-facing string ATLAS can show or speak, in English.
// Keep this file's shape identical to hindi.js — languageManager
// and App.jsx both assume the two packs mirror each other.
// =========================================================

const english = {
  code: "en",
  speechLang: "en-US",
  toggleLabel: "ENGLISH",

  systemStatus: {
    init: "SYSTEM INITIALIZING",
    waitingWake: "WAITING FOR HELLO",
    wakeDetected: "WAKE WORD DETECTED",
    listening: "LISTENING",
    noQuestion: "NO QUESTION DETECTED",
    voiceError: "VOICE ERROR",
    micDenied: "MICROPHONE ACCESS DENIED",
    processing: "ANALYZING QUESTION",
    speaking: "SPEAKING",
    weatherSystem: "WEATHER SYSTEM",
    musicSystem: "MUSIC SYSTEM",
    searchingMusic: "SEARCHING MUSIC",
    mathActive: "MATH CORE ACTIVE",
    mathError: "MATH CORE — LOCAL ONLY",
    unsupported: "VOICE RECOGNITION UNSUPPORTED",
    ready: "READY",
    output: "OUTPUT",
    music: "MUSIC",
    weather: "WEATHER",
    math: "MATH",
  },

  greeting: "Hello.",

  readMoreOnScreen: "The full details are on your screen.",

  voiceHintIdle: 'Tap to speak · say "Hello"',
  voiceHintListening: "Listening...",

  // Phrases the wake-word listener matches against, lowercased.
  wakeWords: [
    "namaste",
    "namaste atlas",
    "hey atlas",
    "hello atlas",
    "hello",
    "hey at last",
    "hey atlas 3k",
    "okay atlas",
    "okay at least",
    "ok atlas",
  ],

  math: {
    answerIs: (value) => `The answer is ${value}.`,
    solutionIs: (parts) => `The solution is ${parts}.`,
    noRealSolution: "I could not find a real solution.",
    analysisComplete: "The mathematical analysis is complete.",
    couldNotSolve:
      "I could not solve that locally. No AI request was sent.",
    equalsPart: (variable, value) => `${variable} equals ${value}`,
  },

  weather: {
    fallbackCity: "Greater Noida",
  },

  connectionError: {
    title: "Connection Error",
    answer: "I am unable to connect to my intelligence core right now.",
    paragraph: "The ATLAS intelligence service could not be reached.",
  },

  local: {
    whoAreYou: {
      title: "A.T.L.A.S 3K",
      answer:
        "I am A.T.L.A.S 3K, an Advanced Technology and Learning Assistant System. I am a voice-based AI assistant created by Ansh Sharma Student of 10th St. Jospeh's School.",
      paragraphs: [
        "I am A.T.L.A.S 3K, an Advanced Technology and Learning Assistant System.",
        "I am designed to interact with users through voice, answer questions, provide information, and present knowledge through an interactive futuristic interface.",
      ],
      keyFacts: [
        "Voice-based AI assistant",
        "Designed for interactive learning",
        "Built by AnshCoder",
      ],
    },

    whatCanYouDo: {
      title: "ATLAS CAPABILITIES",
      answer:
        "I can listen to your questions through voice, process your requests, answer general knowledge and science questions, and present information through my visual interface, you can study news, take photos, know about weather forecast and more to explore",
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
    },

    whoCreatedYou: {
      title: "ATLAS ORIGIN",
      answer:
        "I was created by Ansh Sharma of class 10th A for the Exhibition project as an experimental voice-based learning assistant that automates your Work life.",
      paragraphs: [
        "I was created as part of the A.T.L.A.S 3K exhibition project. by Ansh Sharma",
        "The project combines voice interaction, artificial intelligence and a futuristic visual interface to create a more interactive way of accessing information.",
      ],
      keyFacts: [
        "A.T.L.A.S 3K exhibition project",
        "Voice-based interaction",
        "Focused on learning and information",
      ],
    },

    greetingReply: {
      title: "ATLAS",
      answer: "Hello",
      paragraphs: ["Hello", "How can I assist you?"],
    },

    thankYou: {
      title: "ATLAS",
      answer: "You're welcome. I am always ready for your next question.",
      paragraphs: [
        "You're welcome.",
        "I am always ready for your next question.",
      ],
    },
  },
};

export default english;
