import { test } from "node:test";
import assert from "node:assert/strict";
import { convertTrainInformation } from "../js/trainInformation.js";
import { cacheSeconds, summarizeTrainInformation } from "../worker/src/odpt.js";
import { LINES } from "../js/lines.js";

const NOW = Date.parse("2026-11-20T08:15:00+09:00");

test("中継サーバーは表示に必要な項目だけを日本語で返す", () => {
  const items = summarizeTrainInformation([
    {
      "@id": "urn:ucode:xxx",
      "odpt:operator": "odpt.Operator:Keio",
      "odpt:railway": "odpt.Railway:Keio.Inokashira",
      "odpt:trainInformationStatus": { ja: "遅延", en: "Delay" },
      "odpt:trainInformationText": { ja: "人身事故の影響で遅れが出ています。", en: "Delays." },
      "dc:date": "2026-11-20T08:12:00+09:00",
      "dct:valid": "2026-11-20T08:17:00+09:00",
    },
  ]);
  assert.deepEqual(items, [
    {
      operator: "odpt.Operator:Keio",
      railway: "odpt.Railway:Keio.Inokashira",
      status: "遅延",
      text: "人身事故の影響で遅れが出ています。",
      date: "2026-11-20T08:12:00+09:00",
      valid: "2026-11-20T08:17:00+09:00",
    },
  ]);
});

test("キャッシュする秒数は有効期限までの残りを 30〜120 秒に収める", () => {
  const at = (iso) => [{ valid: iso }];
  assert.equal(cacheSeconds(at("2026-11-20T08:16:00+09:00"), NOW), 60);
  assert.equal(cacheSeconds(at("2026-11-20T08:15:10+09:00"), NOW), 30);
  assert.equal(cacheSeconds(at("2026-11-20T09:00:00+09:00"), NOW), 120);
  assert.equal(cacheSeconds([{ valid: null }], NOW), 120);
});

test("路線ごとに振り分け、平常かどうかを判定する。運行情報のない小田急は対象外", () => {
  const info = convertTrainInformation(
    LINES,
    [
      {
        operator: "odpt.Operator:Keio",
        railway: "odpt.Railway:Keio.Inokashira",
        status: "遅延",
        text: "人身事故の影響で遅れが出ています。",
        date: "2026-11-20T08:12:00+09:00",
        valid: "2026-11-20T08:17:00+09:00",
      },
    ],
    NOW,
  );
  assert.equal(info.inokashira.normal, false);
  assert.equal(info.inokashira.status, "遅延");
  assert.equal(info.inokashira.date, "2026-11-20T08:12:00+09:00");
  assert.equal("odakyu" in info, false);
});

test("会社全体の情報も対象路線に表示し、有効期限切れの情報は使わない", () => {
  const companyWide = { operator: "odpt.Operator:Keio", railway: null, status: null, text: "現在、平常どおり運転しています。" };
  assert.equal(convertTrainInformation(LINES, [companyWide], NOW).inokashira.normal, true);

  const expired = { ...companyWide, valid: "2026-11-20T08:14:59+09:00" };
  assert.equal(convertTrainInformation(LINES, [expired], NOW).inokashira, null);

  const otherLine = { ...companyWide, railway: "odpt.Railway:Keio.Keio" };
  assert.equal(convertTrainInformation(LINES, [otherLine], NOW).inokashira, null);
});
