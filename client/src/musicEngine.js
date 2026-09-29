const PLAY_ACTION =
  /\b(?:play|put on|start|listen to|lagao|laga|chalao|chala do|sunao|bajao|bajaiye|sunaao)\b|(?:बजाओ|बजाइए|चलाओ|चलाइए|सुनाओ|सुनाइए|लगाओ)/i;
const MUSIC_WORD =
  /\b(?:song|songs|music|track|gaana|gana|gaane|geet|bhajan|playlist)\b|(?:गाना|गाने|गीत|संगीत|भजन)/i;

const KNOWN_ARTISTS = [
  { pattern: /\bkishore(?:\s+kumar)?\b/i, name: "Kishore Kumar" },
  { pattern: /\blata(?:\s+(?:ji|mangeshkar))?\b/i, name: "Lata Mangeshkar" },
  { pattern: /\barijit(?:\s+singh)?\b/i, name: "Arijit Singh" },
  { pattern: /\bmohammed\s+rafi\b|\braffi\b/i, name: "Mohammed Rafi" },
  { pattern: /\bmukesh\b/i, name: "Mukesh" },
  { pattern: /\ba\.\s*r\.\s*rahman\b|\b(?:a\s*r|ar)\s+rahman\b/i, name: "A. R. Rahman" },
  { pattern: /\bkaran\s+aujla\b/i, name: "Karan Aujla" },
];

const isGenericRequest = (phrase) =>
  !phrase ||
  /\b(?:something|anything|popular|best|good|nice|koi|kuch)\b/i.test(phrase);

export function parseMusicRequest(value, preferredLanguage = "en", allowImplicitRequest = false) {
  const phrase = String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’']/g, "")
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const openPlayer =
    /\b(?:open|show|launch)\s+(?:the\s+)?music(?:\s+player)?\b/i.test(phrase) ||
    /^music player$/.test(phrase);
  const hasPlayAction = PLAY_ACTION.test(phrase);
  const hasMusicWord = MUSIC_WORD.test(phrase);
  if (/\b(?:play|put on|start) (?:that|it|the other) song\b/i.test(phrase)) {
    return { type: "clarify", query: "" };
  }
  const isHinglishRequest = /\b(?:gaana|gana|gaane|geet|bajao|bajaiye|chalao|sunao|koi|purana|purane|purani)\b|(?:गाना|गाने|गीत|बजाओ|बजाइए|चलाओ|सुनाओ|कोई|पुराना|पुराने|पुरानी)/i.test(phrase);
  const implicitMusicRequest = allowImplicitRequest && (
    hasMusicWord ||
    KNOWN_ARTISTS.some(({ pattern }) => pattern.test(phrase)) ||
    /\b(?:hindi|english|bollywood|romantic|relaxing|energetic|study|bhajan|patriotic|purana|90s)\b/i.test(phrase)
  );
  if (!openPlayer && !implicitMusicRequest && !(hasPlayAction && (hasMusicWord || phrase.length > 0))) {
    return null;
  }

  if (/\b(?:favorite|favourite|pasandida)\b|(?:पसंदीदा)/i.test(phrase)) {
    return { type: "clarify", query: "" };
  }
  if (openPlayer && !hasPlayAction) return { type: "open", query: "" };

  const language = /\b(?:hindi|hindee)\b|हिंदी|हिन्दी/i.test(phrase)
    ? "Hindi"
    : /\b(?:english|angrezi)\b|अंग्रेज़ी|अंग्रेजी/i.test(phrase)
      ? "English"
      : "";
  const artist = KNOWN_ARTISTS.find(({ pattern }) => pattern.test(phrase))?.name;
  const decade = phrase.match(/\b(?:19)?(?:50|60|70|80|90)s\b/i)?.[0];
  const mood = /\b(?:relaxing|relax|calm|peaceful|soothing|chill)\b/i.test(phrase)
    ? "relaxing"
    : /\b(?:energetic|energy|upbeat|dance|workout)\b/i.test(phrase)
      ? "energetic"
      : /\b(?:study|studying|focus|concentrate)\b/i.test(phrase)
        ? "study focus instrumental"
        : "";
  const oldSongs = /\b(?:old|classic|purana|purane|purani|retro)\b|(?:पुराना|पुराने|पुरानी)/i.test(phrase);
  const romantic = /\b(?:romantic|love|romance)\b|(?:रोमांटिक)/i.test(phrase);
  const devotional = /\b(?:bhajan|bhakti|devotional)\b|(?:भजन|भक्ति)/i.test(phrase);
  const patriotic = /\b(?:patriotic|deshbhakti|national)\b|(?:देशभक्ति)/i.test(phrase);
  const bollywood = /\bbollywood\b/i.test(phrase);

  let query = "";
  // Resolve the common Arijit Singh request to a specific, recognizable song
  // instead of leaving the result up to broad artist-search ranking.
  if (artist === "Arijit Singh") query = "Kesariya Arijit Singh Brahmastra";
  else if (artist) query = `${artist} songs`;
  else if (devotional) query = "Hindi bhajan devotional songs";
  else if (patriotic) query = "Indian patriotic songs";
  else if (decade) query = `${decade} Hindi songs`;
  else if (oldSongs) query = `old ${language || "Hindi"} songs`;
  else if (romantic) query = `romantic ${language || "Hindi"} songs`;
  else if (mood === "study focus instrumental") query = "study focus instrumental music";
  else if (mood) query = `${mood} ${language || "Hindi"} music`;
  else if (bollywood) query = "Bollywood songs";
  else if (language) query = `${language} songs`;

  if (!query) {
    const searchTerms = phrase
      .replace(/\b(?:hey|could you|can you|would you|please|play|put on|start|listen to|the|a|an|some|something|anything|song|songs|music|track|gaana|gana|gaane|geet|bajao|bajaiye|chalao|chala do|sunao|lagao|laga|koi|ek|kuch|mast|sa|bhai|atlas|ji|ka|ki|ke|mein|me|par|by|you|could|can|would)\b/gi, " ")
      .replace(/(?:गाना|गाने|गीत|संगीत|बजाओ|बजाइए|चलाओ|चलाइए|सुनाओ|सुनाइए|लगाओ|कोई|एक|भजन|का|की|के|जी)/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const generic = !searchTerms || isGenericRequest(searchTerms);
    if (!generic) query = `${searchTerms} songs`;
  }

  if (!query) {
    query = preferredLanguage === "hi" || isHinglishRequest
      ? "popular Hindi songs"
      : "popular songs";
  }

  return { type: "search", query };
}
