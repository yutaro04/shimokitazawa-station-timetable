// 表示とデータ取得の設定。
// URL パラメータでも上書きできる: ?provider=odpt&key=YOUR_CONSUMER_KEY

export const config = {
  // "static": data/*.json を読む / "odpt": ODPT API から直接取得する
  provider: "static",

  odpt: {
    endpoint: "https://api.odpt.org/api/v4",
    // API キーはリポジトリにコミットしないこと。URL の ?key= で渡すのがおすすめ。
    consumerKey: "",
  },

  // 運行情報（odpt:TrainInformation）を取り直す間隔（秒）。consumerKey があるときだけ取得する。
  trainInformationSeconds: 90,

  // 発車まで「あと◯分」がこの範囲のとき「走れば間に合う！」を表示する
  runToCatchMinutes: { from: 2, to: 3 },

  // 画面下に流す案内文。運行情報（遅延時）とサンプルデータの注意書きは自動で加わる。
  tickerMessages: [
    "表示の時刻は標準の発車時刻です。列車が遅れることがありますので、ご了承ください。",
  ],
  // 流れる速さ。1 秒あたりに進む距離を文字数で指定する
  tickerCharsPerSecond: 4,

  // data/weather.json を読み直す間隔（分）。ファイル自体は GitHub Actions が毎朝更新する。
  weatherReloadMinutes: 30,

  // 1 方面あたりに表示する本数
  rowsPerBoard: 3,
  // この時刻より前は前日の運行日として扱う（終電後〜始発前の境目）
  serviceDayStartHour: 3,
  // 祝日判定に使う API。取得できなければ土日のみを休日扱いにする。
  holidaysUrl: "https://holidays-jp.github.io/api/v1/date.json",
};

export function resolveConfig(search = location.search) {
  const params = new URLSearchParams(search);
  return {
    ...config,
    provider: params.get("provider") ?? config.provider,
    odpt: {
      ...config.odpt,
      consumerKey: params.get("key") ?? config.odpt.consumerKey,
    },
  };
}
