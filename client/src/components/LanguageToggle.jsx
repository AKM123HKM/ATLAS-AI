import "./LanguageToggle.css";

// =========================================================
// A.T.L.A.S — LANGUAGE TOGGLE
// Controlled component: App.jsx owns `language` state and
// passes it down, same pattern as every other piece of shared
// state in this app (showMusic, showWeather, etc.)
// =========================================================

export default function LanguageToggle({ language, onChange }) {
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <span
        className="lang-toggle-thumb"
        style={{
          transform:
            language === "hi" ? "translateX(100%)" : "translateX(0%)",
        }}
      />

      <button
        type="button"
        className={`lang-toggle-btn ${
          language === "en" ? "lang-active" : ""
        }`}
        onClick={() => onChange("en")}
      >
        ENGLISH
      </button>

      <button
        type="button"
        className={`lang-toggle-btn ${
          language === "hi" ? "lang-active" : ""
        }`}
        onClick={() => onChange("hi")}
      >
        हिन्दी
      </button>
    </div>
  );
}