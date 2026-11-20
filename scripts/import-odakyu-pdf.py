"""小田急の「下北沢駅 時刻表」PDF から data/odakyu.json を作る。

    python3 scripts/import-odakyu-pdf.py ~/Downloads/shimo_kitazawa.pdf

PDF の構成（2026-03-14/16 改正版 shimo_kitazawa.pdf で確認）:
- 4 ページ。平日 新宿方面 / 土休日 新宿方面 / 平日 小田原方面 / 土休日 小田原方面 の順
- 文字はテキストではなくベクターの図形。同じ文字は同じ形なので、形のハッシュで文字を判定する
- 分の色で種別を表す: 白抜き（オレンジの箱）= 快速急行、赤 = 急行、緑 = 準急、青 = 各駅停車
  赤・緑の数字が同じ色の枠で囲まれていれば通勤急行・通勤準急
- 分の右肩の小さい文字が行先（新宿方面は無印 = 新宿）
レイアウトやフォントが変わると「形のわからない文字」で止まる。その場合は GLYPHS を作り直すこと。

PyMuPDF (fitz) が必要。両数は PDF に載っていないので出力しない。
"""

import datetime
import hashlib
import json
import pathlib
import sys

import fitz

PAGES = [("up", "weekday"), ("up", "holiday"), ("down", "weekday"), ("down", "holiday")]

# 図形の形のハッシュ → 文字（目視で確認済み）
GLYPHS = {
    "cabf2c34acc3": "0", "b3b3d2d5331d": "1", "fe747c72a862": "2", "d99bd3adf851": "3",
    "6cf80a23fc7e": "4", "c53524cddd84": "5", "5519a3d5df2e": "6", "5a0c0200c0fd": "7",
    "a9809f43b6c1": "8", "06c51d900130": "9",
    "22a118a58867": "快", "4842befdac9a": "準",
    "d090e8516db2": "柏", "66524f6cb8f6": "我", "86d88afd4c5e": "綾", "24749da34f03": "北",
    "fff74a007c24": "戸", "65d9dc8b32b6": "取",
    "9c3687276dcf": "伊", "3c3bb80bc4e3": "小", "b02ee2673763": "厚", "23b1ae42a2a7": "松",
    "91485ad4f4de": "向", "06b3fe91e0a9": "秦", "81caa7389b71": "藤", "505d9c7f2642": "唐",
    "a19165cbdad0": "唐", "8b622809820d": "成", "c755d9aa8f25": "大", "f7795dff6f86": "海",
    "bc72551bbe20": "百", "c8621580f68e": "経",
}

DESTINATIONS = {
    "up": {"": "新宿", "綾": "綾瀬", "北": "北綾瀬", "戸": "松戸", "柏": "柏", "我": "我孫子", "取": "取手"},
    "down": {
        "経": "経堂", "成": "成城学園前", "向": "向ヶ丘遊園", "百": "新百合ヶ丘", "大": "相模大野",
        "海": "海老名", "厚": "本厚木", "伊": "伊勢原", "秦": "秦野", "松": "新松田",
        "小": "小田原", "藤": "藤沢", "唐": "唐木田",
    },
}

WHITE, RED, GREEN, BLUE = (1.0, 1.0, 1.0), (0.94, 0.35, 0.13), (0.0, 0.68, 0.49), (0.0, 0.45, 0.74)
DARK = (0.14, 0.12, 0.13)
TYPES = {WHITE: "rapidExpress", RED: "express", GREEN: "semiExpress", BLUE: "local"}
COMMUTER = {"express": "commuterExpress", "semiExpress": "commuterSemiExpress"}

TABLE_TOP, TABLE_BOTTOM, HOUR_COLUMN_RIGHT = 70, 515, 35
SERVICE_DAY_START_HOUR = 3


def color(d):
    return tuple(round(v, 2) for v in d["fill"]) if d.get("fill") else None


def glyph_hash(d):
    r = d["rect"]
    parts = []
    for item in d["items"]:
        points = [p for p in item[1:] if isinstance(p, fitz.Point)]
        if item[0] == "re":
            points = [item[1].tl, item[1].br]
        coords = ",".join(f"{round((p.x - r.x0) * 2) / 2},{round((p.y - r.y0) * 2) / 2}" for p in points)
        parts.append(item[0] + coords)
    return hashlib.sha1("|".join(parts).encode()).hexdigest()[:12]


def extract_page(page, direction):
    drawings = [
        d for d in page.get_drawings()
        if color(d) and TABLE_TOP < d["rect"].y0 < TABLE_BOTTOM
    ]

    # 時の見出し（左端の濃い灰色の数字）を上から順に 4, 5, … 23, 0, 1 とみなす
    hour_glyphs = [
        d for d in drawings
        if color(d) == DARK and d["rect"].x0 < HOUR_COLUMN_RIGHT and 7 < d["rect"].height < 10
    ]
    hour_rows = []
    for d in sorted(hour_glyphs, key=lambda d: d["rect"].y0):
        center = (d["rect"].y0 + d["rect"].y1) / 2
        if not hour_rows or center - hour_rows[-1] > 3:
            hour_rows.append(center)
    hours = [(4 + i) % 24 for i in range(len(hour_rows))]

    # 分の数字（高さ 9〜12）を行ごとにまとめ、隣り合う数字を 1 つの数にする
    digits = [
        d for d in drawings
        if d["rect"].x0 > HOUR_COLUMN_RIGHT and 9 <= d["rect"].height <= 12 and color(d) in TYPES
    ]
    # 字形ごとに上端が少しずれるので、中心の高さで行に分けてから左から並べる
    lines = []
    for d in sorted(digits, key=lambda d: (d["rect"].y0 + d["rect"].y1) / 2):
        center = (d["rect"].y0 + d["rect"].y1) / 2
        if lines and center - lines[-1]["center"] < 2:
            lines[-1]["glyphs"].append(d)
        else:
            lines.append({"center": center, "glyphs": [d]})
    ordered = [d for line in lines for d in sorted(line["glyphs"], key=lambda d: d["rect"].x0)]

    numbers = []
    for d in ordered:
        ch = GLYPHS.get(glyph_hash(d))
        if ch is None or not ch.isdigit():
            sys.exit(f"形のわからない数字があります: page {page.number} {d['rect']}")
        r = d["rect"]
        last = numbers[-1] if numbers else None
        if last and abs(last["y0"] - r.y0) < 2 and -1.5 <= r.x0 - last["x1"] < 3 and last["color"] == color(d):
            last["text"] += ch
            last["x1"] = r.x1
        else:
            numbers.append({"text": ch, "x0": r.x0, "x1": r.x1, "y0": r.y0, "y1": r.y1, "color": color(d), "marks": ""})

    # 右肩の小さい文字（種別の印・行先）
    for d in drawings:
        r = d["rect"]
        if not (3.5 < r.height < 6):
            continue
        ch = GLYPHS.get(glyph_hash(d))
        if ch is None:
            continue  # 最終列車の印や連絡の注記は使わない
        # 同じ行で、印の左にある最も近い数字の印とする（箱付きの 1 桁は数字と印の間が広い）
        candidates = [
            n for n in numbers
            if -0.5 <= r.x0 - n["x1"] < 12 and n["y0"] - 3 < (r.y0 + r.y1) / 2 < n["y1"] + 1
        ]
        if not candidates:
            sys.exit(f"「{ch}」がどの列車の印か特定できません: page {page.number} {r}")
        max(candidates, key=lambda n: n["x1"])["marks"] += ch

    # 赤・緑の枠（中が白い四角）で囲まれた数字は通勤急行・通勤準急
    frames = [d["rect"] for d in drawings if color(d) in (RED, GREEN) and 13 < d["rect"].height < 17]

    trains, problems = [], []
    for n in numbers:
        center_y = (n["y0"] + n["y1"]) / 2
        row = min(range(len(hour_rows)), key=lambda i: abs(hour_rows[i] - center_y))
        hour = hours[row]
        if hour < SERVICE_DAY_START_HOUR:
            hour += 24
        train_type = TYPES[n["color"]]
        center = fitz.Point((n["x0"] + n["x1"]) / 2, center_y)
        if train_type in COMMUTER and any(f.contains(center) for f in frames):
            train_type = COMMUTER[train_type]

        type_mark = "".join(c for c in n["marks"] if c in "快準")
        dest_marks = "".join(c for c in n["marks"] if c not in "快準")
        if (train_type == "rapidExpress") != ("快" in type_mark):
            problems.append(f"{hour}:{n['text']} 種別の印が色と合いません ({type_mark})")
        if dest_marks not in DESTINATIONS[direction]:
            problems.append(f"{hour}:{n['text']} 行先の印がわかりません ({dest_marks or '無印'})")
            continue
        trains.append({
            "time": f"{hour:02d}:{int(n['text']):02d}",
            "type": train_type,
            "dest": DESTINATIONS[direction][dest_marks],
        })
    trains.sort(key=lambda t: t["time"])
    return trains, len(hour_rows), problems


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/import-odakyu-pdf.py <時刻表PDF>")
    pdf_path = pathlib.Path(sys.argv[1])
    doc = fitz.open(pdf_path)
    if len(doc) != len(PAGES):
        sys.exit(f"{len(PAGES)} ページの PDF を想定しています（{len(doc)} ページでした）")

    directions = {}
    all_problems = []
    for page, (direction, day) in zip(doc, PAGES):
        trains, rows, problems = extract_page(page, direction)
        directions.setdefault(direction, {})[day] = trains
        all_problems += [f"{direction} {day}: {p}" for p in problems]
        counts = {}
        for t in trains:
            counts[t["type"]] = counts.get(t["type"], 0) + 1
        print(f"{direction} {day}: {len(trains)}本 (時の行 {rows}) {counts}")

    if all_problems:
        sys.exit("\n".join(all_problems))

    data = {
        "source": "odakyu-pdf",
        "sourceFile": pdf_path.name,
        "updated": datetime.date.today().isoformat(),
        "directions": directions,
    }
    out = pathlib.Path(__file__).resolve().parent.parent / "data" / "odakyu.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
