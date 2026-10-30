/**
 * Neon Pulse — Module 02: batch analysis of many texts (lines or CSV).
 */
(function (global) {
  "use strict";

  const { util } = global.NP;
  const $ = (id) => document.getElementById(id);
  const EMO = global.EmotionAnalyzer.EMOTIONS;
  const MAX_ROWS = 2000;

  const DEMO = [
    "Movie bahut acchi thi, must watch!",
    "Yaar delivery itni late, khana bhi thanda tha 😡",
    "Bhai camera zabardast hai but battery bekaar",
    "Kal ka match kitne baje hai?",
    "Service accha nahi tha, paisa barbaad",
    "Absolutely love this laptop, it is fast and the screen is gorgeous!",
    "Battery life is terrible, barely lasts three hours.",
    "Delivered on time. Packaging was fine.",
    "Customer service was super helpful and friendly, thank you!",
    "Worst purchase ever. It broke after two days and support ignored me.",
    "The keyboard feels nice but the trackpad is a bit slow.",
    "Decent value for the price.",
    "I am so happy with this, my whole family enjoys it 😍",
    "Not bad at all, better than I expected.",
    "The app keeps crashing, really frustrating experience.",
    "Setup took about ten minutes.",
    "Amazing sound quality, highly recommended!",
    "I was scared it would not fit, but it works perfectly.",
    "Overpriced and the build quality is cheap.",
    "Can't wait to try the new update next week!",
    "Disgusting smell from the box, I had to return it.",
    "The colour is exactly as shown in the pictures.",
    "Brilliant design, excellent performance and a reliable brand.",
    "Shipping was delayed twice and nobody informed me. Very disappointed.",
    "It's okay, nothing special.",
    "Wow, I did not expect it to be this good!",
    "The instructions were confusing and some parts were missing.",
    "Great for students, light and easy to carry.",
    "Honestly I hate the new interface, it is ugly and slow.",
  ];

  let rows = [];
  let sortKey = "index";
  let sortDir = 1;

  function parseInput(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.slice(0, MAX_ROWS);
  }

  function fromCSV(text) {
    const table = util.parseCSV(text);
    if (!table.length) return [];
    const header = table[0].map((h) => h.trim().toLowerCase());
    let col = header.findIndex((h) => ["text", "review", "comment", "message", "content", "tweet", "feedback"].includes(h));
    let body = table;
    if (col >= 0) body = table.slice(1);
    else col = 0;
    return body.map((r) => (r[col] || "").trim()).filter(Boolean).slice(0, MAX_ROWS);
  }

  function run() {
    const texts = parseInput($("batch-input").value);
    if (!texts.length) return global.FX.toast("Add at least one line of text", "error");
    const prog = $("batch-progress");
    const bar = prog.querySelector("span");
    const lab = prog.querySelector("em");
    prog.hidden = false;
    $("batch-run").classList.add("loading");
    rows = [];
    let i = 0;
    const minDur = global.FX.reduce() ? 0 : 900;
    const start = performance.now();
    const chunk = Math.max(1, Math.ceil(texts.length / 30));
    const step = () => {
      const end = Math.min(texts.length, i + chunk);
      for (; i < end; i++) {
        const r = global.NLPPipeline.run(texts[i]);
        rows.push({
          index: i + 1,
          text: texts[i],
          label: r.sentiment.label,
          compound: r.sentiment.compound,
          emotion: r.emotion.dominant ? r.emotion.dominant.key : "",
          emotions: r.emotion.scores,
          lang: r.language.code === "en" ? "English" : r.language.code === "hi-deva" ? "Devanagari" : "Hinglish",
        });
      }
      const elapsed = performance.now() - start;
      const p = Math.min(i / texts.length, minDur ? elapsed / minDur : 1);
      bar.style.width = `${p * 100}%`;
      lab.textContent = `${Math.round(p * 100)}%`;
      if (i < texts.length || elapsed < minDur) setTimeout(step, 16);
      else done();
    };
    step();
  }

  function done(silent) {
    $("batch-run").classList.remove("loading");
    setTimeout(() => ($("batch-progress").hidden = true), 400);
    $("batch-results").hidden = false;
    const n = rows.length;
    const pos = rows.filter((r) => r.label === "Positive").length;
    const neg = rows.filter((r) => r.label === "Negative").length;
    const neu = n - pos - neg;
    const avg = rows.reduce((a, r) => a + r.compound, 0) / n;
    global.FX.countUp($("b-total"), n);
    global.FX.countUp($("b-pos"), (pos / n) * 100);
    global.FX.countUp($("b-neg"), (neg / n) * 100);
    global.FX.countUp($("b-avg"), avg, { decimals: 2, sign: true });
    const C = global.Charts.cssVar;
    global.Charts.donut(
      $("b-donut"),
      [
        { label: "Positive", value: pos, color: C("--cyan") },
        { label: "Neutral", value: neu, color: C("--violet") },
        { label: "Negative", value: neg, color: C("--magenta") },
      ],
      { center: String(n), sub: "texts", format: (v, f) => `${v} (${Math.round(f * 100)}%)` }
    );
    const totals = Object.fromEntries(EMO.map((m) => [m.key, 0]));
    rows.forEach((r) => EMO.forEach((m) => (totals[m.key] += r.emotions[m.key])));
    global.Charts.bars(
      $("b-emotions"),
      EMO.map((m) => ({ label: `${m.emoji} ${m.label}`, value: totals[m.key], color: m.color }))
    );
    global.Charts.line(
      $("b-line"),
      rows.map((r) => ({ x: `#${r.index}`, y: r.compound, tip: `#${r.index} ${util.signed(r.compound)} · ${r.text.slice(0, 60)}` })),
      { min: -1, max: 1, ticks: [-1, 0, 1], baseline: 0 }
    );
    renderTable();
    global.FX.reveal($("batch-results"));
    if (!silent) global.FX.toast(`Analyzed ${n} texts`, "success");
  }

  function renderTable() {
    const q = $("b-search").value.trim().toLowerCase();
    const f = $("b-filter").value;
    const list = rows
      .filter((r) => (!f || r.label === f) && (!q || r.text.toLowerCase().includes(q)))
      .sort((a, b) => {
        const x = a[sortKey], y = b[sortKey];
        return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * sortDir;
      });
    const tb = $("b-tbody");
    tb.replaceChildren();
    list.slice(0, 500).forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.style.animationDelay = `${Math.min(i, 20) * 25}ms`;
      const td = (t, cls) => {
        const c = document.createElement("td");
        if (cls) c.className = cls;
        c.textContent = t;
        tr.appendChild(c);
        return c;
      };
      td(r.index, "num");
      td(r.text, "txt");
      const lc = td("", "");
      const tag = document.createElement("span");
      tag.className = `tag ${util.cls(r.label)}`;
      tag.textContent = r.label;
      lc.appendChild(tag);
      td(util.signed(r.compound), `num ${util.cls(r.label)}`);
      const m = r.emotion ? util.emotionMeta(r.emotion) : null;
      td(m ? `${m.emoji} ${m.label}` : "—", "");
      td(r.lang, "lang");
      tb.appendChild(tr);
    });
    $("b-count").textContent = `Showing ${Math.min(list.length, 500)} of ${list.length} matching rows (${rows.length} total).`;
    document.querySelectorAll("#view-batch th[data-sort]").forEach((th) => {
      th.classList.toggle("sorted", th.dataset.sort === sortKey);
      th.dataset.dir = sortDir > 0 ? "▲" : "▼";
    });
  }

  function exportCSV() {
    if (!rows.length) return;
    const head = ["index", "text", "label", "compound", "language", "dominant_emotion", ...EMO.map((m) => m.key)];
    const lines = [head.join(",")].concat(
      rows.map((r) => [r.index, r.text, r.label, r.compound, r.lang, r.emotion, ...EMO.map((m) => r.emotions[m.key])].map(util.csvCell).join(","))
    );
    util.download(`batch-sentiment-${Date.now()}.csv`, "﻿" + lines.join("\r\n"), "text/csv");
    global.FX.toast("CSV exported", "success");
  }

  function init() {
    $("batch-run").addEventListener("click", run);
    $("batch-demo").addEventListener("click", () => {
      $("batch-input").value = DEMO.join("\n");
      run();
    });
    $("batch-clear").addEventListener("click", () => {
      $("batch-input").value = "";
      $("batch-results").hidden = true;
      rows = [];
    });
    $("batch-file").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) return global.FX.toast("File is larger than 5 MB", "error");
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result);
        const list = /\.csv$/i.test(f.name) ? fromCSV(text) : parseInput(text);
        $("batch-input").value = list.join("\n");
        global.FX.toast(`Loaded ${list.length} rows from ${f.name}`, "success");
        run();
      };
      reader.readAsText(f);
      e.target.value = "";
    });
    $("b-search").addEventListener("input", util.debounce(renderTable, 150));
    $("b-filter").addEventListener("change", renderTable);
    $("b-export").addEventListener("click", exportCSV);
    document.querySelectorAll("#view-batch th[data-sort]").forEach((th) =>
      th.addEventListener("click", () => {
        const k = th.dataset.sort;
        sortDir = sortKey === k ? -sortDir : 1;
        sortKey = k;
        renderTable();
      })
    );
  }

  global.BatchView = { init, DEMO, rerender: () => rows.length && !$("batch-results").hidden && done(true) };
})(window);
