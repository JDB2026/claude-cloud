// 抓取 feeds.json 中的 RSS/Atom 源，合并、去重、排序后写入 data/news.json。
// 零依赖，需要 Node.js 18+。
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FEEDS_FILE = process.env.FEEDS_FILE ?? path.join(ROOT, "feeds.json");
const OUT_FILE = process.env.OUT_FILE ?? path.join(ROOT, "data", "news.json");
const MAX_ITEMS = 150;
const MAX_AGE_DAYS = 30;
const SUMMARY_LEN = 220;
const TIMEOUT_MS = 15000;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function clean(raw = "") {
  const decodeEntities = (str) => str.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
  const stripTags = (str) => str.replace(/<[^>]+>/g, " ");
  // 先去标签，再解码实体，最后再去一次标签（处理被转义成文本的 HTML）
  let s = stripTags(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
  s = stripTags(decodeEntities(s));
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}

function field(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? clean(m[1]) : "";
}

function blocks(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => m[1]);
}

function atomLink(block) {
  const m = block.match(/<link\b[^>]*?href=["']([^"']+)["'][^>]*>/i);
  return m ? clean(m[1]) : "";
}

// 同时支持 RSS 2.0 (<item>) 和 Atom (<entry>)
function parseFeed(xml, source) {
  const isAtom = !/<item\b/i.test(xml) && /<entry\b/i.test(xml);
  const entries = isAtom ? blocks(xml, "entry") : blocks(xml, "item");
  return entries.map((b) => {
    const link = isAtom ? atomLink(b) : field(b, "link") || field(b, "guid");
    const date = field(b, isAtom ? "updated" : "pubDate") || field(b, "published") || field(b, "dc:date");
    const summary = field(b, isAtom ? "summary" : "description") || field(b, "content") || field(b, "content:encoded");
    return {
      title: field(b, "title"),
      link,
      source: source.name,
      publishedAt: date ? new Date(date).toISOString() : null,
      summary: summary.length > SUMMARY_LEN ? summary.slice(0, SUMMARY_LEN - 1) + "…" : summary,
    };
  }).filter((it) => it.title && /^https?:\/\//.test(it.link));
}

async function fetchFeed(source) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(source.url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "f1-news-aggregator/1.0", Accept: "application/rss+xml, application/atom+xml, text/xml, */*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseFeed(await res.text(), source);
    return { source: source.name, ok: true, count: items.length, items };
  } catch (err) {
    return { source: source.name, ok: false, error: err.name === "AbortError" ? "超时" : err.message, items: [] };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const feeds = JSON.parse(await readFile(FEEDS_FILE, "utf8"));
  const results = await Promise.all(feeds.map(fetchFeed));

  for (const r of results) {
    console.log(r.ok ? `✓ ${r.source}: ${r.count} 条` : `✗ ${r.source}: ${r.error}`);
  }

  const okCount = results.filter((r) => r.ok).length;
  if (okCount === 0) {
    console.error("所有源都失败了，保留已有的 data/news.json，不做覆盖。");
    process.exitCode = 1;
    return;
  }

  const cutoff = Date.now() - MAX_AGE_DAYS * 86400e3;
  const seen = new Set();
  const items = results
    .flatMap((r) => r.items)
    .filter((it) => !it.publishedAt || Date.parse(it.publishedAt) >= cutoff)
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    .filter((it) => {
      const key = it.link.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ITEMS);

  const data = {
    updatedAt: new Date().toISOString(),
    sources: results.map(({ source, ok, count, error }) => ({ name: source, ok, count: count ?? 0, error: error ?? null })),
    items,
  };

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(`已写入 ${path.relative(ROOT, OUT_FILE)}，共 ${items.length} 条。`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
