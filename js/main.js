import { resolveConfig } from "./config.js";
import { LINES } from "./lines.js";
import { loadTimetables } from "./providers/index.js";
import { fetchTrainInformation } from "./trainInformation.js";
import { loadWeather, weatherHtml } from "./weather.js";
import {
  dateKey,
  dayType,
  formatTime,
  loadHolidays,
  serviceDay,
  upcomingDepartures,
} from "./timetable.js";

const DAY_TYPE_LABELS = { weekday: "平日ダイヤ", holiday: "土休日ダイヤ" };

const config = resolveConfig();
const boardsEl = document.querySelector("#boards");
const clockEl = document.querySelector("#clock");
const dayTypeEl = document.querySelector("#day-type");
const weatherEl = document.querySelector("#weather");
const tickerEl = document.querySelector("#ticker");
const tickerTextEl = document.querySelector("#ticker-text");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// 運行情報。undefined: 未取得 / null: 取得失敗 / { [路線ID]: 情報 | null }
let trainInformation;
// サンプルデータの路線があるときの注意書き
let sampleNotice = "";
// data/weather.json の内容。取得できなければ null
let weather = null;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function trainInformationHtml(line) {
  // 運行情報を提供していない路線（小田急）は欄を出さない
  if (trainInformation === undefined || !line.odpt.trainInformation) return "";
  if (trainInformation === null) {
    return `<span class="info-label">運行情報</span>
      <span class="info-status">取得できません</span>`;
  }
  const info = trainInformation[line.id];
  if (!info) return "";
  const status = info.status ?? (info.normal ? "平常運転" : "");
  const text = info.normal ? "" : (info.text ?? "");
  // ODPT のガイドラインに従い、データの生成時刻（dc:date）を常に表示する
  const updated = info.date
    ? new Date(info.date).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    : "";
  return `<span class="info-label">運行情報</span>
    <span class="info-status">${escapeHtml(status)}</span>
    ${text ? `<span class="info-text">${escapeHtml(text)}</span>` : ""}
    ${updated ? `<span class="info-time">${updated} 更新</span>` : ""}`;
}

// 走る人のピクトグラム。2 つのポーズを交互に表示して走っているように見せる。
const RUNNER_SVG = `
  <svg class="runner" viewBox="0 0 24 24" aria-hidden="true">
    <g class="pose pose-a">
      <circle cx="15" cy="4" r="2.4" />
      <polyline points="13.5,8 11,14" />
      <polyline points="13.5,9 17,11 19.5,9" />
      <polyline points="13,9 9.5,10 8,13" />
      <polyline points="11,14 14.5,17 13.5,21.5" />
      <polyline points="11,14 8,17.5 4.5,17.5" />
    </g>
    <g class="pose pose-b">
      <circle cx="15" cy="3.4" r="2.4" />
      <polyline points="13.5,7.5 11.5,13.5" />
      <polyline points="13.5,8.5 15.5,11.5 14,14" />
      <polyline points="13,8.5 11,11.5 12,14" />
      <polyline points="11.5,13.5 13,17.5 11,21" />
      <polyline points="11.5,13.5 10.5,17.5 13,20" />
    </g>
  </svg>`;

// 発車まで 1 分未満は「まもなく」、あと 1 分は「間に合わないかも」、runToCatchMinutes の範囲は「走れば間に合う！」を備考行に出す
function remarkHtml(train) {
  const minutes = Math.floor(train.inSeconds / 60);
  const { from, to } = config.runToCatchMinutes;
  if (minutes < 1) return `<div class="remark is-soon">まもなく発車します</div>`;
  if (minutes === 1) return `<div class="remark is-late">間に合わないかも</div>`;
  if (minutes >= from && minutes <= to) {
    return `<div class="remark is-run">${RUNNER_SVG}<span>走れば間に合う！</span></div>`;
  }
  return "";
}

function rowHtml(line, train) {
  const type = line.trainTypes[train.type] ?? { name: train.type, color: "#555" };
  // 字数で字間を変える（実機の「各　停」「新　宿」のような詰め方）
  return `
    <li class="row">
      <div class="row-main">
        <span class="type" data-len="${[...type.name].length}" style="--type-color: ${type.color}">${escapeHtml(type.name)}</span>
        <span class="dest" data-len="${[...train.dest].length}">${escapeHtml(train.dest)}</span>
        <span class="time">${formatTime(train.at)}</span>
        <span class="cars">${train.cars ? `<span>${train.cars}</span><span>両</span>` : ""}</span>
        <span class="until">あと<span>${Math.floor(train.inSeconds / 60)}</span>分</span>
      </div>
      ${remarkHtml(train)}
    </li>`;
}

function rowsHtml(line, trains) {
  return trains.length
    ? trains.map((t) => rowHtml(line, t)).join("")
    : `<li class="row is-empty">時刻表データがありません</li>`;
}

const BEZEL_LABELS = `
  <div class="bezel-labels" aria-hidden="true">
    <span>種　別<small>Train</small></span>
    <span>行　先<small>Destination</small></span>
    <span>発車時刻<small>Dep. Time</small></span>
    <span>両数</span>
    <span>発車まで</span>
  </div>`;

function buildSkeleton() {
  boardsEl.innerHTML = LINES.map(
    (line) => `
    <section class="line" style="--line-color: ${line.color}">
      <h2 class="line-title">
        <span class="line-symbol"><span>${line.symbol}</span><span>${line.stationNumber.slice(2)}</span></span>
        <span class="line-name">${escapeHtml(line.name)}</span>
      </h2>
      <div class="line-info" data-line-info="${line.id}" hidden></div>
      ${line.directions
        .map(
          (d) => `
        <div class="board">
          <div class="board-head">${escapeHtml(d.label)}</div>
          <div class="bezel">
            ${BEZEL_LABELS}
            <ol class="rows" data-board="${line.id}/${d.id}"></ol>
          </div>
        </div>`,
        )
        .join("")}
    </section>`,
  ).join("");
}

function render(timetables, holidays, now) {
  clockEl.textContent = now.toLocaleTimeString("ja-JP", { hour12: false });
  const today = dayType(serviceDay(now, config.serviceDayStartHour).date, holidays);
  dayTypeEl.textContent = DAY_TYPE_LABELS[today];
  dayTypeEl.dataset.dayType = today;

  // 前日以前の予報は出さない（自動更新が止まったときに古い天気を表示しないため）
  const weatherToday = weather?.date === dateKey(now) ? weather : null;
  const weatherMarkup = weatherToday ? weatherHtml(weatherToday) : "";
  if (weatherEl.dataset.html !== weatherMarkup) {
    weatherEl.innerHTML = weatherMarkup;
    weatherEl.dataset.html = weatherMarkup;
    weatherEl.hidden = weatherMarkup === "";
  }

  for (const line of LINES) {
    const infoEl = boardsEl.querySelector(`[data-line-info="${line.id}"]`);
    const infoHtml = trainInformationHtml(line);
    if (infoEl.dataset.html !== infoHtml) {
      infoEl.innerHTML = infoHtml;
      infoEl.dataset.html = infoHtml;
      infoEl.hidden = infoHtml === "";
      infoEl.classList.toggle("is-alert", trainInformation?.[line.id]?.normal === false);
    }

    for (const direction of line.directions) {
      const table = timetables[line.id]?.directions[direction.id] ?? {};
      const trains = upcomingDepartures(
        table,
        now,
        holidays,
        config.rowsPerBoard,
        config.serviceDayStartHour,
      );
      const html = rowsHtml(line, trains);
      const boardEl = boardsEl.querySelector(`[data-board="${line.id}/${direction.id}"]`);
      // 内容が変わったときだけ書き換える
      if (boardEl.dataset.html !== html) {
        boardEl.innerHTML = html;
        boardEl.dataset.html = html;
      }
    }
  }
}

function buildSampleNotice(timetables) {
  const sampleLines = LINES.filter((line) => timetables[line.id]?.source === "sample");
  if (!sampleLines.length) return "";
  const names = sampleLines.map((line) => line.name).join("・");
  return `${names}はサンプルデータで表示しています。実際の時刻とは異なります。`;
}

function tickerMessages() {
  const alerts = LINES.flatMap((line) => {
    const info = trainInformation?.[line.id];
    if (!info || info.normal) return [];
    return [`【${line.name}】${[info.status, info.text].filter(Boolean).join("　")}`];
  });
  const credits = [
    trainInformation ? "運行情報: 公共交通オープンデータセンター" : "",
    weather ? `天気予報: ${weather.location}（${weather.source}）` : "",
  ];
  return [...alerts, ...config.tickerMessages, sampleNotice, ...credits].filter(Boolean);
}

// 右端から左端まで 1 回流し終えるたびに、内容を作り直してもう一度流す
function runTicker() {
  const messages = tickerMessages();
  tickerEl.hidden = messages.length === 0;
  tickerEl.classList.toggle("is-static", reducedMotion.matches);
  if (tickerEl.hidden || reducedMotion.matches) {
    tickerTextEl.textContent = messages.join("　");
    setTimeout(runTicker, 10_000);
    return;
  }

  tickerTextEl.textContent = messages.join("　　◆　　");
  const from = tickerEl.clientWidth;
  const to = -tickerTextEl.scrollWidth;
  const pxPerSecond =
    parseFloat(getComputedStyle(tickerTextEl).fontSize) * config.tickerCharsPerSecond;
  tickerTextEl.animate(
    [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
    { duration: ((from - to) / pxPerSecond) * 1000, easing: "linear" },
  ).onfinish = runTicker;
}

async function pollTrainInformation() {
  try {
    trainInformation = await fetchTrainInformation(LINES, config.trainInformationUrl);
  } catch (err) {
    console.warn(err);
    // 最新でない運行情報は表示しない（ODPT のガイドライン）ので、前回の内容も捨てる
    trainInformation = null;
  }
}

// ダブルクリックか F キーでブラウザの全画面表示を切り替える
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch((err) => console.warn(err));
}

async function pollWeather() {
  try {
    weather = await loadWeather();
  } catch (err) {
    console.warn(err);
  }
}

async function start() {
  buildSkeleton();
  pollWeather();
  setInterval(pollWeather, config.weatherReloadMinutes * 60 * 1000);
  document.addEventListener("dblclick", toggleFullscreen);
  document.addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") toggleFullscreen();
  });
  if (config.trainInformationUrl) {
    pollTrainInformation();
    setInterval(pollTrainInformation, config.trainInformationSeconds * 1000);
  }
  try {
    const [timetables, holidays] = await Promise.all([
      loadTimetables(LINES, config),
      loadHolidays(config.holidaysUrl),
    ]);
    sampleNotice = buildSampleNotice(timetables);
    runTicker();
    const tick = () => render(timetables, holidays, new Date());
    tick();
    setInterval(tick, 1000);
  } catch (err) {
    console.error(err);
    boardsEl.innerHTML = `<p class="error">時刻表を読み込めませんでした: ${escapeHtml(err.message)}</p>`;
  }
}

start();
