// 世田谷区の今日の天気・最高/最低気温・日の出/日の入りを Open-Meteo から取得し、data/weather.json に保存する。
// GitHub Actions（.github/workflows/deploy.yml）で毎朝実行する。API キーは不要。
//
//   node scripts/fetch-weather.mjs

import { writeFile } from "node:fs/promises";
import { describeWeather } from "../js/weather.js";

// 世田谷区役所付近
const LOCATION = { name: "世田谷区", latitude: 35.6464, longitude: 139.6533 };

const url = new URL("https://api.open-meteo.com/v1/forecast");
url.search = new URLSearchParams({
  latitude: LOCATION.latitude,
  longitude: LOCATION.longitude,
  daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
  timezone: "Asia/Tokyo",
  forecast_days: 1,
});

const res = await fetch(url);
if (!res.ok) {
  console.error(`Open-Meteo の取得に失敗しました: HTTP ${res.status}`);
  process.exit(1);
}
const { daily } = await res.json();

const weather = {
  location: LOCATION.name,
  date: daily.time[0],
  weatherCode: daily.weather_code[0],
  weather: describeWeather(daily.weather_code[0]).text,
  tempMax: daily.temperature_2m_max[0],
  tempMin: daily.temperature_2m_min[0],
  sunrise: daily.sunrise[0].slice(11, 16),
  sunset: daily.sunset[0].slice(11, 16),
  source: "Open-Meteo.com",
  fetchedAt: new Date().toISOString(),
};

await writeFile(new URL("../data/weather.json", import.meta.url), `${JSON.stringify(weather, null, 1)}\n`);
console.log(weather);
