const API_BASE = String(
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_ATLAS_API_URL) ||
  "https://atlas-ai-1wd9.onrender.com",
).replace(/\/+$/, "");

export async function searchAtlasImage(query, signal) {
  const response = await fetch(
    `${API_BASE}/api/images/search?query=${encodeURIComponent(query)}`,
    { signal },
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "The photo search service is unavailable.");
  }

  return data;
}
