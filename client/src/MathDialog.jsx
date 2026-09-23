import "./MathDialog.css";

export default function MathDialog({ result, onClose }) {
  if (!result) return null;

  return (
    <div className="atlas-math-overlay">
      <div className="atlas-math-panel">

        <div className="atlas-math-header">
          <div>
            <div className="atlas-math-eyebrow">
              A.T.L.A.S // LOCAL COMPUTATION CORE
            </div>

            <h2>
              {result.title || "MATHEMATICS"}
            </h2>
          </div>

          <button
            className="atlas-math-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="atlas-math-status">
          <span className="atlas-math-dot" />
          MATHJS ENGINE // ONLINE // NO AI REQUEST
        </div>

        <div className="atlas-math-expression">
          <span>INPUT</span>

          <strong>
            {result.expression}
          </strong>
        </div>

        <div className="atlas-math-result">
          <span>RESULT</span>

          <strong>
            {result.result}
          </strong>
        </div>

        {result.steps?.length > 0 && (
          <div className="atlas-math-steps">

            <div className="atlas-math-section-title">
              COMPUTATION SEQUENCE
            </div>

            {result.steps.map(
              (step, index) => (
                <div
                  className="atlas-math-step"
                  key={index}
                >
                  <span>
                    {String(index + 1).padStart(
                      2,
                      "0"
                    )}
                  </span>

                  <p>{step}</p>
                </div>
              )
            )}
          </div>
        )}

      </div>
    </div>
  );
}