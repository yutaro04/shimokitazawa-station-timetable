// ODPT（公共交通オープンデータチャレンジ）の運行情報を中継する Cloudflare Worker。
//
// - API キー（ODPT_CONSUMER_KEY）は Worker のシークレットに置き、ブラウザには渡さない
// - ODPT の結果を有効期限までの間（30〜120 秒）使い回し、閲覧者の数に関係なく ODPT への呼び出しを抑える
// - 表示に必要な項目だけを返す
//
// GET /train-information → { items: [{ operator, railway, status, text, date, valid }], fetchedAt }

import { cacheSeconds, summarizeTrainInformation } from "./odpt.js";

const ODPT_ENDPOINT = "https://api-challenge.odpt.org/api/v4";
// 小田急はチャレンジでも運行情報を提供していないので京王のみ
const OPERATORS = ["odpt.Operator:Keio"];

// 同じ Worker インスタンスの中での使い回し。Cache API と併用する
let memo = null;

async function fetchFromOdpt(env) {
  const records = await Promise.all(
    OPERATORS.map(async (operator) => {
      // パラメータ名の「:」はエンコードせず、ODPT の仕様書どおりの形で送る
      const query = [
        `odpt:operator=${encodeURIComponent(operator)}`,
        `acl:consumerKey=${encodeURIComponent(env.ODPT_CONSUMER_KEY)}`,
      ].join("&");
      const res = await fetch(`${ODPT_ENDPOINT}/odpt:TrainInformation?${query}`);
      if (!res.ok) throw new Error(`ODPT ${operator}: HTTP ${res.status}`);
      return res.json();
    }),
  );
  return summarizeTrainInformation(records.flat());
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim());
  return origin && allowed.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
    : { Vary: "Origin" };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

async function trainInformation(request, env, ctx) {
  const now = Date.now();
  if (memo && memo.expires > now) return memo.body;

  const cache = caches.default;
  const cacheKey = new Request(new URL("/train-information", request.url));
  const cached = await cache.match(cacheKey);
  if (cached) {
    const body = await cached.json();
    memo = { body, expires: now + 10_000 };
    return body;
  }

  const items = await fetchFromOdpt(env);
  const seconds = cacheSeconds(items, now);
  const body = { items, fetchedAt: new Date(now).toISOString() };
  memo = { body, expires: now + seconds * 1000 };
  ctx.waitUntil(
    cache.put(cacheKey, json(body, 200, { "Cache-Control": `public, max-age=${seconds}` })),
  );
  return body;
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405, cors);

    const { pathname } = new URL(request.url);
    if (pathname !== "/train-information") return json({ error: "not found" }, 404, cors);
    if (!env.ODPT_CONSUMER_KEY) return json({ error: "ODPT_CONSUMER_KEY is not set" }, 500, cors);

    try {
      const body = await trainInformation(request, env, ctx);
      return json(body, 200, { ...cors, "Cache-Control": "no-store" });
    } catch (err) {
      console.error(err);
      // 古い情報は返さない（ガイドライン: 最新でない動的データは表示しない）
      return json({ error: "upstream unavailable" }, 502, cors);
    }
  },
};
