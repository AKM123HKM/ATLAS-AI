import React from "react";
import "./LanguageToggle.css";

function LanguageToggle({ language, onChange }) {
  return (
    <div className="language-toggle-wrapper">
      <div className="language-toggle">

        <button
          type="button"
          className={`language-option ${
            language === "en" ? "active" : ""
          }`}
          onClick={() => onChange("en")}
          aria-label="Switch to English"
        >
          <span className="language-code">EN</span>
          <span className="language-name">English</span>
        </button>

        <div className="language-divider" />

        <button
          type="button"
          className={`language-option ${
            language === "hi" ? "active" : ""
          }`}
          onClick={() => onChange("hi")}
          aria-label="Switch to Hindi"
        >
          <span className="language-code">हि</span>
          <span className="language-name">हिन्दी</span>
        </button>

      </div>
    </div>
  );
}

export default LanguageToggle;