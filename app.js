(() => {
  const DATA_URL = "data/news.json";
  const ALL = "All";
  const els = {
    list: document.getElementById("list"),
    status: document.getElementById("status"),
    updated: document.getElementById("updated"),
    search: document.getElementById("search"),
    sources: document.getElementById("sources"),
    sourceStatus: document.getElementById("source-status"),
  };

  const state = { items: [], sources: [], source: ALL, query: "" };

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

  function relTime(iso) {
    const diff = (Date.parse(iso) - Date.now()) / 1000;
    const abs = Math.abs(diff);
    if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
    return rtf.format(Math.round(diff / 86400), "day");
  }

  function setStatus(msg) {
    els.status.textContent = msg;
    els.status.hidden = !msg;
  }

  // Only allow http(s) links to prevent javascript: URLs
  function safeHref(url) {
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:" ? u.href : "#";
    } catch {
      return "#";
    }
  }

  function renderSourceChips() {
    els.sources.innerHTML = "";
    for (const name of [ALL, ...state.sources]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = name;
      btn.setAttribute("aria-pressed", String(name === state.source));
      btn.addEventListener("click", () => {
        state.source = name;
        renderSourceChips();
        renderList();
      });
      els.sources.appendChild(btn);
    }
  }

  function renderList() {
    const q = state.query.trim().toLowerCase();
    const filtered = state.items.filter((it) =>
      (state.source === ALL || it.source === state.source) &&
      (!q || it.title.toLowerCase().includes(q) || (it.summary || "").toLowerCase().includes(q))
    );

    els.list.innerHTML = "";
    if (!state.items.length) {
      setStatus("No news data yet. Run “npm run fetch” to generate data/news.json.");
      return;
    }
    if (!filtered.length) {
      setStatus("No stories match your filters.");
      return;
    }
    setStatus("");

    const frag = document.createDocumentFragment();
    for (const it of filtered) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "news-card";
      a.href = safeHref(it.link);
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      const meta = document.createElement("div");
      meta.className = "news-meta";
      const src = document.createElement("span");
      src.className = "news-source";
      src.textContent = it.source;
      meta.appendChild(src);
      if (it.publishedAt) {
        const t = document.createElement("time");
        t.dateTime = it.publishedAt;
        t.textContent = `${relTime(it.publishedAt)} · ${dateFmt.format(new Date(it.publishedAt))}`;
        meta.appendChild(t);
      }

      const h = document.createElement("h2");
      h.className = "news-title";
      h.textContent = it.title;

      a.append(meta, h);
      if (it.summary) {
        const p = document.createElement("p");
        p.className = "news-summary";
        p.textContent = it.summary;
        a.appendChild(p);
      }
      li.appendChild(a);
      frag.appendChild(li);
    }
    els.list.appendChild(frag);
  }

  function renderMeta(data) {
    if (data.updatedAt) {
      els.updated.textContent = `Updated ${dateFmt.format(new Date(data.updatedAt))}`;
    }
    els.sourceStatus.innerHTML = "";
    for (const s of data.sources || []) {
      const span = document.createElement("span");
      span.className = s.ok ? "src-ok" : "src-bad";
      span.textContent = s.ok ? `● ${s.name} (${s.count})` : `● ${s.name} failed to load`;
      els.sourceStatus.appendChild(span);
    }
  }

  async function load() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.items = data.items || [];
      state.sources = [...new Set(state.items.map((i) => i.source))];
      renderMeta(data);
      renderSourceChips();
      renderList();
    } catch (err) {
      els.updated.textContent = "";
      setStatus(`Could not load news data (${err.message}). Make sure this page is served over HTTP.`);
    }
  }

  els.search.addEventListener("input", (e) => {
    state.query = e.target.value;
    renderList();
  });

  async function loadResults() {
    const section = document.getElementById("results");
    try {
      const res = await fetch("data/results.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const r = await res.json();
      if (!r.results || !r.results.length) return;

      const dateStr = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" })
        .format(new Date(`${r.date}T00:00:00Z`));
      document.getElementById("race-title").textContent = `${r.raceName} ${r.season}`;
      document.getElementById("race-meta").textContent =
        `Round ${r.round} · ${r.circuit}${r.location ? ", " + r.location : ""} · ${dateStr}`;

      const body = document.getElementById("results-body");
      body.innerHTML = "";
      const frag = document.createDocumentFragment();
      for (const row of r.results) {
        const tr = document.createElement("tr");
        const cells = [
          row.position ?? "–",
          row.driver ? `${row.driver}` : row.code,
          row.team,
          row.grid === 0 ? "Pit" : row.grid ?? "–",
          row.laps ?? "–",
          row.time ?? row.status ?? "–",
          row.points ?? "–",
        ];
        cells.forEach((value, i) => {
          const td = document.createElement("td");
          td.textContent = String(value);
          if (i === 0) td.className = "pos";
          tr.appendChild(td);
        });
        frag.appendChild(tr);
      }
      body.appendChild(frag);
      section.hidden = false;
    } catch {
      // No results file yet, or the fetch failed: keep the section hidden.
      section.hidden = true;
    }
  }

  loadResults();
  load();
})();
