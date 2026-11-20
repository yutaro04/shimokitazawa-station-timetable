# shimokitazawa-station-timetable

下北沢駅を発着する小田急線と京王井の頭線の発車案内を、駅の液晶発車標のように表示する Web ページです。
4 つの方面（小田急 上り/下り、井の頭線 渋谷/吉祥寺）について、次の 3 本の種別・時刻・行先・両数・発車までの時間を出します。

ビルドは不要です。HTML/CSS/JS（ES Modules）だけで動きます。

ブラウザの画面いっぱいに表示し、文字の大きさは画面サイズに合わせて変わります。横長の画面では 2 路線を左右に、縦長の画面では上下に並べます。画面をダブルクリックするか F キーを押すと、全画面表示に切り替わります。

## 起動

ES Modules と `fetch` を使うので、`index.html` をファイルとして直接開くのではなく、HTTP サーバー経由で開いてください。

```sh
npm start                     # http://localhost:8080
# または
python3 -m http.server 8080
```

## 時刻表データ

| プロバイダ | 設定 | 説明 |
| --- | --- | --- |
| `static`（既定） | `js/config.js` の `provider: "static"` | `data/odakyu.json` と `data/inokashira.json` を読む |
| `odpt` | `?provider=odpt&key=<consumerKey>` | [ODPT](https://developer.odpt.org/) の `odpt:StationTimetable` からブラウザで直接取得する |

| 路線 | 同梱データ |
| --- | --- |
| 京王井の頭線 | 京王の「下北沢駅 発車標準時刻表」PDF から取り込んだ実データ |
| 小田急線 | 小田急の「下北沢駅 時刻表」PDF（2026 年 3 月 14 日・16 日改正）から取り込んだ実データ。両数は PDF にないため表示しません |

`source` が `"sample"` の路線があると、画面下を流れる案内にサンプルである旨を表示します。

### 実データに差し替える

- **京王の時刻表 PDF から取り込む場合（井の頭線）**: ダイヤ改正で新しい PDF が出たら、次を実行します。PyMuPDF が必要です。各表の本数・急行・富士見ヶ丘行の数が出力されるので、PDF と見比べてください。

  ```sh
  python3 scripts/import-keio-pdf.py ~/Downloads/997.pdf
  ```

- **小田急の時刻表 PDF から取り込む場合（小田急線）**: 同じく次を実行します。PDF の文字は図形なので、数字や行先の印を形で見分けています。フォントやレイアウトが変わって見分けられない文字があると止まるので、そのときはスクリプト冒頭の説明に従って `GLYPHS` を作り直してください。

  ```sh
  python3 scripts/import-odakyu-pdf.py ~/Downloads/shimo_kitazawa.pdf
  ```

- **手で書く場合**: 下の形式で `data/<路線ID>.json` を編集します。ダイヤ改正のたびに更新が必要です。
- **ODPT から取り込む場合**: API キーを取得したうえで、次を実行します。保存した JSON は `static` プロバイダでそのまま使えるので、ブラウザに API キーを渡さずに済みます。

  ```sh
  ODPT_CONSUMER_KEY=xxxx npm run fetch:odpt
  ```

  このスクリプトは井の頭線の `data/inokashira.json` も上書きします。
  小田急・京王の下北沢駅のデータが ODPT で公開されているか、駅 ID（`js/lines.js` の `odpt.station`）が正しいかはまだ確認していません。取得に失敗したら、ODPT のデータカタログで確認して直してください。

### データ形式

```jsonc
{
  "source": "sample",            // "sample" のときだけ注意書きを表示
  "updated": "2026-11-20",
  "directions": {
    "up": {                      // 方面 ID（js/lines.js の directions[].id）
      "weekday": [ { "time": "05:01", "type": "local", "dest": "新宿", "cars": 10 } ],
      "holiday": [ ... ]
    }
  }
}
```

- `time` は `"24:20"` 形式でも `"00:20"` 形式でも構いません。3 時より前の時刻は前日の運行日の深夜として扱います（`serviceDayStartHour`）。
- `type` は `js/lines.js` の `trainTypes` のキーです。種別名と色はそこで変えられます。
- `cars` は省略できます。

## 天気

「平日ダイヤ」の左に、世田谷区の今日の天気・最高/最低気温・日の出/日の入りを表示します。

- データは [Open-Meteo](https://open-meteo.com/) から取得し、`data/weather.json` に保存します（API キー不要）。手元で更新するときは `node scripts/fetch-weather.mjs` を実行します。
- GitHub Actions（`.github/workflows/deploy.yml`）が毎朝 5:00 に取得・コミット・push し、そのまま GitHub Pages に公開します。Actions タブから手動でも実行できます。
- ページは `data/weather.json` を 30 分ごとに読み直します。日付が今日でないデータは表示しません。
- 予報データは世田谷区役所付近の地点のもので、気象庁の発表とは違うことがあります。

## GitHub Pages で公開する

1. Settings → Pages → Source を「GitHub Actions」にする
2. `main` に push すると `.github/workflows/deploy.yml` が公開する

## 画面下を流れる案内

電光掲示板のように、画面下で案内文を右から左へ流します。1 周ごとに内容を作り直します。

- 流す文は `js/config.js` の `tickerMessages` で設定します。速さは `tickerCharsPerSecond`（1 秒に進む文字数）で変えられます。
- 遅延などの運行情報と、サンプルデータの注意書きは自動で加わります。
- OS で動きを減らす設定にしている場合は、流さずにそのまま表示します。

## 運行情報

ODPT の consumerKey を渡すと、路線ごとの運行情報（`odpt:TrainInformation`）を 90 秒おきに取得して、路線名の下に表示します。時刻表のプロバイダが `static` のままでも使えます。

```
http://localhost:8080/?key=<consumerKey>
```

- 平常時は「運行情報 平常運転」とだけ表示します。遅延や運転見合わせのときは黄色の枠にして、本文と発表時刻も表示します。画面下を流れる案内にも加わります。
- 対象は小田急小田原線と京王井の頭線だけです（`js/lines.js` の `odpt.railway`）。路線を指定していない会社全体の情報も表示します。江ノ島線や多摩線の情報は出しません。
- 取得に失敗したときは、前回取得した内容を表示したままにします。一度も取得できていなければ「取得できません」と表示します。
- consumerKey がなければ、運行情報の欄自体を出しません。
- 小田急・京王の運行情報が ODPT で取得できるか、路線 ID が正しいかは、まだ確認していません。

## ダイヤの判定

- 土日、祝日、12/30〜1/3 は土休日ダイヤで表示します。
- 祝日は [holidays-jp](https://holidays-jp.github.io/) から取得します。取得できない場合は土日だけを休日として扱います。
- 終電が出たあとは、翌運行日の始発から表示します。

## 構成

```
index.html
css/board.css
js/
  config.js            設定（URL パラメータで上書き可）
  lines.js             路線・方面・種別の定義、駅名のローマ字表記（ODPT 用）
  timetable.js         運行日・ダイヤ種別の判定、次発の抽出
  trainInformation.js  運行情報の取得
  weather.js           天気の表示
  main.js              描画
  providers/           static / odpt の読み込みと共通形式への変換
data/                  時刻表・天気の JSON
scripts/               京王・小田急の PDF 取り込み・ODPT 取り込み・天気取得
.github/workflows/     GitHub Pages への公開と毎朝の天気更新
test/                  node --test によるテスト
```

```sh
npm test
```
