import { useEffect, useRef, useState } from "react";
import "./MusicPlayer.css";

import song1 from "./music/bairan.mp3";
import song2 from "./music/safar.mp3";
import song3 from "./music/forareason.mp3";

// =========================================================
// OFFLINE / LOCAL LIBRARY (works with zero internet connection —
// kept as a guaranteed fallback for the exhibition floor)
// =========================================================

const localSongs = [
  {
    id: "local-1",
    title: "Bairan",
    artist: "Banjaare",
    src: song1,
    aliases: ["bairan", "barren", "bairen", "byran", "byron", "biran"],
  },
  {
    id: "local-2",
    title: "Safar",
    artist: "Bayaan",
    src: song2,
    aliases: ["safar", "suffer", "saffer", "safarh"],
  },
  {
    id: "local-3",
    title: "For a Reason",
    artist: "Karan Aujla",
    src: song3,
    aliases: ["for a reason", "for the reason", "for reason"],
  },
];

// Base URL of your ATLAS backend (same one used for /api/ask)
const MUSIC_SEARCH_URL =
  "https://atlas-ai-1wd9.onrender.com/api/music/search";

export default function MusicPlayer({ onClose, songToPlay, controlsRef }) {
  // "local" (playing one of the 3 bundled mp3s) or "youtube"
  const [mode, setMode] = useState(null);

  const [currentSong, setCurrentSong] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const [activeTab, setActiveTab] = useState("local");
  const [searchInput, setSearchInput] = useState("");
  const [onlineResults, setOnlineResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [ytReady, setYtReady] = useState(false);

  const audioRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);
  const progressTimerRef = useRef(null);

  // =========================================================
  // LOAD YOUTUBE IFRAME API (once)
  // =========================================================

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true);
      return;
    }

    if (!document.getElementById("atlas-youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "atlas-youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }

    const previousCallback = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousCallback === "function") {
        previousCallback();
      }
      setYtReady(true);
    };
  }, []);

  // =========================================================
  // CREATE HIDDEN YOUTUBE PLAYER (once API is ready)
  // =========================================================

  useEffect(() => {
    if (!ytReady || ytPlayerRef.current || !ytContainerRef.current) {
      return;
    }

    ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
      height: "0",
      width: "0",
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
      },
      events: {
        onStateChange: handleYtStateChange,
      },
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytReady]);

  const handleYtStateChange = (event) => {
    const YTState = window.YT.PlayerState;

    if (event.data === YTState.PLAYING) {
      setPlaying(true);
      setDuration(ytPlayerRef.current.getDuration() || 0);
      startProgressTracking();
    } else if (event.data === YTState.PAUSED) {
      setPlaying(false);
      stopProgressTracking();
    } else if (event.data === YTState.ENDED) {
      setPlaying(false);
      setProgress(100);
      stopProgressTracking();
    } else if (event.data === YTState.BUFFERING) {
      // no-op — keep current UI, just waiting on network
    }
  };

  const startProgressTracking = () => {
    stopProgressTracking();

    progressTimerRef.current = setInterval(() => {
      if (!ytPlayerRef.current || !ytPlayerRef.current.getCurrentTime) {
        return;
      }

      const current = ytPlayerRef.current.getCurrentTime() || 0;
      const total = ytPlayerRef.current.getDuration() || 0;

      if (total > 0) {
        setProgress((current / total) * 100);
      }
    }, 500);
  };

  const stopProgressTracking = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopProgressTracking();
  }, []);

  // =========================================================
  // ONLINE SEARCH (YouTube, via ATLAS backend)
  // =========================================================

  const searchOnline = async (query, { autoPlayFirst = false } = {}) => {
    const trimmed = (query || "").trim();
    if (!trimmed) return;

    setActiveTab("online");
    setLoadingSearch(true);
    setSearchError("");

    try {
      const res = await fetch(
        `${MUSIC_SEARCH_URL}?q=${encodeURIComponent(trimmed)}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }

      const results = data.results || [];
      setOnlineResults(results);

      if (results.length === 0) {
        setSearchError(
          `No online match found for "${trimmed}". Try the local library or a different search.`
        );
        return;
      }

      if (autoPlayFirst) {
        playSongFromYouTube(results[0]);
      }
    } catch (err) {
      console.error("MUSIC SEARCH ERROR:", err);
      setSearchError(
        "Couldn't reach online music search. Check your connection, or play a local song instead."
      );
    } finally {
      setLoadingSearch(false);
    }
  };

  // =========================================================
  // RESOLVE songToPlay: local library first, then online search
  // =========================================================

  useEffect(() => {
    if (!songToPlay) return;

    const requestedSong = songToPlay.toLowerCase().trim();

    console.log("MUSIC PLAYER RECEIVED:", requestedSong);

    const foundLocal = localSongs.find((song) =>
      song.aliases.some((alias) => requestedSong.includes(alias))
    );

    if (foundLocal) {
      console.log("MUSIC PLAYER: LOCAL MATCH:", foundLocal.title);
      setActiveTab("local");
      playLocalSong(foundLocal);
      return;
    }

    console.log("MUSIC PLAYER: NO LOCAL MATCH, SEARCHING ONLINE");
    searchOnline(requestedSong, { autoPlayFirst: true });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songToPlay]);

  // =========================================================
  // PLAY LOCAL SONG
  // =========================================================

  const playLocalSong = (song) => {
    if (ytPlayerRef.current && ytPlayerRef.current.stopVideo) {
      try {
        ytPlayerRef.current.stopVideo();
      } catch {
        // player might not be ready yet — safe to ignore
      }
    }
    stopProgressTracking();

    setMode("local");
    setCurrentSong(song);
    setProgress(0);
    setDuration(0);
    setPlaying(false);
  };

  useEffect(() => {
    if (mode !== "local" || !audioRef.current || !currentSong) {
      return;
    }

    const audio = audioRef.current;

    audio.pause();
    audio.src = currentSong.src;
    audio.load();

    setProgress(0);
    setPlaying(false);

    audio
      .play()
      .then(() => setPlaying(true))
      .catch((error) => {
        console.error("ATLAS AUDIO PLAY ERROR:", error);
        setPlaying(false);
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong, mode]);

  // =========================================================
  // PLAY YOUTUBE SONG
  // =========================================================

  const playSongFromYouTube = (video) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    setMode("youtube");
    setCurrentSong({
      title: video.title,
      artist: video.channel,
      thumbnail: video.thumbnail,
      videoId: video.videoId,
    });
    setProgress(0);
    setDuration(0);
    setPlaying(false);

    if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
      ytPlayerRef.current.loadVideoById(video.videoId);
    }
  };

  // =========================================================
  // MANUAL SELECTION (clicking in the UI)
  // =========================================================

  const selectLocalSong = (song) => {
    setActiveTab("local");
    playLocalSong(song);
  };

  const selectOnlineSong = (video) => {
    setActiveTab("online");
    playSongFromYouTube(video);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      searchOnline(searchInput.trim(), { autoPlayFirst: false });
    }
  };

  // =========================================================
  // PLAY / PAUSE (unified across local + YouTube)
  // =========================================================

  const togglePlay = async () => {
    if (!currentSong) return;

    if (mode === "youtube") {
      if (!ytPlayerRef.current) return;

      if (playing) {
        ytPlayerRef.current.pauseVideo();
      } else {
        ytPlayerRef.current.playVideo();
      }
      return;
    }

    if (!audioRef.current) return;
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
      console.error("PLAY BUTTON ERROR:", error);
      setPlaying(false);
    }
  };

  const setPlayback = async (shouldPlay) => {
    if (!currentSong || playing === shouldPlay) return;
    if (mode === "youtube") {
      if (!ytPlayerRef.current) return;
      if (shouldPlay) ytPlayerRef.current.playVideo();
      else ytPlayerRef.current.pauseVideo();
      return;
    }
    if (!audioRef.current) return;
    if (shouldPlay) {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch (error) {
        console.error("VOICE PLAY COMMAND ERROR:", error);
      }
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  const changeTrack = (direction) => {
    if (mode === "youtube" && onlineResults.length) {
      const currentIndex = onlineResults.findIndex(
        (video) => video.videoId === currentSong?.videoId,
      );
      const nextIndex = currentIndex < 0
        ? 0
        : (currentIndex + direction + onlineResults.length) % onlineResults.length;
      selectOnlineSong(onlineResults[nextIndex]);
      return;
    }

    const currentIndex = localSongs.findIndex(
      (song) => song.id === currentSong?.id || song.title === currentSong?.title,
    );
    const nextIndex = currentIndex < 0
      ? (direction > 0 ? 0 : localSongs.length - 1)
      : (currentIndex + direction + localSongs.length) % localSongs.length;
    selectLocalSong(localSongs[nextIndex]);
  };

  useEffect(() => {
    if (!controlsRef) return undefined;
    controlsRef.current = {
      play: () => setPlayback(true),
      pause: () => setPlayback(false),
      toggle: togglePlay,
      next: () => changeTrack(1),
      previous: () => changeTrack(-1),
      close: handleClose,
    };
    return () => {
      controlsRef.current = null;
    };
  });

  // =========================================================
  // PROGRESS (local <audio>)
  // =========================================================

  const updateProgress = () => {
    if (mode !== "local" || !audioRef.current) return;

    const dur = audioRef.current.duration;
    if (!dur || isNaN(dur)) return;

    setProgress((audioRef.current.currentTime / dur) * 100 || 0);
  };

  // =========================================================
  // SEEK (unified)
  // =========================================================

  const seek = (event) => {
    const value = Number(event.target.value);
    setProgress(value);

    if (mode === "youtube") {
      if (!ytPlayerRef.current || !duration) return;
      ytPlayerRef.current.seekTo((value / 100) * duration, true);
      return;
    }

    if (!audioRef.current) return;
    const dur = audioRef.current.duration;
    if (!dur || isNaN(dur)) return;

    audioRef.current.currentTime = (value / 100) * dur;
  };

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

    if (ytPlayerRef.current && ytPlayerRef.current.stopVideo) {
      try {
        ytPlayerRef.current.stopVideo();
      } catch {
        // ignore
      }
    }

    stopProgressTracking();
    setPlaying(false);

    if (onClose) onClose();
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="music-overlay">
      <div className="music-window">
        {/* Hidden YouTube player target — kept off-screen, audio only */}
        <div className="yt-hidden-mount">
          <div ref={ytContainerRef}></div>
        </div>

        <div className="music-header">
          <div>
            <span className="music-label">A.T.L.A.S AUDIO SYSTEM</span>
            <h2>Music Library</h2>
          </div>

          <button className="music-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="music-body">
          <div className="album-section">
            <div className="album-orb-wrap">
              <div className="album-ring" />

              <div className={`album-orb ${playing ? "album-playing" : ""}`}>
                {currentSong?.thumbnail ? (
                  <img
                    className="album-thumb"
                    src={currentSong.thumbnail}
                    alt={currentSong.title}
                  />
                ) : (
                  <div className="album-core">♪</div>
                )}
              </div>
            </div>

            {currentSong ? (
              <>
                <h3>{currentSong.title}</h3>
                <p>{currentSong.artist}</p>

                {playing && (
                  <div className="equalizer" aria-hidden="true">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <span
                        key={i}
                        className="eq-bar"
                        style={{ animationDelay: `${i * 0.08}s` }}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : loadingSearch ? (
              <>
                <h3>Searching...</h3>
                <p>Looking this up online</p>
              </>
            ) : (
              <>
                <h3>Select a song</h3>
                <p>Local library or online search</p>
              </>
            )}

            <input
              className="music-progress"
              type="range"
              min="0"
              max="100"
              value={progress || 0}
              onChange={seek}
            />

            <div className="music-controls">
              <button
                className="play-button"
                disabled={!currentSong}
                onClick={togglePlay}
              >
                {playing ? "Ⅱ" : "▶"}
              </button>
            </div>
          </div>

          <div className="song-list">
            <div className="tab-row">
              <button
                className={`tab-button ${
                  activeTab === "local" ? "tab-active" : ""
                }`}
                onClick={() => setActiveTab("local")}
              >
                LOCAL LIBRARY
              </button>

              <button
                className={`tab-button ${
                  activeTab === "online" ? "tab-active" : ""
                }`}
                onClick={() => setActiveTab("online")}
              >
                ONLINE SEARCH
              </button>
            </div>

            {activeTab === "online" && (
              <form className="music-search-form" onSubmit={handleSearchSubmit}>
                <input
                  type="text"
                  placeholder="Search any song..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button type="submit">SEARCH</button>
              </form>
            )}

            {activeTab === "local" &&
              localSongs.map((song, index) => (
                <button
                  key={song.id}
                  className={`song-item ${
                    currentSong && mode === "local" && currentSong.title === song.title
                      ? "song-active"
                      : ""
                  }`}
                  onClick={() => selectLocalSong(song)}
                >
                  <span className="song-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="song-icon">
                    {mode === "local" &&
                    currentSong?.title === song.title &&
                    playing
                      ? "♫"
                      : "♪"}
                  </span>

                  <span className="song-info">
                    <strong>{song.title}</strong>
                    <small>{song.artist}</small>
                  </span>

                  <span className="song-badge song-badge-local">LOCAL</span>

                  <span className="song-arrow">→</span>
                </button>
              ))}

            {activeTab === "online" && (
              <>
                {loadingSearch && (
                  <div className="search-status">SEARCHING...</div>
                )}

                {!loadingSearch && searchError && (
                  <div className="search-status search-status-error">
                    {searchError}
                  </div>
                )}

                {!loadingSearch &&
                  onlineResults.map((video) => (
                    <button
                      key={video.videoId}
                      className={`song-item ${
                        mode === "youtube" &&
                        currentSong?.videoId === video.videoId
                          ? "song-active"
                          : ""
                      }`}
                      onClick={() => selectOnlineSong(video)}
                    >
                      {video.thumbnail && (
                        <img
                          className="song-thumb"
                          src={video.thumbnail}
                          alt={video.title}
                        />
                      )}

                      <span className="song-info">
                        <strong>{video.title}</strong>
                        <small>{video.channel}</small>
                      </span>

                      <span className="song-badge song-badge-online">YT</span>

                      <span className="song-arrow">→</span>
                    </button>
                  ))}
              </>
            )}
          </div>
        </div>

        <div className="music-footer">
          <span>
            {mode === "youtube" ? "ONLINE STREAM" : "LOCAL PLAYBACK"}
          </span>
          <span>
            {mode === "youtube" ? "YOUTUBE SOURCE" : "NO NETWORK REQUIRED"}
          </span>
        </div>

        <audio
          ref={audioRef}
          onTimeUpdate={updateProgress}
          onEnded={handleEnded}
        />
      </div>
    </div>
  );
}
