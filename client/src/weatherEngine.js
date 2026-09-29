const WEATHER_TERMS =
  /\b(?:weather|climate|temperature|forecast|rain|raining|rainy|cloudy|clouds|hot|cold|mausam|taapmaan|tapman|barish|baarish|barsaat|garmi|thand)\b/i;

export function isWeatherCommand(value) {
  return WEATHER_TERMS.test(String(value || ""));
}

const LOCATION_FILLERS =
  /\b(?:atlas|please|tell|me|what|whats|how|hows|is|are|it|the|weather|climate|temperature|forecast|rain|raining|rainy|cloudy|clouds|hot|cold|mausam|taapmaan|tapman|barish|baarish|barsaat|garmi|thand|today|tomorrow|tonight|morning|afternoon|evening|now|currently|right|aaj|kal|subah|shaam|abhi|ka|ki|ke|mein|me|par|bata|batao|bataiye|dikhao|dikhaiye|check|karo|kya|kaisa|kaisi|hai|hoga|hogi|rahega|rahegi|chances|chance|toh|to|hog|hain|kitna|kitni|degree|degrees|going|be|do|we|expect|outside|there|like|next|few|day|days|week)\b/gi;

function cleanLocation(candidate) {
  return String(candidate || "")
    .replace(/[?!.,;:]+/g, " ")
    .replace(LOCATION_FILLERS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findLocation(phrase) {
  const patterns = [
    /\b(?:weather|climate|temperature|forecast)\s+(?:in|for|at|of)\s+(.+?)\s*$/i,
    /\b(?:in|for|at)\s+(.+?)\s*$/i,
    /^(.+?)\s+(?:ka|ki|ke)\s+(?:aaj\s+)?(?:weather|mausam|forecast|temperature|baarish|barish)\b/i,
    /^(.+?)\s+(?:mein|me)\s+(?:aaj\s+)?(?:weather|mausam|rain|baarish|barish)\b/i,
    /^(.+?)\s+(?:weather|mausam|forecast|temperature)\b/i,
    /\b(?:in|for|at)\s+(.+?)\s+(?:ka|ki|ke)\s+(?:weather|mausam)\b/i,
  ];

  for (const pattern of patterns) {
    const match = phrase.match(pattern);
    const location = cleanLocation(match?.[1]);
    if (location) return location;
  }

  return "";
}

export function parseWeatherQuestion(value) {
  const phrase = String(value || "").toLowerCase().replace(/[’']/g, "");
  const day = /\b(?:tomorrow|kal)\b/.test(phrase) ? "tomorrow" : "today";
  const timeOfDay = /\b(?:now|currently|right now|abhi)\b/.test(phrase)
    ? "now"
    : /\b(?:morning|subah)\b/.test(phrase)
      ? "morning"
      : /\b(?:evening|tonight|shaam)\b/.test(phrase)
        ? "evening"
        : "all-day";
  const intent = /\b(?:rain|raining|rainy|barish|baarish|barsaat)\b/.test(phrase)
    ? "rain"
    : /\b(?:cloudy|clouds)\b/.test(phrase)
      ? "clouds"
      : /\b(?:temperature|hot|cold|garmi|thand|taapmaan|tapman)\b/.test(phrase)
        ? "temperature"
        : "overview";

  return {
    location: findLocation(phrase),
    day,
    timeOfDay,
    intent,
  };
}
