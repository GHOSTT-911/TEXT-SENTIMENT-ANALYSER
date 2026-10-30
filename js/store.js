/**
 * Neon Pulse — shared state: analysis history (browser-only storage) and helpers.
 */
(function (global) {
  "use strict";

  const KEY = "neon-pulse-history-v2";
  const MAX = 500;
  const listeners = [];
  let items = [];

  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (Array.isArray(raw)) items = raw;
  } catch (_) {
    items = [];
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (_) {
      /* storage blocked or full: keep in memory only */
    }
    listeners.forEach((fn) => fn(items));
  }

  const store = {
    all: () => items.slice(),
    count: () => items.length,
    add(report, source = "analyzer") {
      items.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        ts: Date.now(),
        source,
        text: report.text.trim().slice(0, 300),
        label: report.sentiment.label,
        compound: report.sentiment.compound,
        dominant: report.emotion.dominant ? report.emotion.dominant.key : null,
        emotions: report.emotion.scores,
        words: report.stats.words,
      });
      if (items.length > MAX) items.length = MAX;
      persist();
    },
    addMany(list) {
      items = list.concat(items).slice(0, MAX);
      persist();
    },
    clear() {
      items = [];
      persist();
    },
    onChange: (fn) => listeners.push(fn),
  };

  const util = {
    pct: (n, d = 0) => `${(n * 100).toFixed(d)}%`,
    cls: (label) => `is-${String(label).toLowerCase()}`,
    signed: (n, d = 2) => (n > 0 ? "+" : "") + Number(n).toFixed(d),
    debounce(fn, ms) {
      let t;
      return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
      };
    },
    download(name, content, type) {
      const blob = new Blob([content], { type });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
    },
    csvCell(v) {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // prevent spreadsheet formula injection
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    },
    /** Minimal CSV parser (handles quotes, commas and newlines inside quotes). */
    parseCSV(text) {
      const rows = [];
      let row = [], cell = "", q = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
          if (c === '"' && text[i + 1] === '"') {
            cell += '"';
            i++;
          } else if (c === '"') q = false;
          else cell += c;
        } else if (c === '"') q = true;
        else if (c === ",") {
          row.push(cell);
          cell = "";
        } else if (c === "\n" || c === "\r") {
          if (c === "\r" && text[i + 1] === "\n") i++;
          row.push(cell);
          rows.push(row);
          row = [];
          cell = "";
        } else cell += c;
      }
      if (cell || row.length) {
        row.push(cell);
        rows.push(row);
      }
      return rows.filter((r) => r.some((c) => c.trim()));
    },
    emotionMeta: (key) => global.EmotionAnalyzer.EMOTIONS.find((e) => e.key === key),
    timeAgo(ts) {
      const s = Math.round((Date.now() - ts) / 1000);
      if (s < 60) return "just now";
      if (s < 3600) return `${Math.floor(s / 60)} min ago`;
      if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
      return `${Math.floor(s / 86400)} d ago`;
    },
  };

  global.NP = { store, util };
})(window);
