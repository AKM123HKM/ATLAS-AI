import { useEffect, useState } from "react";
import "./WeatherDialog.css";

export default function WeatherDialog({ onClose, locationQuery = "" }) {
  const [city, setCity] = useState(locationQuery || "Greater Noida");
  const [searchInput, setSearchInput] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch weather when city changes or component mounts
  useEffect(() => {
    if (city) {
      fetchWeatherData(city);
    }
  }, [city]);

  const fetchWeatherData = async (targetCity) => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Geocoding via Open-Meteo (No API key needed)
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          targetCity
        )}&count=1&language=en&format=json`
      );
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error("City not found");
      }

      const { latitude, longitude, name, country } = geoData.results[0];

      // Step 2: Weather Data Fetching
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
      );
      const data = await weatherRes.json();

      setWeatherData({
        city: name,
        country: country,
        current: data.current,
        daily: data.daily,
        hourly: data.hourly,
      });
    } catch (err) {
      setError(err.message || "Failed to load weather");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setCity(searchInput.trim());
      setSearchInput("");
    }
  };

  // Helper to resolve WMO Weather Interpretation Codes
  const getWeatherInfo = (code) => {
    const codes = {
      0: { label: "Clear Sky", icon: "☀️" },
      1: { label: "Mainly Clear", icon: "🌤️" },
      2: { label: "Partly Cloudy", icon: "⛅" },
      3: { label: "Overcast", icon: "☁️" },
      45: { label: "Foggy", icon: "🌫️" },
      51: { label: "Light Drizzle", icon: "🌧️" },
      61: { label: "Slight Rain", icon: "🌧️" },
      63: { label: "Moderate Rain", icon: "🌧️" },
      65: { label: "Heavy Rain", icon: "🌧️" },
      80: { label: "Rain Showers", icon: "🌦️" },
      95: { label: "Thunderstorm", icon: "⛈️" },
    };
    return codes[code] || { label: "Cloudy", icon: "☁️" };
  };

  return (
    <div className="weather-overlay">
      <div className="weather-window">
        {/* Header */}
        <div className="weather-header">
          <div>
            <span className="weather-label">A.T.L.A.S CLIMATE CORE</span>
            <h2>Atmospheric Data</h2>
          </div>
          <button className="weather-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Search Bar */}
        <form className="weather-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search location..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit">SEARCH</button>
        </form>

        {/* Body */}
        <div className="weather-body">
          {loading ? (
            <div className="weather-loading">
              <div className="weather-spinner"></div>
              <p>FETCHING ATMOSPHERIC DATA...</p>
            </div>
          ) : error ? (
            <div className="weather-error">
              <p>ERROR: {error}</p>
            </div>
          ) : (
            weatherData && (
              <>
                {/* Hero Section */}
                <div className="weather-hero">
                  <div className="hero-left">
                    <span className="weather-icon">
                      {getWeatherInfo(weatherData.current.weather_code).icon}
                    </span>
                    <div>
                      <h3>
                        {weatherData.city}, {weatherData.country}
                      </h3>
                      <p className="weather-desc">
                        {getWeatherInfo(weatherData.current.weather_code).label}
                      </p>
                    </div>
                  </div>
                  <div className="hero-right">
                    <h1 className="weather-temp">
                      {Math.round(weatherData.current.temperature_2m)}°C
                    </h1>
                    <span className="weather-feels">
                      Feels like{" "}
                      {Math.round(weatherData.current.apparent_temperature)}°C
                    </span>
                  </div>
                </div>

                {/* Metric Grid */}
                <div className="weather-grid">
                  <div className="metric-card">
                    <span className="metric-label">HUMIDITY</span>
                    <span className="metric-value">
                      {weatherData.current.relative_humidity_2m}%
                    </span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">WIND SPEED</span>
                    <span className="metric-value">
                      {weatherData.current.wind_speed_10m} km/h
                    </span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">PRECIPITATION</span>
                    <span className="metric-value">
                      {weatherData.current.precipitation} mm
                    </span>
                  </div>
                </div>

                {/* 5-Day Forecast */}
                <div className="forecast-section">
                  <div className="forecast-title">5-DAY FORECAST</div>
                  <div className="forecast-list">
                    {weatherData.daily.time.slice(0, 5).map((date, idx) => (
                      <div key={date} className="forecast-item">
                        <span>
                          {new Date(date).toLocaleDateString("en-US", {
                            weekday: "short",
                          })}
                        </span>
                        <span>
                          {getWeatherInfo(weatherData.daily.weather_code[idx]).icon}
                        </span>
                        <span>
                          {Math.round(weatherData.daily.temperature_2m_max[idx])}° /{" "}
                          {Math.round(weatherData.daily.temperature_2m_min[idx])}°
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          )}
        </div>

        {/* Footer */}
        <div className="weather-footer">
          <span>OPEN-METEO ENGINE</span>
          <span>LIVE METRICS</span>
        </div>
      </div>
    </div>
  );
}