// ODPT の運行情報を、発車標の表示に必要な項目だけに絞る。
// 中継サーバー（index.js）とテストの両方から使うため、Workers 固有の API には依存しない。

// ODPT の多言語文字列は { ja, en } のオブジェクトか、ただの文字列で返ってくる
const jaString = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.ja ?? value.en ?? null;
};

export function summarizeTrainInformation(records) {
  return records.map((r) => ({
    operator: r["odpt:operator"] ?? null,
    railway: r["odpt:railway"] ?? null,
    status: jaString(r["odpt:trainInformationStatus"]),
    text: jaString(r["odpt:trainInformationText"]),
    // ガイドライン上、生成時刻（dc:date）は画面に出し、有効期限（dct:valid）を過ぎたら使わない
    date: r["dc:date"] ?? null,
    valid: r["dct:valid"] ?? null,
  }));
}

// 結果を使い回す秒数。いちばん早い有効期限までの残り時間を、min〜max の範囲に収める
export function cacheSeconds(items, now, { min = 30, max = 120 } = {}) {
  const remaining = items
    .map((item) => (item.valid ? (Date.parse(item.valid) - now) / 1000 : NaN))
    .filter((s) => Number.isFinite(s));
  if (remaining.length === 0) return max;
  return Math.min(max, Math.max(min, Math.floor(Math.min(...remaining))));
}
