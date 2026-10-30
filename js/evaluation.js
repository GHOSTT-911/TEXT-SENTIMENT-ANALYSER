/**
 * Neon Pulse — Module 05: model evaluation & engine playground.
 * Trains the ML models on the bundled (or uploaded) labelled dataset and compares all engines.
 */
(function (global) {
  "use strict";

  const { util } = global.NP;
  const ML = global.ML;
  const $ = (id) => document.getElementById(id);
  const LABELS = ML.LABELS;
  const COLORS = { lex_en: "#9aa79b", lex_hi: "#3f9a5a", nb: "#4f7fa8", lr: "#c98a26", hybrid: "#a3405a" };

  let dataset = null; // { name, sample, rows: [[text, label, domain]] }
  let lastCV = null;
  let predictors = null; // engines trained on the full dataset (for playground + analyzer)

  const PLAYGROUND = [
    "Phone ka camera zabardast hai but battery bilkul bekaar",
    "movie acchi nahi thi yaar",
    "khana thik thak tha, kuch khaas nahi",
    "Kal match kitne baje hai?",
    "bhai kya mast gaana hai 🔥🔥",
    "This update is honestly terrible",
  ];

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------------------------------------------------- dataset & models */
  function setDataset(ds) {
    dataset = ds;
    const X = ds.rows.map((r) => r[0]), y = ds.rows.map((r) => r[1]);
    predictors = {};
    for (const e of ML.ENGINES) predictors[e.key] = e.train(X, y);
    global.NP.ml = { predict: predictors.nb, predictors, datasetName: ds.name, sample: ds.sample, size: X.length };
    renderDataset();
    lastCV = null;
    $("eval-results").hidden = true;
    runPlayground();
  }

  function renderDataset() {
    $("sample-banner").hidden = !dataset.sample;
    $("ds-name").textContent = dataset.name;
    global.FX.countUp($("ds-rows"), dataset.rows.length);
    const hinglish = dataset.rows.filter((r) => global.LanguageDetector.detect(r[0]).code !== "en").length;
    global.FX.countUp($("ds-hinglish"), dataset.rows.length ? (hinglish / dataset.rows.length) * 100 : 0);
    const C = global.Charts.cssVar;
    const colors = { Positive: C("--cyan"), Neutral: C("--violet"), Negative: C("--magenta") };
    global.Charts.bars(
      $("ds-bars"),
      LABELS.map((l) => ({ label: l, value: dataset.rows.filter((r) => r[1] === l).length, color: colors[l] }))
    );
  }

  function loadCSV(text, name) {
    const table = util.parseCSV(text.replace(/^﻿/, ""));
    if (table.length < 2) throw new Error("CSV is empty");
    const header = table[0].map((h) => h.trim().toLowerCase());
    const ti = header.indexOf("text"), li = header.indexOf("label"), di = header.indexOf("domain");
    if (ti < 0 || li < 0) throw new Error('CSV needs "text" and "label" columns');
    const rows = [];
    let skipped = 0;
    for (const r of table.slice(1)) {
      const t = (r[ti] || "").trim(), l = ML.normalizeLabel(r[li]);
      if (!t || !l) skipped++;
      else rows.push([t, l, di >= 0 ? r[di] || "" : ""]);
    }
    const counts = LABELS.map((l) => rows.filter((r) => r[1] === l).length);
    if (Math.min(...counts) < 3) throw new Error("Need at least 3 examples of each label");
    return { ds: { name, sample: false, rows }, skipped };
  }

  /* ------------------------------------------------------------ evaluation */
  function run() {
    if (!dataset) return;
    const btn = $("eval-run"), prog = $("eval-progress");
    const bar = prog.querySelector("span"), lab = prog.querySelector("em");
    btn.classList.add("loading");
    prog.hidden = false;
    bar.style.width = "0%";
    lab.textContent = "0%";
    const k = Number($("k-select").value);
    $("k-label").textContent = k;
    const X = dataset.rows.map((r) => r[0]), y = dataset.rows.map((r) => r[1]);
    // Run asynchronously so the progress animation can paint.
    setTimeout(() => {
      const start = performance.now();
      lastCV = ML.crossValidate(X, y, { k, seed: 7 });
      const finish = () => {
        bar.style.width = "100%";
        lab.textContent = "100%";
        btn.classList.remove("loading");
        setTimeout(() => (prog.hidden = true), 500);
        render(lastCV);
      };
      // Animate the bar for at least ~1s so the step is visible in demos.
      const minDur = global.FX.reduce() ? 0 : 1000;
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / minDur);
        bar.style.width = `${t * 100}%`;
        lab.textContent = `Fold ${Math.min(k, Math.ceil(t * k))}/${k}`;
        if (t < 1) requestAnimationFrame(tick);
        else finish();
      };
      minDur ? requestAnimationFrame(tick) : finish();
    }, 30);
  }

  function pct(v, d = 1) {
    return (v * 100).toFixed(d);
  }

  function render(cv, silent) {
    $("eval-results").hidden = false;
    const res = cv.results;
    const best = res.reduce((a, b) => (b.accuracy > a.accuracy ? b : a));
    const base = res.find((r) => r.key === "lex_en");
    $("e-best").textContent = best.short;
    global.FX.countUp($("e-best-acc"), best.accuracy * 100, { decimals: 1 });
    global.FX.countUp($("e-base"), base.accuracy * 100, { decimals: 1 });
    global.FX.countUp($("e-gain"), (best.accuracy - base.accuracy) * 100, { decimals: 1, sign: true });
    $("e-cv").textContent = `${cv.k}-fold CV · n = ${cv.n}`;

    const tb = $("e-tbody");
    tb.replaceChildren();
    res.forEach((r, i) => {
      const tr = el("tr", r === best ? "best-row" : "");
      tr.style.animationDelay = `${i * 70}ms`;
      const name = el("td");
      const dot = el("span", "eng-dot");
      dot.style.background = COLORS[r.key];
      name.append(dot, r.name);
      if (r === best) name.append(el("span", "best-tag", "← best"));
      const P = LABELS.reduce((a, l) => a + r.pooled.perClass[l].precision, 0) / 3;
      const R = LABELS.reduce((a, l) => a + r.pooled.perClass[l].recall, 0) / 3;
      tr.append(
        name,
        el("td", "num", `${pct(r.accuracy)} ± ${pct(r.accuracyStd)}`),
        el("td", "num", pct(P)),
        el("td", "num", pct(R)),
        el("td", "num", `${pct(r.macroF1)} ± ${pct(r.macroF1Std)}`),
        el("td", "num", r.msPerText.toFixed(2))
      );
      tb.appendChild(tr);
    });

    global.Charts.bars(
      $("e-acc-bars"),
      res.map((r) => ({ label: r.short, value: r.accuracy * 100, display: `${pct(r.accuracy)}%`, color: COLORS[r.key] })),
      { max: 100 }
    );
    global.Charts.bars(
      $("e-f1-bars"),
      res.map((r) => ({ label: r.short, value: r.macroF1 * 100, display: `${pct(r.macroF1)}%`, color: COLORS[r.key] })),
      { max: 100 }
    );

    renderMatrices(res);

    const sel = $("e-err-engine");
    const prev = sel.value;
    sel.replaceChildren();
    res.forEach((r) => {
      const o = el("option", null, r.short);
      o.value = r.key;
      sel.appendChild(o);
    });
    sel.value = prev && res.some((r) => r.key === prev) ? prev : best.key;
    renderErrors();
    renderFeatures();
    global.FX.reveal($("eval-results"));
    if (!silent) global.FX.toast(`Evaluation complete · best: ${best.short} (${pct(best.accuracy)}%)`, "success");
  }

  function renderMatrices(res) {
    const box = $("e-cms");
    box.replaceChildren();
    res.forEach((r, n) => {
      const card = el("div", "cm");
      card.style.animationDelay = `${n * 90}ms`;
      card.appendChild(el("p", "cm-title", r.short));
      const g = el("div", "cm-table");
      g.appendChild(el("span", "cm-corner", ""));
      LABELS.forEach((l) => g.appendChild(el("span", "cm-head", l.slice(0, 3))));
      const max = Math.max(...r.pooled.matrix.flat(), 1);
      r.pooled.matrix.forEach((row, i) => {
        g.appendChild(el("span", "cm-head side", LABELS[i].slice(0, 3)));
        row.forEach((v, j) => {
          const c = el("span", `cm-cell${i === j ? " diag" : ""}`, String(v));
          c.style.setProperty("--a", (0.08 + 0.92 * (v / max)).toFixed(2));
          c.style.setProperty("--c", i === j ? "46,139,78" : "181,56,74");
          c.style.animationDelay = `${n * 90 + (i * 3 + j) * 30}ms`;
          c.dataset.tip = `Actual ${LABELS[i]} → predicted ${LABELS[j]}: ${v}`;
          g.appendChild(c);
        });
      });
      card.appendChild(g);
      card.appendChild(el("p", "cm-acc", `${pct(r.accuracy)}% accuracy`));
      box.appendChild(card);
    });
  }

  function renderErrors() {
    if (!lastCV) return;
    const r = lastCV.results.find((x) => x.key === $("e-err-engine").value);
    const tb = $("e-errors");
    tb.replaceChildren();
    r.errors.slice(0, 40).forEach((e, i) => {
      const tr = el("tr");
      tr.style.animationDelay = `${Math.min(i, 15) * 25}ms`;
      tr.appendChild(el("td", "txt", e.text));
      for (const l of [e.actual, e.predicted]) {
        const td = el("td");
        td.appendChild(el("span", `tag ${util.cls(l)}`, l));
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    });
    $("e-err-count").textContent = `${r.errors.length} misclassified out of ${lastCV.n} (showing up to 40).`;
  }

  function renderFeatures() {
    const X = dataset.rows.map((r) => r[0]), y = dataset.rows.map((r) => r[1]);
    const top = new ML.NaiveBayes(1).fit(X, y).topFeatures(10);
    const box = $("e-features");
    box.replaceChildren();
    LABELS.forEach((l) => {
      const col = el("div", "feat-col");
      col.appendChild(el("p", `feat-title ${util.cls(l)}`, l));
      const wrap = el("div", "chip-row");
      (top[l] || []).forEach(([w, s], i) => {
        const c = el("span", `feat-chip ${util.cls(l)}`, w);
        c.dataset.tip = `log-ratio ${s.toFixed(2)}`;
        c.style.animationDelay = `${i * 40}ms`;
        wrap.appendChild(c);
      });
      col.appendChild(wrap);
      box.appendChild(col);
    });
  }

  function exportResults() {
    if (!lastCV) return;
    const head = ["engine", "accuracy_mean", "accuracy_std", "macro_f1_mean", "macro_f1_std", "precision_macro", "recall_macro", "ms_per_text"];
    const lines = [head.join(",")].concat(
      lastCV.results.map((r) => {
        const P = LABELS.reduce((a, l) => a + r.pooled.perClass[l].precision, 0) / 3;
        const R = LABELS.reduce((a, l) => a + r.pooled.perClass[l].recall, 0) / 3;
        return [r.name, r.accuracy, r.accuracyStd, r.macroF1, r.macroF1Std, P, R, r.msPerText]
          .map((v) => (typeof v === "number" ? v.toFixed(4) : util.csvCell(v)))
          .join(",");
      })
    );
    lines.push("", `dataset,${util.csvCell(dataset.name)}`, `rows,${lastCV.n}`, `folds,${lastCV.k}`);
    util.download(`evaluation-results-${Date.now()}.csv`, lines.join("\r\n"), "text/csv");
    global.FX.toast("Results exported", "success");
  }

  /* ------------------------------------------------------------ playground */
  function runPlayground() {
    const text = $("pg-input").value.trim();
    const out = $("pg-out");
    out.replaceChildren();
    if (!text || !predictors) return;
    const lang = global.LanguageDetector.detect(text);
    ML.ENGINES.forEach((e, i) => {
      const p = predictors[e.key](text);
      const card = el("div", `pg-card ${util.cls(p.label)}`);
      card.style.animationDelay = `${i * 60}ms`;
      card.style.setProperty("--eng", COLORS[e.key]);
      card.appendChild(el("span", "pg-engine", e.short));
      card.appendChild(el("strong", "pg-label", p.label));
      if (p.proba) card.appendChild(el("span", "pg-conf", `${Math.round(p.proba[p.label] * 100)}% confidence`));
      else card.appendChild(el("span", "pg-conf", "rule-based"));
      out.appendChild(card);
    });
    out.appendChild(el("p", "muted small pg-lang", `Detected language: ${lang.label}`));
  }

  function init() {
    if (global.NP_DATASET && global.NP_DATASET.rows) setDataset(global.NP_DATASET);
    $("eval-run").addEventListener("click", run);
    $("e-err-engine").addEventListener("change", renderErrors);
    $("e-export").addEventListener("click", exportResults);
    $("ds-reset").addEventListener("click", () => {
      setDataset(global.NP_DATASET);
      global.FX.toast("Using bundled dataset", "info");
    });
    $("ds-file").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const { ds, skipped } = loadCSV(String(reader.result), f.name);
          setDataset(ds);
          global.FX.toast(`Loaded ${ds.rows.length} labelled rows${skipped ? ` (${skipped} skipped)` : ""}`, "success");
          run();
        } catch (err) {
          global.FX.toast(err.message, "error");
        }
      };
      reader.readAsText(f);
      e.target.value = "";
    });
    $("pg-input").addEventListener("input", util.debounce(runPlayground, 200));
    PLAYGROUND.forEach((t) => {
      const b = el("button", "chip", t.length > 34 ? t.slice(0, 32) + "…" : t);
      b.type = "button";
      b.addEventListener("click", () => {
        $("pg-input").value = t;
        runPlayground();
      });
      $("pg-samples").appendChild(b);
    });
  }

  global.EvaluationView = { init, rerender: () => lastCV && render(lastCV, true) };
})(window);
