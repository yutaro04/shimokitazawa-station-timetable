// 運行日・ダイヤ種別の判定と、次の発車列車の抽出。

const DAY_MINUTES = 24 * 60;

// "HH:MM" を運行日の 0:00 からの分に変換する。
// 運行日の開始時刻より前（例: "00:15"）は深夜帯として 24 時以降に繰り上げる。
export function parseTime(hhmm, serviceDayStartHour) {
  const [h, m] = hhmm.split(":").map(Number);
  const minutes = h * 60 + m;
  return minutes < serviceDayStartHour * 60 ? minutes + DAY_MINUTES : minutes;
}

export function formatTime(minutes) {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 現在時刻が属する運行日（その日の 0:00）と、運行日 0:00 からの経過秒を返す。
export function serviceDay(now, serviceDayStartHour) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  if (now.getHours() < serviceDayStartHour) {
    date.setDate(date.getDate() - 1);
    seconds += DAY_MINUTES * 60;
  }
  return { date, seconds };
}

// 土日・祝日・年末年始は土休日ダイヤ。
export function dayType(date, holidays) {
  const dow = date.getDay();
  const md = `${date.getMonth() + 1}-${date.getDate()}`;
  const newYear = ["12-30", "12-31", "1-1", "1-2", "1-3"].includes(md);
  if (dow === 0 || dow === 6 || newYear || holidays.has(dateKey(date))) return "holiday";
  return "weekday";
}

// timetables: { weekday: [...], holiday: [...] }（各要素は { time, type, dest, cars }）
// 戻り値の各列車には、現在の運行日 0:00 からの分 `at` と、発車までの秒 `inSeconds` が付く。
export function upcomingDepartures(timetables, now, holidays, count, serviceDayStartHour) {
  const today = serviceDay(now, serviceDayStartHour);
  const tomorrow = new Date(today.date);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = [];
  for (const [date, offset] of [[today.date, 0], [tomorrow, DAY_MINUTES]]) {
    const trains = timetables[dayType(date, holidays)] ?? [];
    for (const train of trains) {
      const at = parseTime(train.time, serviceDayStartHour) + offset;
      const inSeconds = at * 60 - today.seconds;
      if (inSeconds < 0) continue;
      result.push({ ...train, at, inSeconds });
      if (result.length >= count) return result;
    }
  }
  return result;
}

export async function loadHolidays(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Set(Object.keys(await res.json()));
  } catch (err) {
    console.warn("祝日データを取得できませんでした。土日のみ休日扱いにします。", err);
    return new Set();
  }
}
