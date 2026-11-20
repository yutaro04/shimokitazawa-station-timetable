// 運行情報を ODPT 中継サーバー（worker/）から取得する。
// API キーは中継サーバーにだけ置き、ブラウザからは ODPT を直接呼ばない。

// 状況（status）があればそれで、なければ本文で判定する
function isNormal(status, text) {
  if (!status && !text) return true;
  return /平常|通常/.test(status ?? text);
}

// items: 中継サーバーが返す { operator, railway, status, text, date, valid } の配列。
// 路線を指定しない（会社全体の）情報は、その会社の全路線に表示する。
// 運行情報を提供していない路線（odpt.trainInformation が false）は対象外。
export function convertTrainInformation(lines, items, now = Date.now()) {
  const result = {};
  for (const line of lines) {
    if (!line.odpt.trainInformation) continue;
    const item = items.find(
      (i) =>
        i.operator === line.odpt.operator &&
        (!i.railway || i.railway === line.odpt.railway) &&
        // 有効期限を過ぎた情報は使わない
        !(i.valid && Date.parse(i.valid) < now),
    );
    result[line.id] = item
      ? { normal: isNormal(item.status, item.text), status: item.status, text: item.text, date: item.date }
      : null;
  }
  return result;
}

export async function fetchTrainInformation(lines, url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`運行情報の取得に失敗: HTTP ${res.status}`);
  const { items } = await res.json();
  return convertTrainInformation(lines, items);
}
