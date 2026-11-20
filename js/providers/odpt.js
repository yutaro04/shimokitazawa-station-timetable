// ODPT（公共交通オープンデータセンター）の駅時刻表 API から読み込むプロバイダ。
// ブラウザと scripts/fetch-odpt.mjs（Node）の両方から使うため、DOM には依存しない。
//
// 注意: 下北沢駅の駅 ID や小田急・京王のデータ提供状況は未確認。
// 取得できない場合は js/lines.js の odpt.station を ODPT のカタログに合わせて直すこと。

import { STATION_NAMES_EN } from "../lines.js";

const TRAIN_TYPE_KEYS = {
  Local: "local",
  SemiExpress: "semiExpress",
  CommuterSemiExpress: "commuterSemiExpress",
  Express: "express",
  CommuterExpress: "commuterExpress",
  RapidExpress: "rapidExpress",
};

const lastSegment = (id) => id?.split(/[.:]/).pop() ?? "";
const normalizeName = (s) => s.toLowerCase().replace(/[^a-z]/g, "");

const JA_BY_EN = Object.fromEntries(
  Object.entries(STATION_NAMES_EN).map(([ja, en]) => [normalizeName(en), ja]),
);

function destinationName(stationIds) {
  const segment = lastSegment(stationIds?.[0]);
  return JA_BY_EN[normalizeName(segment)] ?? segment;
}

function calendarType(calendarId) {
  return lastSegment(calendarId) === "Weekday" ? "weekday" : "holiday";
}

export function convertStationTimetables(line, records) {
  const directions = {};
  for (const direction of line.directions) {
    directions[direction.id] = { weekday: [], holiday: [] };
  }

  for (const record of records) {
    const direction = line.directions.find(
      (d) => d.odptRailDirection === record["odpt:railDirection"],
    );
    if (!direction) continue;
    const trains = directions[direction.id][calendarType(record["odpt:calendar"])];
    for (const obj of record["odpt:stationTimetableObject"] ?? []) {
      if (!obj["odpt:departureTime"]) continue;
      const typeSegment = lastSegment(obj["odpt:trainType"]);
      trains.push({
        time: obj["odpt:departureTime"],
        type: TRAIN_TYPE_KEYS[typeSegment] ?? typeSegment,
        dest: destinationName(obj["odpt:destinationStation"]),
        ...(obj["odpt:carComposition"] ? { cars: obj["odpt:carComposition"] } : {}),
      });
    }
  }

  return { source: "odpt", updated: new Date().toISOString().slice(0, 10), directions };
}

export async function fetchLineFromOdpt(line, { endpoint, consumerKey }) {
  if (!consumerKey) throw new Error("ODPT の consumerKey が設定されていません");
  const url = new URL(`${endpoint}/odpt:StationTimetable`);
  url.searchParams.set("odpt:station", line.odpt.station);
  url.searchParams.set("acl:consumerKey", consumerKey);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ODPT API エラー (${line.id}): HTTP ${res.status}`);
  const records = await res.json();
  if (records.length === 0) {
    throw new Error(`ODPT に ${line.odpt.station} の時刻表がありません`);
  }
  return convertStationTimetables(line, records);
}

export async function loadOdpt(lines, odptConfig) {
  const entries = await Promise.all(
    lines.map(async (line) => [line.id, await fetchLineFromOdpt(line, odptConfig)]),
  );
  return Object.fromEntries(entries);
}
