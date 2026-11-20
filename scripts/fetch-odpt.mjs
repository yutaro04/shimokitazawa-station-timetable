// ODPT API から下北沢駅の時刻表を取得し、data/*.json に保存する。
// 保存後は provider: "static" のまま実データで表示できる（ブラウザに API キーを渡さずに済む）。
//
//   ODPT_CONSUMER_KEY=xxxx node scripts/fetch-odpt.mjs

import { writeFile } from "node:fs/promises";
import { config } from "../js/config.js";
import { LINES } from "../js/lines.js";
import { fetchLineFromOdpt } from "../js/providers/odpt.js";

const consumerKey = process.env.ODPT_CONSUMER_KEY;
if (!consumerKey) {
  console.error("環境変数 ODPT_CONSUMER_KEY を設定してください");
  process.exit(1);
}

let failed = false;
for (const line of LINES) {
  try {
    const data = await fetchLineFromOdpt(line, { ...config.odpt, consumerKey });
    const path = `data/${line.id}.json`;
    await writeFile(new URL(`../${path}`, import.meta.url), `${JSON.stringify(data, null, 1)}\n`);
    const counts = Object.entries(data.directions)
      .map(([id, d]) => `${id}: 平日${d.weekday.length}本 / 土休日${d.holiday.length}本`)
      .join(", ");
    console.log(`wrote ${path} (${counts})`);
  } catch (err) {
    failed = true;
    console.error(`${line.id}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
