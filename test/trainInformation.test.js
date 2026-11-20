import { test } from "node:test";
import assert from "node:assert/strict";
import { convertTrainInformation } from "../js/trainInformation.js";
import { LINES } from "../js/lines.js";

test("路線ごとに運行情報を振り分け、平常かどうかを判定する", () => {
  const info = convertTrainInformation(LINES, [
    {
      "odpt:operator": "odpt.Operator:Odakyu",
      "odpt:railway": "odpt.Railway:Odakyu.Odawara",
      "odpt:trainInformationStatus": { ja: "遅延", en: "Delay" },
      "odpt:trainInformationText": { ja: "人身事故の影響で遅れが出ています。", en: "Delays due to an accident." },
      "dc:date": "2026-11-20T08:12:00+09:00",
    },
    {
      "odpt:operator": "odpt.Operator:Keio",
      "odpt:trainInformationText": "現在、平常どおり運転しています。",
    },
  ]);
  assert.equal(info.odakyu.normal, false);
  assert.equal(info.odakyu.status, "遅延");
  assert.equal(info.odakyu.text, "人身事故の影響で遅れが出ています。");
  assert.equal(info.odakyu.date, "2026-11-20T08:12:00+09:00");
  // 路線指定のない会社全体の情報も対象路線に表示する。本文はただの文字列でもよい
  assert.equal(info.inokashira.normal, true);
  assert.equal(info.inokashira.text, "現在、平常どおり運転しています。");
});

test("他路線の情報は無視し、該当がなければ null", () => {
  const info = convertTrainInformation(LINES, [
    {
      "odpt:operator": "odpt.Operator:Odakyu",
      "odpt:railway": "odpt.Railway:Odakyu.Enoshima",
      "odpt:trainInformationStatus": { ja: "運転見合わせ" },
    },
  ]);
  assert.equal(info.odakyu, null);
  assert.equal(info.inokashira, null);
});
