import { useEffect, useState } from "react";
import "./WeatherDialog.css";

export default function WeatherDialog({ onClose, location = "", coords = null, language = "en", query = null, onWeatherReady }) {
  const isHindi = language === "hi";
  const [city, setCity] = useState(location || "Greater Noida");
  const [activeCoords, setActiveCoords] = useState(coords);
  const [searchInput, setSearchInput] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [weatherSummary, setWeatherSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getWeatherInfo = (code) => {
    const codes = {
      0: { label: isHindi ? "साफ आसमान" : "Clear sky", icon: "☀️" },
      1: { label: isHindi ? "मुख्यतः साफ" : "Mainly clear", icon: "🌤️" },
      2: { label: isHindi ? "आंशिक बादल" : "Partly cloudy", icon: "⛅" },
      3: { label: isHindi ? "बादल छाए" : "Overcast", icon: "☁️" },
      45: { label: isHindi ? "कोहरा" : "Fog", icon: "🌫️" },
      48: { label: isHindi ? "जमा हुआ कोहरा" : "Freezing fog", icon: "🌫️" },
      51: { label: isHindi ? "हल्की बूंदाबांदी" : "Light drizzle", icon: "🌦️" },
      53: { label: isHindi ? "बूंदाबांदी" : "Drizzle", icon: "🌦️" },
      55: { label: isHindi ? "घनी बूंदाबांदी" : "Dense drizzle", icon: "🌧️" },
      56: { label: isHindi ? "जमने वाली हल्की बूंदाबांदी" : "Freezing drizzle", icon: "🌧️" },
      57: { label: isHindi ? "जमने वाली घनी बूंदाबांदी" : "Dense freezing drizzle", icon: "🌧️" },
      61: { label: isHindi ? "हल्की बारिश" : "Slight rain", icon: "🌧️" },
      63: { label: isHindi ? "मध्यम बारिश" : "Moderate rain", icon: "🌧️" },
      65: { label: isHindi ? "तेज बारिश" : "Heavy rain", icon: "🌧️" },
      66: { label: isHindi ? "जमने वाली हल्की बारिश" : "Freezing rain", icon: "🌧️" },
      67: { label: isHindi ? "जमने वाली तेज बारिश" : "Heavy freezing rain", icon: "🌧️" },
      71: { label: isHindi ? "हल्की बर्फबारी" : "Slight snow", icon: "🌨️" },
      73: { label: isHindi ? "मध्यम बर्फबारी" : "Moderate snow", icon: "🌨️" },
      75: { label: isHindi ? "तेज बर्फबारी" : "Heavy snow", icon: "❄️" },
      77: { label: isHindi ? "बर्फ के दाने" : "Snow grains", icon: "❄️" },
      80: { label: isHindi ? "बारिश की बौछारें" : "Rain showers", icon: "🌦️" },
      81: { label: isHindi ? "मध्यम बारिश की बौछारें" : "Moderate showers", icon: "🌧️" },
      82: { label: isHindi ? "तेज बारिश की बौछारें" : "Heavy showers", icon: "🌧️" },
      85: { label: isHindi ? "बर्फ की बौछारें" : "Snow showers", icon: "🌨️" },
      86: { label: isHindi ? "तेज बर्फ की बौछारें" : "Heavy snow showers", icon: "❄️" },
      95: { label: isHindi ? "आंधी-तूफान" : "Thunderstorm", icon: "⛈️" },
      96: { label: isHindi ? "ओलों के साथ तूफान" : "Thunderstorm with hail", icon: "⛈️" },
      99: { label: isHindi ? "तेज ओलों का तूफान" : "Severe hailstorm", icon: "⛈️" },
    };
    return codes[code] || { label: isHindi ? "अज्ञात स्थिति" : "Unknown conditions", icon: "🌡️" };
  };

  const buildWeatherSummary = (data, placeName) => {
    const dayIndex = query?.day === "tomorrow" ? 1 : 0;
    const date = data.daily.time?.[dayIndex];
    const period = query?.timeOfDay || "all-day";
    const dayLabel = isHindi
      ? query?.day === "tomorrow" ? "Kal" : "Aaj"
      : query?.day === "tomorrow" ? "Tomorrow" : "Today";
    const hours = (data.hourly?.time || [])
      .map((time, index) => ({ time, index, hour: Number(time.slice(11, 13)) }))
      .filter(({ time, hour }) => time.startsWith(date || "") && (
        period === "morning" ? hour >= 6 && hour < 12
          : period === "evening" ? hour >= 17 && hour < 23
            : true
      ));
    const selectedHour = period === "all-day" || period === "now"
      ? null
      : hours[Math.floor(hours.length / 2)];
    const weatherCode = selectedHour
      ? data.hourly.weather_code?.[selectedHour.index]
      : period === "now" && query?.day === "today"
        ? data.current.weather_code
        : data.daily.weather_code?.[dayIndex];
    const condition = getWeatherInfo(weatherCode).label;
    const temperature = selectedHour
      ? data.hourly.temperature_2m?.[selectedHour.index]
      : null;
    const periodRainChances = hours
      .map(({ index }) => data.hourly.precipitation_probability?.[index])
      .filter(Number.isFinite);
    const rainChance = period === "all-day" || period === "now"
      ? data.daily.precipitation_probability_max?.[dayIndex]
      : periodRainChances.length
        ? Math.max(...periodRainChances)
        : null;
    const periodLabel = period === "morning"
      ? isHindi ? " subah" : " morning"
      : period === "evening"
        ? isHindi ? " shaam" : " evening"
        : "";

    if (query?.intent === "rain") {
      if (period === "now" && query?.day === "today") {
        return isHindi
          ? `${placeName} mein abhi ${getWeatherInfo(data.current.weather_code).label}. Ab tak ${data.current.precipitation} millimeter varsha darj hui hai.`
          : `Current conditions in ${placeName}: ${getWeatherInfo(data.current.weather_code).label}, with ${data.current.precipitation} millimeters of precipitation recorded.`;
      }
      const chanceText = Number.isFinite(rainChance)
        ? `${Math.round(rainChance)}% chance of precipitation`
        : "precipitation probability is unavailable";
      if (isHindi) {
        const chance = Number.isFinite(rainChance) ? `${Math.round(rainChance)}%` : "uplabdh nahi";
        return `${placeName} mein ${dayLabel.toLowerCase()}${periodLabel}: baarish ki sambhavna ${chance} hai. Mausam: ${condition}.`;
      }
      return `${dayLabel}${periodLabel} in ${placeName}: ${chanceText}. Forecast condition: ${condition}.`;
    }
    if (query?.intent === "clouds") {
      if (period === "now" && query?.day === "today") {
        return isHindi
          ? `${placeName} mein abhi ${getWeatherInfo(data.current.weather_code).label}, aur ${data.current.cloud_cover}% aasmaan par baadal hain.`
          : `Current conditions in ${placeName}: ${getWeatherInfo(data.current.weather_code).label}, with ${data.current.cloud_cover}% cloud cover.`;
      }
      if (isHindi) return `${placeName} mein ${dayLabel.toLowerCase()}${periodLabel} mausam ${condition}${temperature != null ? `, taapmaan lagbhag ${Math.round(temperature)} degree Celsius` : ""}.`;
      return `${dayLabel}${periodLabel} in ${placeName}: ${condition}${temperature != null ? `, around ${Math.round(temperature)} degrees Celsius` : ""}.`;
    }
    if (query?.intent === "temperature") {
      if (period === "now" && query?.day === "today") {
        if (isHindi) return `${placeName} mein abhi taapmaan ${Math.round(data.current.temperature_2m)} degree Celsius hai, aur mehsoos ${Math.round(data.current.apparent_temperature)} degree jaisa ho raha hai.`;
        return `Current temperature in ${placeName} is ${Math.round(data.current.temperature_2m)} degrees Celsius, and it feels like ${Math.round(data.current.apparent_temperature)}.`;
      }
      if (temperature != null) {
        if (isHindi) return `${placeName} mein ${dayLabel.toLowerCase()}${periodLabel} taapmaan lagbhag ${Math.round(temperature)} degree Celsius rahega.`;
        return `${dayLabel}${periodLabel} in ${placeName}: around ${Math.round(temperature)} degrees Celsius, with a ${Number.isFinite(rainChance) ? `${Math.round(rainChance)}% precipitation chance` : "rain chance unavailable"}.`;
      }
      if (isHindi) return `${placeName} mein ${dayLabel.toLowerCase()} adhiktam taapmaan ${Math.round(data.daily.temperature_2m_max[dayIndex])} aur nyuntam ${Math.round(data.daily.temperature_2m_min[dayIndex])} degree Celsius rahega.`;
      return `${dayLabel} in ${placeName}: high ${Math.round(data.daily.temperature_2m_max[dayIndex])} and low ${Math.round(data.daily.temperature_2m_min[dayIndex])} degrees Celsius.`;
    }
    if (query?.day === "today" && period === "now") {
      if (isHindi) return `${placeName} mein abhi ${getWeatherInfo(data.current.weather_code).label}, taapmaan ${Math.round(data.current.temperature_2m)} degree Celsius hai.`;
      return `Current weather in ${placeName}: ${getWeatherInfo(data.current.weather_code).label}, ${Math.round(data.current.temperature_2m)} degrees Celsius, feels like ${Math.round(data.current.apparent_temperature)}.`;
    }
    if (query?.day === "today" && period === "all-day") {
      if (isHindi) return `${placeName} mein abhi ${getWeatherInfo(data.current.weather_code).label}, taapmaan ${Math.round(data.current.temperature_2m)} degree Celsius hai. Aaj adhiktam ${Math.round(data.daily.temperature_2m_max[0])} aur nyuntam ${Math.round(data.daily.temperature_2m_min[0])} degree Celsius rahega${Number.isFinite(rainChance) ? `, baarish ki adhiktam sambhavna ${Math.round(rainChance)}% hai` : ""}.`;
      return `Current weather in ${placeName}: ${getWeatherInfo(data.current.weather_code).label}, ${Math.round(data.current.temperature_2m)} degrees Celsius, feels like ${Math.round(data.current.apparent_temperature)}. Today's high is ${Math.round(data.daily.temperature_2m_max[0])} and low is ${Math.round(data.daily.temperature_2m_min[0])} degrees Celsius${Number.isFinite(rainChance) ? `, with up to ${Math.round(rainChance)}% precipitation chance` : ""}.`;
    }
    if (selectedHour) {
      if (isHindi) return `${placeName} mein ${dayLabel.toLowerCase()}${periodLabel} mausam ${condition}, lagbhag ${Math.round(temperature)} degree Celsius${Number.isFinite(rainChance) ? `, baarish ki sambhavna ${Math.round(rainChance)}% tak` : ""}.`;
      return `${dayLabel}${periodLabel} in ${placeName}: ${condition}, around ${Math.round(temperature)} degrees Celsius${Number.isFinite(rainChance) ? `, with up to ${Math.round(rainChance)}% precipitation chance` : ""}.`;
    }
    if (isHindi) return `${placeName} mein ${dayLabel.toLowerCase()}${periodLabel} mausam ${condition}, adhiktam ${Math.round(data.daily.temperature_2m_max[dayIndex])} aur nyuntam ${Math.round(data.daily.temperature_2m_min[dayIndex])} degree Celsius rahega${Number.isFinite(rainChance) ? `, baarish ki sambhavna ${Math.round(rainChance)}% hai` : ""}.`;
    return `${dayLabel}${periodLabel} in ${placeName}: ${condition}, high ${Math.round(data.daily.temperature_2m_max[dayIndex])} and low ${Math.round(data.daily.temperature_2m_min[dayIndex])} degrees Celsius${Number.isFinite(rainChance) ? `, with up to ${Math.round(rainChance)}% precipitation chance` : ""}.`;
  };

  useEffect(() => {
    if (activeCoords) {
      fetchWeatherByCoords(activeCoords.lat, activeCoords.lon);
    } else if (city) {
      fetchWeatherData(city);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, activeCoords, query?.day, query?.timeOfDay, query?.intent]);

  const fetchForecast = async (latitude, longitude) => {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,cloud_cover",
      hourly: "temperature_2m,weather_code,precipitation_probability,precipitation",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset",
      forecast_days: "5",
      timezone: "auto",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
    const data = await response.json();
    if (!data.current || !data.daily || !data.hourly) {
      throw new Error("Weather service returned incomplete forecast data");
    }
    return data;
  };

  const publishWeather = (data, placeName, countryName = "") => {
    const nextData = {
      city: placeName,
      country: countryName,
      current: data.current,
      daily: data.daily,
      hourly: data.hourly,
    };
    const summary = buildWeatherSummary(nextData, placeName);
    setWeatherData(nextData);
    setWeatherSummary(summary);
    onWeatherReady?.(summary);
  };

  const fetchWeatherByCoords = async (lat, lon) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchForecast(lat, lon);

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

      publishWeather(data, placeName, countryName);
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
      if (!geoRes.ok) throw new Error(`Location search returned ${geoRes.status}`);
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(isHindi ? "शहर नहीं मिला" : "City not found");
      }

      const { latitude, longitude, name, country } = geoData.results[0];

      const data = await fetchForecast(latitude, longitude);
      publishWeather(data, name, country);
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

                <section className="weather-insight" aria-live="polite">
                  <span className="weather-insight-label">{isHindi ? "मौसम का जवाब" : "YOUR FORECAST"}</span>
                  <p>{weatherSummary}</p>
                </section>

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
                  <div className="metric-card">
                    <span className="metric-label">{isHindi ? "बादल" : "CLOUD COVER"}</span>
                    <span className="metric-value">{weatherData.current.cloud_cover}%</span>
                  </div>
                </div>

                <div className="forecast-section">
                  <div className="forecast-title">{isHindi ? "5 दिन का पूर्वानुमान" : "5-DAY FORECAST"}</div>
                  <div className="forecast-list">
                    {weatherData.daily.time.slice(0, 5).map((date, idx) => (
                      <div key={date} className="forecast-item">
                        <span>
                          {new Date(`${date}T12:00:00`).toLocaleDateString(isHindi ? "hi-IN" : "en-US", {
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
                        <span className="forecast-rain">
                          {Number.isFinite(weatherData.daily.precipitation_probability_max?.[idx])
                            ? `${Math.round(weatherData.daily.precipitation_probability_max[idx])}% ${isHindi ? "बारिश" : "rain"}`
                            : "—"}
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
