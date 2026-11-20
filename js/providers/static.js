// data/<路線ID>.json を読み込むプロバイダ。

export async function loadStatic(lines, baseUrl = "data/") {
  const entries = await Promise.all(
    lines.map(async (line) => {
      const res = await fetch(`${baseUrl}${line.id}.json`);
      if (!res.ok) throw new Error(`${line.id}.json を読み込めませんでした (HTTP ${res.status})`);
      return [line.id, await res.json()];
    }),
  );
  return Object.fromEntries(entries);
}
