// 天気（data/weather.json）の表示。WMO 天気コードの日本語表記は scripts/fetch-weather.mjs と共用する。

// [日本語, アイコン]
const WEATHER_CODES = {
  0: ["快晴", "sun"],
  1: ["晴れ", "sun"],
  2: ["晴れ時々くもり", "partly"],
  3: ["くもり", "cloud"],
  45: ["霧", "cloud"],
  48: ["霧", "cloud"],
  51: ["霧雨", "rain"],
  53: ["霧雨", "rain"],
  55: ["霧雨", "rain"],
  56: ["着氷性の霧雨", "rain"],
  57: ["着氷性の霧雨", "rain"],
  61: ["小雨", "rain"],
  63: ["雨", "rain"],
  65: ["大雨", "rain"],
  66: ["着氷性の雨", "rain"],
  67: ["着氷性の雨", "rain"],
  71: ["小雪", "snow"],
  73: ["雪", "snow"],
  75: ["大雪", "snow"],
  77: ["霧雪", "snow"],
  80: ["にわか雨", "rain"],
  81: ["にわか雨", "rain"],
  82: ["激しいにわか雨", "rain"],
  85: ["にわか雪", "snow"],
  86: ["にわか雪", "snow"],
  95: ["雷雨", "thunder"],
  96: ["雷雨", "thunder"],
  99: ["雷雨", "thunder"],
};

export function describeWeather(code) {
  const [text, icon] = WEATHER_CODES[code] ?? ["不明", "cloud"];
  return { text, icon };
}

const CLOUD = `<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 11 3.5 3.5 0 0 0 7 18z" />`;
const ICONS = {
  sun: `<circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />`,
  partly: `<g class="icon-sun"><circle cx="8" cy="8" r="3" /><path d="M8 2v1.5M2 8h1.5M3.8 3.8l1 1M12.2 3.8l-1 1" /></g><path d="M9 20h9a3.5 3.5 0 0 0 .5-6.96A4.8 4.8 0 0 0 9.1 14 3 3 0 0 0 9 20z" />`,
  cloud: CLOUD,
  rain: `<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 8 3.5 3.5 0 0 0 7 15z" /><path class="icon-rain" d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" />`,
  snow: `<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 8 3.5 3.5 0 0 0 7 15z" /><path class="icon-snow" d="M9 19h.01M13 19h.01M17 19h.01M11 22h.01M15 22h.01" />`,
  thunder: `<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 8 3.5 3.5 0 0 0 7 15z" /><path class="icon-bolt" d="M13 14l-3 4h3l-2 4" />`,
};

const round = (n) => Math.round(n);
const hm = (s) => s.replace(/^0/, "");

export function weatherHtml(weather) {
  const { text, icon } = describeWeather(weather.weatherCode);
  return `
    <svg class="weather-icon is-${icon}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>
    <span class="weather-text">${text}</span>
    <span class="weather-temp"><span class="temp-max">${round(weather.tempMax)}℃</span><span class="temp-sep">/</span><span class="temp-min">${round(weather.tempMin)}℃</span></span>
    <span class="weather-sun">日の出 ${hm(weather.sunrise)}<span class="sun-sep"></span>日の入 ${hm(weather.sunset)}</span>`;
}

export async function loadWeather(url = "data/weather.json") {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`天気を読み込めませんでした (HTTP ${res.status})`);
  return res.json();
}
