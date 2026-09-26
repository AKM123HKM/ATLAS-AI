import {
  useCallback,
  useEffect,
  useState,
} from "react";

import "./NewsDialog.css";

import {
  fetchLatestNews,
  newsToSpeech,
} from "./newsEngine";

function formatTime(value) {
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
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatDate(value) {
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
    [],
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
  onClose,
  onSpeak,
}) {
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
              { limit: 10 }
            );

          setData(result);

          if (
            !isRefresh &&
            onSpeak
          ) {
            onSpeak(
              newsToSpeech(result)
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
      [query, onSpeak]
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

  return (
    <div className="atlas-news-overlay">
      <div className="atlas-news-panel">

        <div className="atlas-news-topline" />

        <header className="atlas-news-header">
          <div>
            <div className="atlas-news-eyebrow">
              A.T.L.A.S // LIVE INTELLIGENCE FEED
            </div>

            <h2>
              LATEST NEWS
            </h2>

            <div className="atlas-news-subline">
              <span className="atlas-news-live-dot" />

              LIVE SOURCE // GOOGLE NEWS RSS // NO LLM REQUEST
            </div>
          </div>

          <button
            className="atlas-news-close"
            onClick={onClose}
            aria-label="Close news"
          >
            ×
          </button>
        </header>

        <div className="atlas-news-toolbar">

          <div className="atlas-news-scope">
            <span>
              CHANNEL
            </span>

            <strong>
              {
                categoryLabels[
                  category
                ] ||
                  category.toUpperCase()
              }
            </strong>
          </div>

          <div
            className="atlas-news-query"
            title={query}
          >
            <span>
              QUERY
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
            ↻ REFRESH
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
                SCANNING LIVE HEADLINES
              </strong>

              <small>
                CONNECTING TO ATLAS NEWS RELAY...
              </small>
            </div>

          ) : error ? (

            <div className="atlas-news-state atlas-news-error">

              <div className="atlas-news-error-code">
                NEWS // 503
              </div>

              <strong>
                LIVE FEED UNAVAILABLE
              </strong>

              <small>
                {error}
              </small>

              <button
                onClick={() =>
                  loadNews(true)
                }
              >
                RETRY FEED
              </button>
            </div>

          ) : articles.length ===
            0 ? (

            <div className="atlas-news-state">

              <strong>
                NO HEADLINES FOUND
              </strong>

              <small>
                Try “latest news”,
                “latest technology
                news”, or “latest
                India news”.
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
                        {article.source ||
                          "NEWS SOURCE"}
                      </span>

                      <span>
                        {formatDate(
                          article.publishedAt
                        )}{" "}
                        {formatTime(
                          article.publishedAt
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
                        LIVE ARTICLE
                      </span>

                      {article.url && (
                        <a
                          href={
                            article.url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          OPEN SOURCE ↗
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
            ATLAS NEWS RELAY // DIRECT FEED
          </span>

          <span>
            {data?.fetchedAt
              ? `UPDATED ${formatTime(
                  data.fetchedAt
                )}`
              : "ACQUIRING FEED"}
          </span>
        </footer>

      </div>
    </div>
  );
}