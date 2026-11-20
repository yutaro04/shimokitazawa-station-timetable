// 時刻表データ（data/*.json）を読み込み、発車順に並べて返す。
//
// 返り値: { [路線ID]: { source, updated, directions: { [方面ID]: { weekday: Train[], holiday: Train[] } } } }
// Train: { time: "HH:MM", type: 種別キー, dest: 行先（日本語）, cars?: 両数 }

import { loadStatic } from "./static.js";
import { parseTime } from "../timetable.js";

export async function loadTimetables(lines, config) {
  const data = await loadStatic(lines);

  // 深夜帯（24 時以降）を含めて発車順に並べておく
  const byTime = (a, b) =>
    parseTime(a.time, config.serviceDayStartHour) - parseTime(b.time, config.serviceDayStartHour);
  for (const line of Object.values(data)) {
    for (const direction of Object.values(line.directions)) {
      for (const trains of Object.values(direction)) trains.sort(byTime);
    }
  }
  return data;
}
