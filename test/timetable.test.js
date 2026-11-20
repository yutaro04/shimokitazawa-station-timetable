import { test } from "node:test";
import assert from "node:assert/strict";
import { dayType, parseTime, serviceDay, upcomingDepartures } from "../js/timetable.js";
import { convertStationTimetables } from "../js/providers/odpt.js";
import { LINES } from "../js/lines.js";

const START = 3;
const tables = {
  weekday: [
    { time: "05:00", type: "local", dest: "W-first" },
    { time: "23:50", type: "local", dest: "W-late" },
    { time: "24:20", type: "local", dest: "W-last" },
  ],
  holiday: [{ time: "05:30", type: "local", dest: "H-first" }],
};

test("parseTime は始発前の時刻を 24 時以降として扱う", () => {
  assert.equal(parseTime("00:20", START), 24 * 60 + 20);
  assert.equal(parseTime("24:20", START), 24 * 60 + 20);
  assert.equal(parseTime("05:00", START), 300);
});

test("深夜 0 時台は前日の運行日になる", () => {
  const { date, seconds } = serviceDay(new Date(2026, 10, 21, 0, 10), START);
  assert.equal(date.getDate(), 20);
  assert.equal(seconds, (24 * 60 + 10) * 60);
});

test("dayType は土日・年末年始・祝日を休日にする", () => {
  const holidays = new Set(["2026-11-23"]);
  assert.equal(dayType(new Date(2026, 10, 20), holidays), "weekday"); // 金
  assert.equal(dayType(new Date(2026, 10, 21), holidays), "holiday"); // 土
  assert.equal(dayType(new Date(2026, 10, 23), holidays), "holiday"); // 勤労感謝の日
  assert.equal(dayType(new Date(2026, 11, 31), holidays), "holiday");
});

test("終電間際は翌運行日のダイヤ（土休日）に続く", () => {
  // 金曜 23:45 → 金曜の 23:50, 24:20, 翌土曜の 5:30
  const trains = upcomingDepartures(tables, new Date(2026, 10, 20, 23, 45), new Set(), 3, START);
  assert.deepEqual(trains.map((t) => t.dest), ["W-late", "W-last", "H-first"]);
  assert.equal(trains[0].inSeconds, 5 * 60);
  // 土曜 0:10 はまだ金曜の運行日
  const after = upcomingDepartures(tables, new Date(2026, 10, 21, 0, 10), new Set(), 1, START);
  assert.equal(after[0].dest, "W-last");
});

test("ODPT のレスポンスを共通形式に変換する", () => {
  const odakyu = LINES.find((l) => l.id === "odakyu");
  const data = convertStationTimetables(odakyu, [
    {
      "odpt:railDirection": "odpt.RailDirection:Inbound",
      "odpt:calendar": "odpt.Calendar:Weekday",
      "odpt:stationTimetableObject": [
        {
          "odpt:departureTime": "10:03",
          "odpt:trainType": "odpt.TrainType:Odakyu.RapidExpress",
          "odpt:destinationStation": ["odpt.Station:Odakyu.Odawara.Shinjuku"],
        },
      ],
    },
  ]);
  assert.deepEqual(data.directions.up.weekday, [{ time: "10:03", type: "rapidExpress", dest: "新宿" }]);
  assert.deepEqual(data.directions.down.weekday, []);
});
