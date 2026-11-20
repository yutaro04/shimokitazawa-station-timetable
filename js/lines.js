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
      station: "odpt.Station:Odakyu.Odawara.ShimoKitazawa",
    },
    directions: [
      {
        id: "up",
        label: "新宿・千代田線方面",
        odptRailDirection: "odpt.RailDirection:Inbound",
      },
      {
        id: "down",
        label: "小田原・江ノ島・多摩線方面",
        odptRailDirection: "odpt.RailDirection:Outbound",
      },
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
      station: "odpt.Station:Keio.Inokashira.ShimoKitazawa",
    },
    directions: [
      {
        id: "shibuya",
        label: "渋谷方面",
        odptRailDirection: "odpt.RailDirection:Inbound",
      },
      {
        id: "kichijoji",
        label: "明大前・吉祥寺方面",
        odptRailDirection: "odpt.RailDirection:Outbound",
      },
    ],
    trainTypes: {
      local: { name: "各停", color: "#0000f0" },
      express: { name: "急行", color: "#007f00" },
    },
  },
];

// 駅名のローマ字表記。ODPT の駅 ID 末尾から日本語の駅名を引くのに使う。
export const STATION_NAMES_EN = {
  新宿: "Shinjuku",
  代々木上原: "Yoyogi-Uehara",
  北千住: "Kita-Senju",
  綾瀬: "Ayase",
  我孫子: "Abiko",
  北綾瀬: "Kita-Ayase",
  松戸: "Matsudo",
  柏: "Kashiwa",
  取手: "Toride",
  経堂: "Kyodo",
  成城学園前: "Seijogakuen-mae",
  向ヶ丘遊園: "Mukogaoka-yuen",
  新百合ヶ丘: "Shin-Yurigaoka",
  相模大野: "Sagami-Ono",
  海老名: "Ebina",
  伊勢原: "Isehara",
  秦野: "Hadano",
  唐木田: "Karakida",
  本厚木: "Hon-Atsugi",
  新松田: "Shin-Matsuda",
  小田原: "Odawara",
  藤沢: "Fujisawa",
  片瀬江ノ島: "Katase-Enoshima",
  渋谷: "Shibuya",
  明大前: "Meidaimae",
  永福町: "Eifukucho",
  富士見ヶ丘: "Fujimigaoka",
  久我山: "Kugayama",
  吉祥寺: "Kichijoji",
};
