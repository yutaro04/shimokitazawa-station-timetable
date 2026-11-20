"""京王の「下北沢駅 発車標準時刻表」PDF から data/inokashira.json を作る。

    python3 scripts/import-keio-pdf.py ~/Downloads/997.pdf

PDF の構成（2026-11 時点の 997.pdf で確認）:
- 1 ページに 4 表。上段が渋谷方面、下段が明大前・吉祥寺方面、左が平日、右が土曜・休日
- 時の見出しは白文字、分は緑 (#07ae11) が急行、濃灰 (#333333) が各駅停車
- 行先が富士見ヶ丘の列車は、分の真上に小さい「富」が付く
レイアウトが変わったら、各表の列車数・急行数・「富」の数の出力を元の PDF と見比べること。

PyMuPDF (fitz) が必要。
"""

import datetime
import json
import pathlib
import sys

import fitz

GREEN, GRAY, WHITE = 0x07AE11, 0x333333, 0xFFFFFF
HOUR_LABEL_SIZE = 11.2
MARK_MAX_SIZE = 5  # 凡例の「富」(5.5pt) と区別する
MINUTE_MIN_SIZE = 7  # 凡例の「00」(5.5pt) と区別する
SERVICE_DAY_START_HOUR = 3

DESTINATIONS = {"shibuya": "渋谷", "kichijoji": "吉祥寺"}
MARK_DESTINATION = "富士見ヶ丘"


def extract(pdf_path):
    page = fitz.open(pdf_path)[0]
    width, height = page.rect.width, page.rect.height
    minutes, marks, hours = [], [], []

    for block in page.get_text("rawdict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                digits = []

                def flush():
                    if not digits:
                        return
                    x0 = min(c["bbox"][0] for c in digits)
                    x1 = max(c["bbox"][2] for c in digits)
                    y0 = min(c["bbox"][1] for c in digits)
                    y1 = max(c["bbox"][3] for c in digits)
                    item = {"text": "".join(c["c"] for c in digits), "x": (x0 + x1) / 2, "y": (y0 + y1) / 2}
                    if span["color"] == WHITE and round(span["size"], 1) == HOUR_LABEL_SIZE:
                        hours.append(item)
                    elif span["color"] in (GREEN, GRAY) and span["size"] > MINUTE_MIN_SIZE:
                        minutes.append({**item, "express": span["color"] == GREEN, "mark": False})
                    digits.clear()

                for c in span["chars"]:
                    if c["c"].isdigit():
                        digits.append(c)
                        continue
                    flush()
                    if c["c"] == "富" and span["size"] < MARK_MAX_SIZE:
                        x0, y0, x1, y1 = c["bbox"]
                        marks.append({"x": (x0 + x1) / 2, "y": (y0 + y1) / 2})
                flush()

    def table_of(item):
        day = "weekday" if item["x"] < width / 2 else "holiday"
        direction = "shibuya" if item["y"] < height / 2 else "kichijoji"
        return direction, day

    hours_by_table = {}
    for h in hours:
        hours_by_table.setdefault(table_of(h), []).append(h)

    rows = {}
    for m in minutes:
        table = table_of(m)
        hour = min(hours_by_table[table], key=lambda h: abs(h["y"] - m["y"]))
        if abs(hour["y"] - m["y"]) > 6:
            sys.exit(f"時の行を特定できない分があります: {m}")
        rows.setdefault(table, []).append((int(hour["text"]), m))

    # 「富」は数字の真上: 同じ表で、少し下にあり x が最も近い数字に付ける
    for mark in marks:
        candidates = [m for _, m in rows[table_of(mark)] if 0 < m["y"] - mark["y"] < 8]
        nearest = min(candidates, key=lambda m: abs(m["x"] - mark["x"]), default=None)
        if nearest is None or abs(nearest["x"] - mark["x"]) > 4:
            sys.exit(f"「富」の付く列車を特定できません: {mark}")
        nearest["mark"] = True

    directions = {}
    for (direction, day), items in rows.items():
        trains = []
        for hour, m in items:
            if hour < SERVICE_DAY_START_HOUR:
                hour += 24
            trains.append(
                {
                    "time": f"{hour:02d}:{m['text']}",
                    "type": "express" if m["express"] else "local",
                    "dest": MARK_DESTINATION if m["mark"] else DESTINATIONS[direction],
                    "cars": 5,
                }
            )
        trains.sort(key=lambda t: t["time"])
        directions.setdefault(direction, {})[day] = trains
    return directions


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/import-keio-pdf.py <時刻表PDF>")
    pdf_path = pathlib.Path(sys.argv[1])
    directions = extract(pdf_path)

    for direction in ("shibuya", "kichijoji"):
        for day in ("weekday", "holiday"):
            trains = directions[direction][day]
            express = sum(t["type"] == "express" for t in trains)
            marked = sum(t["dest"] == MARK_DESTINATION for t in trains)
            print(f"{direction} {day}: {len(trains)}本 (急行 {express} / 富士見ヶ丘行 {marked})")

    data = {
        "source": "keio-pdf",
        "sourceFile": pdf_path.name,
        "updated": datetime.date.today().isoformat(),
        "directions": {d: directions[d] for d in ("shibuya", "kichijoji")},
    }
    out = pathlib.Path(__file__).resolve().parent.parent / "data" / "inokashira.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
