// ODPT の odpt:TrainInformation から路線ごとの運行情報を取得する。
// 時刻表のプロバイダとは独立していて、consumerKey があれば static でも使える。
//
// 注意: 小田急・京王の運行情報が ODPT で取得できるか、路線 ID が正しいかは未確認。

// ODPT の多言語文字列は { ja, en } のオブジェクトか、ただの文字列で返ってくる
function jaString(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.ja ?? value.en ?? null;
}

// 状況（status）があればそれで、なければ本文で判定する
function isNormal(status, text) {
  if (!status && !text) return true;
  return /平常|通常/.test(status ?? text);
}

// records: ODPT のレスポンス配列。路線を指定しない（会社全体の）情報は、その会社の全路線に表示する。
export function convertTrainInformation(lines, records) {
  const result = {};
  for (const line of lines) {
    const record = records.find(
      (r) =>
        r["odpt:operator"] === line.odpt.operator &&
        (!r["odpt:railway"] || r["odpt:railway"] === line.odpt.railway),
    );
    if (!record) {
      result[line.id] = null;
      continue;
    }
    const status = jaString(record["odpt:trainInformationStatus"]);
    const text = jaString(record["odpt:trainInformationText"]);
    result[line.id] = {
      normal: isNormal(status, text),
      status,
      text,
      date: record["dc:date"] ?? null,
    };
  }
  return result;
}

export async function fetchTrainInformation(lines, { endpoint, consumerKey }) {
  const operators = [...new Set(lines.map((l) => l.odpt.operator))];
  const records = (
    await Promise.all(
      operators.map(async (operator) => {
        const url = new URL(`${endpoint}/odpt:TrainInformation`);
        url.searchParams.set("odpt:operator", operator);
        url.searchParams.set("acl:consumerKey", consumerKey);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`運行情報の取得に失敗 (${operator}): HTTP ${res.status}`);
        return res.json();
      }),
    )
  ).flat();
  return convertTrainInformation(lines, records);
}
