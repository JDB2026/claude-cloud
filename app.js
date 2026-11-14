(() => {
  const DATA_URL = "data/news.json";
  const els = {
    list: document.getElementById("list"),
    status: document.getElementById("status"),
    updated: document.getElementById("updated"),
    search: document.getElementById("search"),
    sources: document.getElementById("sources"),
    sourceStatus: document.getElementById("source-status"),
  };

  const state = { items: [], sources: [], source: "全部", query: "" };

  const dateFmt = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const rtf = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

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

  // 只允许 http(s) 链接，避免 javascript: 之类的注入
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
    for (const name of ["全部", ...state.sources]) {
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
      (state.source === "全部" || it.source === state.source) &&
      (!q || it.title.toLowerCase().includes(q) || (it.summary || "").toLowerCase().includes(q))
    );

    els.list.innerHTML = "";
    if (!state.items.length) {
      setStatus("暂无新闻数据。请先运行 npm run fetch 生成 data/news.json。");
      return;
    }
    if (!filtered.length) {
      setStatus("没有符合条件的新闻。");
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
      els.updated.textContent = `更新于 ${dateFmt.format(new Date(data.updatedAt))}`;
    }
    els.sourceStatus.innerHTML = "";
    for (const s of data.sources || []) {
      const span = document.createElement("span");
      span.className = s.ok ? "src-ok" : "src-bad";
      span.textContent = s.ok ? `● ${s.name} (${s.count})` : `● ${s.name} 获取失败`;
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
      setStatus(`无法加载新闻数据（${err.message}）。请确认通过 HTTP 服务访问本页面。`);
    }
  }

  els.search.addEventListener("input", (e) => {
    state.query = e.target.value;
    renderList();
  });

  load();
})();
