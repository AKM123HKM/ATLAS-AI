import { useEffect, useRef, useState } from "react";
import "./MusicPlayer.css";

import song1 from "./music/bairan.mp3";
import song2 from "./music/safar.mp3";
import song3 from "./music/forareason.mp3";

const songs = [
  {
    id: 1,
    title: "Bairan",
    artist: "Banjaare",
    src: song1,
    aliases: [
      "bairan",
      "barren",
      "bairen",
      "byran",
      "byron",
      "biran",
    ],
  },
  {
    id: 2,
    title: "Safar",
    artist: "Bayaan",
    src: song2,
    aliases: [
      "safar",
      "suffer",
      "saffer",
      "safarh",
    ],
  },
  {
    id: 3,
    title: "For a Reason",
    artist: "Karan Aujla",
    src: song3,
    aliases: [
      "for a reason",
      "for the reason",
      "for reason",
    ],
  },
];

export default function MusicPlayer({ onClose, songToPlay }) {
  const audioRef = useRef(null);

  const [currentSong, setCurrentSong] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // =========================================================
  // FIND SONG FROM songToPlay
  // =========================================================

  useEffect(() => {
    if (!songToPlay) return;

    const requestedSong = songToPlay
      .toLowerCase()
      .trim();

    console.log(
      "MUSIC PLAYER RECEIVED:",
      requestedSong
    );

    const foundSong = songs.find((song) =>
      song.aliases.some((alias) =>
        requestedSong.includes(alias)
      )
    );

    if (foundSong) {
      console.log(
        "MUSIC PLAYER FOUND:",
        foundSong.title
      );

      setCurrentSong(foundSong);
    } else {
      console.log(
        "MUSIC PLAYER: SONG NOT FOUND:",
        requestedSong
      );
    }
  }, [songToPlay]);

  // =========================================================
  // PLAY SONG WHEN currentSong CHANGES
  // =========================================================

  useEffect(() => {
    if (!audioRef.current || !currentSong) {
      return;
    }

    const audio = audioRef.current;

    console.log(
      "ATLAS PLAYING:",
      currentSong.title
    );

    audio.pause();

    audio.src = currentSong.src;

    audio.load();

    setProgress(0);
    setPlaying(false);

    const playSong = async () => {
      try {
        await audio.play();

        setPlaying(true);

        console.log(
          "ATLAS AUDIO PLAYING:",
          currentSong.title
        );
      } catch (error) {
        console.error(
          "ATLAS AUDIO PLAY ERROR:",
          error
        );

        setPlaying(false);
      }
    };

    playSong();
  }, [currentSong]);

  // =========================================================
  // MANUAL SONG SELECTION
  // =========================================================

  const selectSong = (song) => {
    console.log(
      "MANUAL SONG SELECTED:",
      song.title
    );

    setCurrentSong(song);
  };

  // =========================================================
  // PLAY / PAUSE
  // =========================================================

  const togglePlay = async () => {
    if (!audioRef.current || !currentSong) {
      return;
    }

    const audio = audioRef.current;

    if (playing) {
      audio.pause();
      setPlaying(false);

      return;
    }

    try {
      await audio.play();

      setPlaying(true);
    } catch (error) {
      console.error(
        "PLAY BUTTON ERROR:",
        error
      );

      setPlaying(false);
    }
  };

  // =========================================================
  // UPDATE PROGRESS
  // =========================================================

  const updateProgress = () => {
    if (!audioRef.current) {
      return;
    }

    const duration = audioRef.current.duration;

    if (!duration || isNaN(duration)) {
      return;
    }

    const percent =
      (audioRef.current.currentTime / duration) * 100;

    setProgress(percent || 0);
  };

  // =========================================================
  // SEEK
  // =========================================================

  const seek = (event) => {
    if (!audioRef.current) {
      return;
    }

    const value = Number(event.target.value);

    const duration = audioRef.current.duration;

    if (!duration || isNaN(duration)) {
      return;
    }

    audioRef.current.currentTime =
      (value / 100) * duration;
  };

  // =========================================================
  // AUDIO ENDED
  // =========================================================

  const handleEnded = () => {
    setPlaying(false);
    setProgress(100);
  };

  // =========================================================
  // CLOSE PLAYER
  // =========================================================

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setPlaying(false);

    if (onClose) {
      onClose();
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="music-overlay">

      <div className="music-window">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="music-header">

          <div>
            <span className="music-label">
              A.T.L.A.S AUDIO SYSTEM
            </span>

            <h2>
              Music Library
            </h2>
          </div>

          <button
            className="music-close"
            onClick={handleClose}
          >
            ×
          </button>

        </div>

        {/* =================================================
            BODY
        ================================================= */}

        <div className="music-body">

          {/* =================================================
              CURRENT SONG
          ================================================= */}

          <div className="album-section">

            <div
              className={`album-orb ${
                playing
                  ? "album-playing"
                  : ""
              }`}
            >

              <div className="album-core">
                ♪
              </div>

            </div>

            {currentSong ? (
              <>
                <h3>
                  {currentSong.title}
                </h3>

                <p>
                  {currentSong.artist}
                </p>
              </>
            ) : (
              <>
                <h3>
                  Select a song
                </h3>

                <p>
                  A.T.L.A.S local audio library
                </p>
              </>
            )}

            {/* =================================================
                PROGRESS
            ================================================= */}

            <input
              className="music-progress"
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={seek}
            />

            {/* =================================================
                CONTROLS
            ================================================= */}

            <div className="music-controls">

              <button
                className="play-button"
                disabled={!currentSong}
                onClick={togglePlay}
              >
                {playing
                  ? "Ⅱ"
                  : "▶"}
              </button>

            </div>

          </div>

          {/* =================================================
              SONG LIST
          ================================================= */}

          <div className="song-list">

            <div className="song-list-title">
              LOCAL LIBRARY
            </div>

            {songs.map((song, index) => (

              <button
                key={song.id}
                className={`song-item ${
                  currentSong?.id === song.id
                    ? "song-active"
                    : ""
                }`}
                onClick={() =>
                  selectSong(song)
                }
              >

                <span className="song-number">
                  {String(index + 1).padStart(
                    2,
                    "0"
                  )}
                </span>

                <span className="song-icon">
                  {currentSong?.id === song.id &&
                  playing
                    ? "♫"
                    : "♪"}
                </span>

                <span className="song-info">

                  <strong>
                    {song.title}
                  </strong>

                  <small>
                    {song.artist}
                  </small>

                </span>

                <span className="song-arrow">
                  →
                </span>

              </button>

            ))}

          </div>

        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="music-footer">

          <span>
            LOCAL PLAYBACK
          </span>

          <span>
            NO NETWORK REQUIRED
          </span>

        </div>

        {/* =================================================
            AUDIO ELEMENT
        ================================================= */}

        <audio
          ref={audioRef}
          onTimeUpdate={updateProgress}
          onEnded={handleEnded}
        />

      </div>

    </div>
  );
}