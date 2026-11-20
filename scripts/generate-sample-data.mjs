// 動作確認用のサンプル時刻表を data/odakyu.json に書き出す。
// 井の頭線は実データ（scripts/import-keio-pdf.py）なので対象外。
// 実際のダイヤではなく、それらしい運転間隔で機械的に作ったもの。
//
//   node scripts/generate-sample-data.mjs

import { writeFile } from "node:fs/promises";

// 再実行しても同じ結果になるよう、乱数は固定シードで作る
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const hm = (s) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// blocks: [開始, 終了, 周期(分), [[周期内の分, 種別, 行先候補, 両数候補], ...]]
function generate(blocks, phase, seed) {
  const rand = seededRandom(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const trains = [];
  for (const [from, to, cycle, pattern] of blocks) {
    for (let base = hm(from) + phase; base < hm(to); base += cycle) {
      for (const [offset, type, dests, cars] of pattern) {
        const at = base + offset;
        if (at >= hm(to)) continue;
        trains.push({ time: fmt(at), type, dest: pick(dests), cars: pick(cars) });
      }
    }
  }
  return trains.sort((a, b) => hm(a.time) - hm(b.time));
}

const TEN = [10];
const LOCAL_CARS = [10, 10, 8, 6];
const CHIYODA = ["綾瀬", "北千住", "我孫子", "取手"];

const odakyuUp = {
  weekday: [
    ["05:00", "06:30", 15, [[0, "local", ["新宿"], LOCAL_CARS], [6, "semiExpress", CHIYODA, TEN], [11, "local", ["新宿", "代々木上原"], LOCAL_CARS]]],
    ["06:30", "09:30", 10, [[0, "commuterSemiExpress", CHIYODA, TEN], [2, "local", ["新宿"], LOCAL_CARS], [5, "commuterExpress", ["新宿"], TEN], [7, "rapidExpress", ["新宿"], TEN], [9, "local", ["代々木上原", "新宿"], LOCAL_CARS]]],
    ["09:30", "17:00", 20, [[0, "rapidExpress", ["新宿"], TEN], [3, "local", ["新宿"], LOCAL_CARS], [7, "express", ["新宿"], TEN], [10, "semiExpress", CHIYODA, TEN], [13, "local", ["新宿"], LOCAL_CARS], [17, "express", ["新宿"], TEN]]],
    ["17:00", "22:00", 15, [[0, "rapidExpress", ["新宿"], TEN], [4, "local", ["新宿"], LOCAL_CARS], [8, "express", ["新宿"], TEN], [11, "semiExpress", CHIYODA, TEN]]],
    ["22:00", "24:30", 15, [[0, "express", ["新宿"], TEN], [6, "local", ["新宿"], LOCAL_CARS], [11, "local", ["代々木上原", "新宿"], LOCAL_CARS]]],
  ],
  holiday: [
    ["05:00", "07:00", 15, [[0, "local", ["新宿"], LOCAL_CARS], [6, "semiExpress", CHIYODA, TEN], [11, "local", ["新宿"], LOCAL_CARS]]],
    ["07:00", "21:00", 20, [[0, "rapidExpress", ["新宿"], TEN], [3, "local", ["新宿"], LOCAL_CARS], [7, "express", ["新宿"], TEN], [10, "semiExpress", CHIYODA, TEN], [13, "local", ["新宿"], LOCAL_CARS], [17, "express", ["新宿"], TEN]]],
    ["21:00", "24:30", 15, [[0, "express", ["新宿"], TEN], [6, "local", ["新宿"], LOCAL_CARS], [11, "local", ["代々木上原", "新宿"], LOCAL_CARS]]],
  ],
};

const odakyuDown = {
  weekday: [
    ["05:00", "06:30", 15, [[2, "local", ["本厚木", "向ヶ丘遊園"], LOCAL_CARS], [9, "express", ["小田原", "本厚木"], TEN]]],
    ["06:30", "09:30", 12, [[0, "local", ["本厚木", "成城学園前"], LOCAL_CARS], [4, "express", ["小田原", "藤沢", "本厚木"], TEN], [8, "rapidExpress", ["小田原", "藤沢", "唐木田"], TEN]]],
    ["09:30", "17:00", 20, [[1, "rapidExpress", ["小田原", "藤沢", "片瀬江ノ島"], TEN], [5, "local", ["本厚木", "向ヶ丘遊園"], LOCAL_CARS], [9, "express", ["小田原", "唐木田", "本厚木"], TEN], [12, "semiExpress", ["本厚木", "向ヶ丘遊園"], TEN], [15, "local", ["唐木田", "新百合ヶ丘"], LOCAL_CARS], [18, "express", ["唐木田", "新松田"], TEN]]],
    ["17:00", "22:00", 12, [[0, "rapidExpress", ["小田原", "藤沢", "唐木田"], TEN], [3, "local", ["本厚木", "向ヶ丘遊園"], LOCAL_CARS], [7, "express", ["本厚木", "小田原", "唐木田"], TEN], [10, "semiExpress", ["本厚木"], TEN]]],
    ["22:00", "24:45", 15, [[0, "express", ["本厚木", "新松田", "唐木田"], TEN], [5, "local", ["本厚木", "向ヶ丘遊園", "成城学園前"], LOCAL_CARS], [10, "local", ["新百合ヶ丘"], LOCAL_CARS]]],
  ],
  holiday: [
    ["05:00", "07:00", 15, [[2, "local", ["本厚木", "向ヶ丘遊園"], LOCAL_CARS], [9, "express", ["小田原", "本厚木"], TEN]]],
    ["07:00", "21:00", 20, [[1, "rapidExpress", ["小田原", "藤沢", "片瀬江ノ島"], TEN], [5, "local", ["本厚木", "向ヶ丘遊園"], LOCAL_CARS], [9, "express", ["小田原", "唐木田", "本厚木"], TEN], [12, "semiExpress", ["本厚木", "向ヶ丘遊園"], TEN], [15, "local", ["唐木田", "新百合ヶ丘"], LOCAL_CARS], [18, "express", ["唐木田", "新松田"], TEN]]],
    ["21:00", "24:45", 15, [[0, "express", ["本厚木", "新松田", "唐木田"], TEN], [5, "local", ["本厚木", "向ヶ丘遊園"], LOCAL_CARS], [10, "local", ["新百合ヶ丘"], LOCAL_CARS]]],
  ],
};

const build = (directions, seed) => ({
  source: "sample",
  updated: new Date().toISOString().slice(0, 10),
  directions: Object.fromEntries(
    Object.entries(directions).map(([id, [blocks, phase]], i) => [
      id,
      {
        weekday: generate(blocks.weekday, phase, seed + i * 2),
        holiday: generate(blocks.holiday, phase, seed + i * 2 + 1),
      },
    ]),
  ),
});

const outputs = {
  "data/odakyu.json": build({ up: [odakyuUp, 1], down: [odakyuDown, 0] }, 7),
};

for (const [path, data] of Object.entries(outputs)) {
  await writeFile(new URL(`../${path}`, import.meta.url), `${JSON.stringify(data, null, 1)}\n`);
  console.log(`wrote ${path}`);
}
