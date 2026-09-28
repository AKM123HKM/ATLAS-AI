export function isAtlasFeaturesQuestion(input) {
  const question = String(input || "")
    .toLocaleLowerCase()
    .replace(/[?!.,؛،]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const englishPatterns = [
    /\b(?:tell me about|tell nme about|describe|list|show me) (?:all )?(?:your |atlas(?:'s)? )?features?\b/i,
    /\bwhat (?:are|is) (?:your |atlas(?:'s)? )?features?\b/i,
    /\bwhat features do you have\b/i,
    /\bwhat can (?:you|atlas) do\b/i,
    /\bwhat all can you do\b/i,
  ];

  if (englishPatterns.some((pattern) => pattern.test(question))) return true;

  const hindiPatterns = [
    /(?:आप|तुम|एटलस).{0,35}(?:क्या कर सकते|क्या कर सकता|सुविधा|विशेषता)/u,
    /(?:आपकी|तुम्हारी|एटलस की).{0,25}(?:सुविधा|विशेषता)/u,
    /(?:सुविधा|विशेषता).{0,25}(?:बताओ|बताइए|क्या है|क्या हैं)/u,
    /(?:atlas|aap|tum).{0,30}(?:features?|suvidha|khoobiya|kya kar sakte|kya kar sakta)/i,
    /(?:features?|suvidha|khoobiya).{0,25}(?:batao|bataiye|kya hai|kya hain)/i,
  ];

  return hindiPatterns.some((pattern) => pattern.test(question));
}

export function getAtlasFeaturesResult(language) {
  const isHindi = language === "hi";
  const answer = isHindi
    ? "एटलस अंग्रेज़ी और हिंदी में आवाज़ से बातचीत करता है, शुरुआत में भाषा पूछता है, सवालों के जवाब मुख्य तथ्यों, तस्वीरों और उपयोगी लिंक के साथ दिखाता है और संक्षिप्त सार बोलता है। यह चरणों सहित गणित हल करता है, स्थानीय मौसम और अंग्रेज़ी या हिंदी समाचार दिखाता है, संगीत के चलाएँ, रोकें, अगला और पिछला आदेश मानता है, पीछे या बंद आदेश से होम पर लौटता है, और कैमरा अनुमति मिलने पर तीन सेकंड चेहरा देखकर लाइव पूर्वावलोकन दिखाता है; कैमरा बंद करने का नियंत्रण भी देता है।"
    : "Atlas supports English and Hindi voice interaction, asks your language preference at startup, answers questions with key facts, images and useful links, and speaks a short summary. It also solves math with steps, shows local weather and English or Hindi headlines, follows music play, pause, next and previous commands, returns home on back or close, and can greet you after three seconds of on-device face detection with a live camera preview you can turn off.";
  const spokenAnswer = isHindi
    ? "एटलस अंग्रेज़ी और हिंदी में सवालों के जवाब देता है, और समाचार, मौसम, गणित, संगीत तथा कैमरा पहचान की सुविधा देता है।"
    : "Atlas answers questions in English and Hindi, and offers news, weather, math, music, and camera presence detection.";
  const featureList = isHindi
    ? [
        "अंग्रेज़ी और हिंदी में आवाज़ से बातचीत; शुरुआत में अपनी भाषा चुनें।",
        "सवालों के जवाब मुख्य तथ्यों, तस्वीरों और उपयोगी लिंक के साथ देखें; Atlas संक्षिप्त सार बोलता है।",
        "गणित के सवाल चरणों सहित हल करें।",
        "किसी जगह का स्थानीय मौसम पूछें।",
        "अंग्रेज़ी और हिंदी में ताज़ा समाचार की सुर्खियाँ सुनें और देखें।",
        "संगीत चलाएँ, रोकें, अगला या पिछला गाना चलाएँ।",
        "‘Back’ या ‘Close’ कहकर Atlas के होम पेज पर लौटें।",
        "कैमरा अनुमति के बाद, तीन सेकंड चेहरा पहचानने पर स्वागत और लाइव कैमरा पूर्वावलोकन; कैमरा बंद करने का नियंत्रण उपलब्ध है।",
      ]
    : [
        "Speak with Atlas in English or Hindi; choose your preferred language at startup.",
        "Get answers with key facts, images and useful links; Atlas speaks a short summary.",
        "Solve math questions with step-by-step working.",
        "Ask for local weather in a location.",
        "See and hear the latest English or Hindi news headlines.",
        "Control music with play, pause, next and previous commands.",
        "Say ‘back’ or ‘close’ to return to the Atlas home page.",
        "Allow the camera for a greeting after three seconds of face detection; a live preview and camera-off control are available.",
      ];

  return {
    title: isHindi ? "A.T.L.A.S की सुविधाएँ" : "A.T.L.A.S Features",
    answer,
    spokenAnswer,
    paragraphs: [],
    featureList,
    keyFacts: [],
    relatedLinks: [],
    imageQuery: "",
    imageUrl: "",
    modelUsed: "ATLAS FEATURES",
    language: isHindi ? "hi" : "en",
  };
}
