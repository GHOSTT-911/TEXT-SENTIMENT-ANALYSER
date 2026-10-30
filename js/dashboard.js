/**
 * Neon Pulse — Module 04: analytics dashboard built from saved history.
 */
(function (global) {
  "use strict";

  const { store, util } = global.NP;
  const $ = (id) => document.getElementById(id);
  const EMO = global.EmotionAnalyzer.EMOTIONS;
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function loadDemo() {
    const texts = global.BatchView.DEMO;
    const now = Date.now();
    const list = texts.concat(texts.slice(0, 16)).map((t, i) => {
      const r = global.NLPPipeline.run(t);
      const day = Math.floor(Math.random() * 7);
      const hour = [9, 10, 11, 13, 14, 15, 16, 18, 20, 21, 22][Math.floor(Math.random() * 11)];
      const d = new Date(now - day * 86400000);
      d.setHours(hour, Math.floor(Math.random() * 60));
      return {
        id: `demo${i}`,
        ts: Math.min(d.getTime(), now - i * 60000),
        source: "demo",
        text: t,
        label: r.sentiment.label,
        compound: r.sentiment.compound,
        dominant: r.emotion.dominant ? r.emotion.dominant.key : null,
        emotions: r.emotion.scores,
        words: r.stats.words,
      };
    });
    list.sort((a, b) => b.ts - a.ts);
    store.addMany(list);
    global.FX.toast(`Loaded ${list.length} demo analyses`, "success");
    render();
  }

  function render() {
    const items = store.all();
    const has = items.length > 0;
    $("dash-empty").hidden = has;
    $("dash-content").hidden = !has;
    if (!has) return;

    const n = items.length;
    const pos = items.filter((i) => i.label === "Positive").length;
    const neg = items.filter((i) => i.label === "Negative").length;
    const neu = n - pos - neg;
    const avg = items.reduce((a, i) => a + i.compound, 0) / n;
    const words = items.reduce((a, i) => a + (i.words || 0), 0);
    const emoTotals = Object.fromEntries(EMO.map((m) => [m.key, 0]));
    items.forEach((i) => EMO.forEach((m) => (emoTotals[m.key] += (i.emotions && i.emotions[m.key]) || 0)));
    const topKey = Object.entries(emoTotals).sort((a, b) => b[1] - a[1])[0];
    const top = topKey && topKey[1] > 0 ? util.emotionMeta(topKey[0]) : null;

    global.FX.countUp($("d-total"), n);
    global.FX.countUp($("d-avg"), avg, { decimals: 2, sign: true });
    global.FX.countUp($("d-words"), words);
    $("d-emotion").textContent = top ? top.emoji : "—";
    $("d-emotion-label").textContent = top ? top.label : "none yet";

    const C = global.Charts.cssVar;
    global.Charts.donut(
      $("d-donut"),
      [
        { label: "Positive", value: pos, color: C("--cyan") },
        { label: "Neutral", value: neu, color: C("--violet") },
        { label: "Negative", value: neg, color: C("--magenta") },
      ],
      { center: `${Math.round((pos / n) * 100)}%`, sub: "positive", format: (v, f) => `${v} (${Math.round(f * 100)}%)` }
    );
    global.Charts.radar(
      $("d-radar"),
      EMO.map((m) => `${m.emoji} ${m.label}`),
      [{ values: EMO.map((m) => emoTotals[m.key]), color: C("--violet") }]
    );

    const recent = items.slice(0, 30).reverse();
    global.Charts.line(
      $("d-trend"),
      recent.map((i, k) => ({
        x: String(k + 1),
        y: i.compound,
        tip: `${new Date(i.ts).toLocaleString()} · ${util.signed(i.compound)} · ${i.text.slice(0, 50)}`,
      })),
      { min: -1, max: 1, ticks: [-1, -0.5, 0, 0.5, 1], baseline: 0 }
    );

    renderHeatmap(items);
    renderHistory(items);
    global.FX.reveal($("dash-content"));
  }

  function renderHeatmap(items) {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    items.forEach((i) => {
      const d = new Date(i.ts);
      grid[(d.getDay() + 6) % 7][d.getHours()]++;
    });
    const max = Math.max(1, ...grid.flat());
    const box = $("d-heatmap");
    box.replaceChildren();
    grid.forEach((row, di) => {
      const lab = document.createElement("span");
      lab.className = "hm-day";
      lab.textContent = DAYS[di];
      box.appendChild(lab);
      row.forEach((v, h) => {
        const c = document.createElement("span");
        c.className = "hm-cell";
        c.style.setProperty("--a", v ? 0.18 + 0.82 * (v / max) : 0.04);
        c.style.animationDelay = `${(di * 24 + h) * 4}ms`;
        c.dataset.tip = `${DAYS[di]} ${String(h).padStart(2, "0")}:00 — ${v} analys${v === 1 ? "is" : "es"}`;
        box.appendChild(c);
      });
    });
    const foot = document.createElement("span");
    foot.className = "hm-axis";
    foot.innerHTML = "<span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>";
    box.appendChild(foot);
  }

  function renderHistory(items) {
    const ul = $("d-history");
    ul.replaceChildren();
    items.slice(0, 8).forEach((i, k) => {
      const li = document.createElement("li");
      li.style.animationDelay = `${k * 60}ms`;
      const tag = document.createElement("span");
      tag.className = `tag ${util.cls(i.label)}`;
      tag.textContent = i.label;
      const t = document.createElement("span");
      t.className = "h-text";
      t.textContent = i.text;
      const meta = document.createElement("span");
      meta.className = "h-meta";
      const em = i.dominant ? util.emotionMeta(i.dominant) : null;
      meta.textContent = `${em ? em.emoji + " " : ""}${util.signed(i.compound)} · ${util.timeAgo(i.ts)}`;
      li.append(tag, t, meta);
      li.addEventListener("click", () => {
        document.getElementById("text-input").value = i.text;
        location.hash = "#analyzer";
        setTimeout(() => document.getElementById("analyze-form").requestSubmit(), 350);
      });
      ul.appendChild(li);
    });
  }

  function init() {
    $("dash-demo").addEventListener("click", loadDemo);
    $("d-demo2").addEventListener("click", loadDemo);
    $("d-clear").addEventListener("click", () => {
      if ($("d-clear").dataset.confirm) {
        store.clear();
        delete $("d-clear").dataset.confirm;
        $("d-clear").textContent = "Clear data";
        global.FX.toast("History cleared", "success");
        render();
      } else {
        $("d-clear").dataset.confirm = "1";
        $("d-clear").textContent = "Click again to confirm";
        setTimeout(() => {
          delete $("d-clear").dataset.confirm;
          $("d-clear").textContent = "Clear data";
        }, 3000);
      }
    });
  }

  global.DashboardView = { init, render };
})(window);
