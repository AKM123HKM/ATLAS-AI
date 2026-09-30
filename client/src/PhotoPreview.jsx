import { useState } from "react";
import "./PhotoPreview.css";

export default function PhotoPreview({ photoUrl, error = "", loading = false, onClose, onRetake }) {
  const [zoom, setZoom] = useState(1);
  const filename = `atlas-photo-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;

  return (
    <section className="atlas-photo-overlay" role="dialog" aria-modal="true" aria-label="Captured photo">
      <div className="atlas-photo-panel">
        <header className="atlas-photo-header">
          <div>
            <span className="atlas-photo-kicker">A.T.L.A.S // CAMERA CAPTURE</span>
            <h2>{error ? "CAPTURE UNAVAILABLE" : loading ? "PREPARING CAMERA" : "PHOTO CAPTURED"}</h2>
          </div>
          <span className="atlas-photo-saved"><i /> {error ? "ACTION REQUIRED" : loading ? "CAMERA INITIALIZING" : "SAVED TO DOWNLOADS"}</span>
        </header>

        <div className="atlas-photo-stage">
          {error ? (
            <div className="atlas-photo-loading atlas-photo-error">{error}</div>
          ) : photoUrl ? (
            <img src={photoUrl} alt="Photo captured by Atlas" style={{ transform: `scale(${zoom})` }} />
          ) : (
            <div className="atlas-photo-loading"><span /> Align yourself in the camera preview</div>
          )}
          <span className="atlas-photo-corner atlas-photo-corner-tl" />
          <span className="atlas-photo-corner atlas-photo-corner-tr" />
          <span className="atlas-photo-corner atlas-photo-corner-bl" />
          <span className="atlas-photo-corner atlas-photo-corner-br" />
        </div>

        <div className="atlas-photo-tools">
          {photoUrl && (
            <>
              <div className="atlas-photo-zoom" aria-label="Photo zoom controls">
                <button type="button" onClick={() => setZoom((value) => Math.max(1, +(value - 0.25).toFixed(2)))} aria-label="Zoom out">−</button>
                <span>{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom((value) => Math.min(2.5, +(value + 0.25).toFixed(2)))} aria-label="Zoom in">+</button>
                <input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Adjust photo zoom" />
              </div>
              <a className="atlas-photo-action atlas-photo-download" href={photoUrl} download={filename}>DOWNLOAD PHOTO</a>
              <button className="atlas-photo-action" type="button" onClick={onRetake}>TAKE ANOTHER</button>
            </>
          )}
          {error && <button className="atlas-photo-action" type="button" onClick={onRetake}>TRY AGAIN</button>}
          <button className="atlas-photo-action atlas-photo-back" type="button" onClick={onClose}>← BACK TO GLOBE</button>
        </div>
        <p className="atlas-photo-hint">{error ? "ENABLE CAMERA ACCESS IN YOUR BROWSER SETTINGS TO CONTINUE" : loading ? "CAMERA ACCESS IS REQUIRED TO TAKE A PHOTO" : "SAY “BACK” OR “GO HOME” TO RETURN TO ATLAS"}</p>
      </div>
    </section>
  );
}
