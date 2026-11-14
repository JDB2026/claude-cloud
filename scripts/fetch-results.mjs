// 抓取最近一场正赛的成绩，写入 data/results.json。
// 数据来自 Jolpica-F1（Ergast 的兼容替代）。零依赖，需要 Node.js 18+。
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_URL = process.env.RESULTS_API ?? "https://api.jolpi.ca/ergast/f1/current/last/results.json";
const OUT_FILE = process.env.RESULTS_OUT ?? path.join(ROOT, "data", "results.json");
const MAX_RESULTS = 20;
const TIMEOUT_MS = 15000;

const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

function toResults(json) {
  const race = json?.MRData?.RaceTable?.Races?.[0];
  if (!race) throw new Error("响应中没有比赛数据");

  return {
    updatedAt: new Date().toISOString(),
    season: race.season,
    round: num(race.round),
    raceName: race.raceName,
    date: race.date,
    time: race.time ?? null,
    circuit: race.Circuit?.circuitName ?? "",
    location: [race.Circuit?.Location?.locality, race.Circuit?.Location?.country].filter(Boolean).join(", "),
    results: (race.Results ?? []).slice(0, MAX_RESULTS).map((r) => ({
      position: num(r.position),
      driver: `${r.Driver?.givenName ?? ""} ${r.Driver?.familyName ?? ""}`.trim(),
      code: r.Driver?.code ?? "",
      team: r.Constructor?.name ?? "",
      grid: num(r.grid),
      laps: num(r.laps),
      status: r.status ?? "",
      time: r.Time?.time ?? null,
      points: num(r.points),
    })),
  };
}

async function main() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      signal: ctrl.signal,
      headers: { "User-Agent": "f1-news-aggregator/1.0", Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = toResults(await res.json());
    await mkdir(path.dirname(OUT_FILE), { recursive: true });
    await writeFile(OUT_FILE, JSON.stringify(data, null, 2) + "\n");
    console.log(`✓ ${data.season} Round ${data.round}: ${data.raceName}（${data.results.length} 位车手），已写入 ${path.relative(ROOT, OUT_FILE)}`);
  } finally {
    clearTimeout(timer);
  }
}

main().catch((err) => {
  console.error(`✗ 成绩抓取失败: ${err.name === "AbortError" ? "超时" : err.message}，保留已有的结果文件。`);
  process.exitCode = 1;
});
