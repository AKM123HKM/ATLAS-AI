import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import "./NewsDialog.css";

import {
  fetchLatestNews,
  newsToSpeech,
} from "./newsEngine";

function formatTime(value, language = "en") {
  if (!value)
    return "TIME UNKNOWN";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleTimeString(
    language === "hi" ? "hi-IN" : "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatDate(value, language = "en") {
  if (!value) return "";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    language === "hi" ? "hi-IN" : "en-US",
    {
      day: "2-digit",
      month: "short",
    }
  );
}

const categoryLabels = {
  general: "WORLD",
  india: "INDIA",
  technology: "TECHNOLOGY",
  science: "SCIENCE",
  business: "BUSINESS",
  sports: "SPORTS",
  entertainment:
    "ENTERTAINMENT",
  health: "HEALTH",
  politics: "POLITICS",
  world: "WORLD",
};

export default function NewsDialog({
  query = "latest news",
  language = "en",
  onClose,
  onSpeak,
  onNewsLoaded,
}) {
  const onSpeakRef = useRef(onSpeak);
  onSpeakRef.current = onSpeak;
  const onNewsLoadedRef = useRef(onNewsLoaded);
  onNewsLoadedRef.current = onNewsLoaded;

  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadNews =
    useCallback(
      async (isRefresh = false) => {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const result =
            await fetchLatestNews(
              query,
              { language }
            );

          setData(result);
          onNewsLoadedRef.current?.(result);

          if (
            !isRefresh &&
            onSpeak
          ) {
            onSpeakRef.current?.(
              newsToSpeech(result, language)
            );
          }
        } catch (err) {
          console.error(
            "ATLAS NEWS ERROR:",
            err
          );

          setError(
            err?.message ||
              "Unable to connect to the live news feed."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [query, language]
    );

  useEffect(() => {
    loadNews(false);

    const handleVoiceRefresh =
      () => loadNews(true);

    window.addEventListener(
      "atlas-news-refresh",
      handleVoiceRefresh
    );

    return () =>
      window.removeEventListener(
        "atlas-news-refresh",
        handleVoiceRefresh
      );
  }, [loadNews]);

  const articles =
    data?.articles || [];

  const category =
    data?.category ||
    "general";
  const isHindi = language === "hi";
  const hindiCategoryLabels = {
    general: "देश और दुनिया",
    world: "दुनिया",
    india: "भारत",
    technology: "तकनीक",
    science: "विज्ञान",
    business: "व्यापार",
    sports: "खेल",
    entertainment: "मनोरंजन",
    health: "स्वास्थ्य",
    politics: "राजनीति",
  };

  return (
    <div className="atlas-news-overlay">
      <div className="atlas-news-panel">

        <div className="atlas-news-topline" />

        <header className="atlas-news-header">
          <div>
            <div className="atlas-news-eyebrow">
              {isHindi ? "A.T.L.A.S // लाइव समाचार" : "A.T.L.A.S // LIVE INTELLIGENCE FEED"}
            </div>

            <h2>
              {isHindi ? "ताज़ा समाचार" : "LATEST NEWS"}
            </h2>

            <div className="atlas-news-subline">
              <span className="atlas-news-live-dot" />

              {isHindi ? "लाइव स्रोत // GOOGLE NEWS RSS" : "LIVE SOURCE // GOOGLE NEWS RSS // NO LLM REQUEST"}
            </div>
          </div>

          <button
            className="atlas-news-close"
            onClick={onClose}
            aria-label={isHindi ? "समाचार बंद करें" : "Close news"}
          >
            ×
          </button>
        </header>

        <div className="atlas-news-toolbar">

          <div className="atlas-news-scope">
            <span>
              {isHindi ? "श्रेणी" : "CHANNEL"}
            </span>

            <strong>
              {(isHindi ? hindiCategoryLabels[category] : categoryLabels[category]) || category.toUpperCase()}
            </strong>
          </div>

          <div
            className="atlas-news-query"
            title={query}
          >
            <span>
              {isHindi ? "आपकी खोज" : "QUERY"}
            </span>

            <strong>
              {query}
            </strong>
          </div>

          <button
            className={`atlas-news-refresh ${
              refreshing
                ? "is-refreshing"
                : ""
            }`}
            onClick={() =>
              loadNews(true)
            }
            disabled={
              loading ||
              refreshing
            }
          >
            {isHindi ? "↻ फिर से लोड करें" : "↻ REFRESH"}
          </button>
        </div>

        <main className="atlas-news-body">

          {loading ? (
            <div className="atlas-news-state">

              <div className="atlas-news-loader">
                <span />
                <span />
                <span />
              </div>

              <strong>
                {isHindi ? "ताज़ा सुर्खियाँ खोज रहे हैं" : "SCANNING LIVE HEADLINES"}
              </strong>

              <small>
                {isHindi ? "ATLAS समाचार सेवा से जुड़ रहे हैं..." : "CONNECTING TO ATLAS NEWS RELAY..."}
              </small>
            </div>

          ) : error ? (

            <div className="atlas-news-state atlas-news-error">

              <div className="atlas-news-error-code">
                {isHindi ? "समाचार // 503" : "NEWS // 503"}
              </div>

              <strong>
                {isHindi ? "समाचार अभी उपलब्ध नहीं हैं" : "LIVE FEED UNAVAILABLE"}
              </strong>

              <small>
                {error}
              </small>

              <button
                onClick={() =>
                  loadNews(true)
                }
              >
                {isHindi ? "फिर से प्रयास करें" : "RETRY FEED"}
              </button>
            </div>

          ) : articles.length ===
            0 ? (

            <div className="atlas-news-state">

              <strong>
                {isHindi ? "कोई सुर्ख़ी नहीं मिली" : "NO HEADLINES FOUND"}
              </strong>

              <small>
                {isHindi
                  ? "‘आज की ताज़ा खबरें’, ‘तकनीक की खबरें’ या ‘भारत की खबरें’ कहकर खोजें।"
                  : 'Try “latest news”, “latest technology news”, or “latest India news”.'}
              </small>

            </div>

          ) : (

            <div className="atlas-news-grid">

              {articles.map(
                (
                  article,
                  index
                ) => (

                  <article
                    className={`atlas-news-card ${
                      index === 0
                        ? "atlas-news-card-featured"
                        : ""
                    }`}
                    key={`${article.url}-${index}`}
                  >

                    <div className="atlas-news-card-index">
                      {String(
                        index + 1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </div>

                    <div className="atlas-news-card-meta">

                      <span>
                        {article.source || (isHindi ? "समाचार स्रोत" : "NEWS SOURCE")}
                      </span>

                      <span>
                        {formatDate(
                          article.publishedAt,
                          language
                        )}{" "}
                        {formatTime(
                          article.publishedAt,
                          language
                        )}
                      </span>

                    </div>

                    <h3>
                      {article.title}
                    </h3>

                    {article.description && (
                      <p>
                        {article.description}
                      </p>
                    )}

                    <div className="atlas-news-card-footer">

                      <span>
                      {isHindi ? "लाइव खबर" : "LIVE ARTICLE"}
                      </span>

                      {article.url && (
                        <a
                          href={
                            article.url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {isHindi ? "स्रोत खोलें ↗" : "OPEN SOURCE ↗"}
                        </a>
                      )}

                    </div>

                  </article>
                )
              )}

            </div>
          )}

        </main>

        <footer className="atlas-news-footer">
          <span>
            {isHindi ? "ATLAS समाचार // लाइव फ़ीड" : "ATLAS NEWS RELAY // DIRECT FEED"}
          </span>

          <span>
            {data?.fetchedAt
              ? `${isHindi ? "अपडेट" : "UPDATED"} ${formatTime(data.fetchedAt, language)}`
              : isHindi ? "फ़ीड लोड हो रही है" : "ACQUIRING FEED"}
          </span>
        </footer>

      </div>
    </div>
  );
}
