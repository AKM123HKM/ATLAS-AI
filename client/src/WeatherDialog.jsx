import { useEffect, useState } from "react";
import "./WeatherDialog.css";

export default function WeatherDialog({ onClose, location = "", coords = null, language = "en" }) {
  const isHindi = language === "hi";
  const [city, setCity] = useState(location || "Greater Noida");
  const [activeCoords, setActiveCoords] = useState(coords);
  const [searchInput, setSearchInput] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (activeCoords) {
      fetchWeatherByCoords(activeCoords.lat, activeCoords.lon);
    } else if (city) {
      fetchWeatherData(city);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, activeCoords]);

  const fetchWeatherByCoords = async (lat, lon) => {
    setLoading(true);
    setError(null);
    try {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
      );
      const data = await weatherRes.json();

      let placeName = "Your Location";
      let countryName = "";
      try {
        const geoRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${isHindi ? "hi" : "en"}`
        );
        const geoData = await geoRes.json();
        placeName = geoData.city || geoData.locality || placeName;
        countryName = geoData.countryName || "";
      } catch {
        // reverse geocode failed — keep generic name, weather data still shows
      }

      setWeatherData({
        city: placeName,
        country: countryName,
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

  const fetchWeatherData = async (targetCity) => {
    setLoading(true);
    setError(null);
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          targetCity
        )}&count=1&language=${isHindi ? "hi" : "en"}&format=json`
      );
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(isHindi ? "शहर नहीं मिला" : "City not found");
      }

      const { latitude, longitude, name, country } = geoData.results[0];

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
      setActiveCoords(null);
      setCity(searchInput.trim());
      setSearchInput("");
    }
  };

  const getWeatherInfo = (code) => {
    const codes = {
      0: { label: isHindi ? "साफ़ आसमान" : "Clear Sky", icon: "☀️" },
      1: { label: isHindi ? "मुख्यतः साफ़" : "Mainly Clear", icon: "🌤️" },
      2: { label: isHindi ? "आंशिक बादल" : "Partly Cloudy", icon: "⛅" },
      3: { label: isHindi ? "बादल छाए हुए" : "Overcast", icon: "☁️" },
      45: { label: isHindi ? "कोहरा" : "Foggy", icon: "🌫️" },
      51: { label: isHindi ? "हल्की बूंदाबांदी" : "Light Drizzle", icon: "🌧️" },
      61: { label: isHindi ? "हल्की बारिश" : "Slight Rain", icon: "🌧️" },
      63: { label: isHindi ? "मध्यम बारिश" : "Moderate Rain", icon: "🌧️" },
      65: { label: isHindi ? "तेज़ बारिश" : "Heavy Rain", icon: "🌧️" },
      80: { label: isHindi ? "बारिश की बौछारें" : "Rain Showers", icon: "🌦️" },
      95: { label: isHindi ? "आंधी-तूफ़ान" : "Thunderstorm", icon: "⛈️" },
    };
    return codes[code] || { label: isHindi ? "बादल" : "Cloudy", icon: "☁️" };
  };

  return (
    <div className="weather-overlay">
      <div className="weather-window">
        <div className="weather-header">
          <div>
            <span className="weather-label">{isHindi ? "A.T.L.A.S मौसम केंद्र" : "A.T.L.A.S CLIMATE CORE"}</span>
            <h2>{isHindi ? "मौसम की जानकारी" : "Atmospheric Data"}</h2>
          </div>
          <button className="weather-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="weather-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder={isHindi ? "शहर खोजें..." : "Search location..."}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit">{isHindi ? "खोजें" : "SEARCH"}</button>
        </form>

        <div className="weather-body">
          {loading ? (
            <div className="weather-loading">
              <div className="weather-spinner"></div>
              <p>{isHindi ? "मौसम की जानकारी प्राप्त हो रही है..." : "FETCHING ATMOSPHERIC DATA..."}</p>
            </div>
          ) : error ? (
            <div className="weather-error">
              <p>{isHindi ? "त्रुटि" : "ERROR"}: {error}</p>
            </div>
          ) : (
            weatherData && (
              <>
                <div className="weather-hero">
                  <div className="hero-left">
                    <span className="weather-icon">
                      {getWeatherInfo(weatherData.current.weather_code).icon}
                    </span>
                    <div>
                      <h3>
                        {weatherData.city}
                        {weatherData.country ? `, ${weatherData.country}` : ""}
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
                      {isHindi ? "महसूस हो रहा है" : "Feels like"}{" "}
                      {Math.round(weatherData.current.apparent_temperature)}°C
                    </span>
                  </div>
                </div>

                <div className="weather-grid">
                  <div className="metric-card">
                    <span className="metric-label">{isHindi ? "नमी" : "HUMIDITY"}</span>
                    <span className="metric-value">
                      {weatherData.current.relative_humidity_2m}%
                    </span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{isHindi ? "हवा की गति" : "WIND SPEED"}</span>
                    <span className="metric-value">
                      {weatherData.current.wind_speed_10m} km/h
                    </span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{isHindi ? "वर्षा" : "PRECIPITATION"}</span>
                    <span className="metric-value">
                      {weatherData.current.precipitation} mm
                    </span>
                  </div>
                </div>

                <div className="forecast-section">
                  <div className="forecast-title">{isHindi ? "5 दिन का पूर्वानुमान" : "5-DAY FORECAST"}</div>
                  <div className="forecast-list">
                    {weatherData.daily.time.slice(0, 5).map((date, idx) => (
                      <div key={date} className="forecast-item">
                        <span>
                          {new Date(date).toLocaleDateString(isHindi ? "hi-IN" : "en-US", {
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

        <div className="weather-footer">
          <span>{isHindi ? "Open-Meteo मौसम सेवा" : "OPEN-METEO ENGINE"}</span>
          <span>{isHindi ? "ताज़ा जानकारी" : "LIVE METRICS"}</span>
        </div>
      </div>
    </div>
  );
}
