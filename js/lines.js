// 路線・方面・種別の定義。色や表記を変えたいときはここを編集する。

export const LINES = [
  {
    id: "odakyu",
    name: "小田急線",
    symbol: "OH",
    stationNumber: "OH07",
    color: "#0d82c7",
    odpt: {
      operator: "odpt.Operator:Odakyu",
      railway: "odpt.Railway:Odakyu.Odawara",
      // ODPT（チャレンジ含む）で運行情報が提供されていない
      trainInformation: false,
    },
    directions: [
      { id: "up", label: "新宿・千代田線方面" },
      { id: "down", label: "小田原・江ノ島・多摩線方面" },
    ],
    trainTypes: {
      local: { name: "各停", color: "#0000f0" },
      semiExpress: { name: "準急", color: "#007f00" },
      commuterSemiExpress: { name: "通勤準急", color: "#00809a" },
      express: { name: "急行", color: "#f00000" },
      commuterExpress: { name: "通勤急行", color: "#b0007a" },
      rapidExpress: { name: "快速急行", color: "#f67b01" },
    },
  },
  {
    id: "inokashira",
    name: "京王井の頭線",
    symbol: "IN",
    stationNumber: "IN05",
    color: "#2b3f94",
    odpt: {
      operator: "odpt.Operator:Keio",
      railway: "odpt.Railway:Keio.Inokashira",
      // チャレンジ限定データとして運行情報あり（worker/ の中継サーバー経由で取得）
      trainInformation: true,
    },
    directions: [
      { id: "shibuya", label: "渋谷方面" },
      { id: "kichijoji", label: "明大前・吉祥寺方面" },
    ],
    trainTypes: {
      local: { name: "各停", color: "#0000f0" },
      express: { name: "急行", color: "#007f00" },
    },
  },
];
