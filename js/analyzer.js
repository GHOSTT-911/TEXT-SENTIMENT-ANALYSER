/**
 * Neon Pulse — Module 01: single-text analyzer.
 */
(function (global) {
  "use strict";

  const { store, util } = global.NP;
  const $ = (id) => document.getElementById(id);
  const EMO = global.EmotionAnalyzer.EMOTIONS;

  const SAMPLES = [
    ["🇮🇳 Hinglish review", "Movie ki story ekdum bakwas thi yaar, but songs bahut mast the 🔥 Hero ki acting bhi kaafi acchi thi."],
    ["🇮🇳 Hinglish complaint", "Phone 2 din mein hang hone laga. Camera bhi accha nahi hai, bilkul paisa barbaad. Customer care ne koi help nahi ki 😡"],
    ["😍 Product review", "I absolutely love this phone! The camera is stunning, the battery lasts forever and it feels super fast. Best purchase I have made this year. Highly recommended!"],
    ["😡 Complaint", "The delivery was three days late and the box arrived damaged. Customer support was rude and completely useless. I am furious and will never order from them again."],
    ["🤔 Mixed", "The hotel room was clean and the staff were friendly. However, the food was bland, the wifi kept failing, and the prices were way too high for what you get."],
    ["📰 Neutral news", "The city council will meet on Thursday to discuss the new transport budget. The session begins at 10 am and will be streamed online."],
    ["😨 Anxious", "I am really nervous about tomorrow's exam. What if I forget everything? I studied hard, but I'm still scared and can't sleep."],
    ["🎉 Excited", "We won the hackathon!!! I can't believe it, the whole team is thrilled. Can't wait to start building the real product next month 🎉"],
  ];

  let last = null;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function showError(msg) {
    $("form-error").textContent = msg;
    $("form-error").hidden = !msg;
  }

  function updateCounts() {
    const v = $("text-input").value;
    $("char-count").textContent = v.length;
    $("word-count").textContent = (v.match(/[A-Za-z0-9']+/g) || []).length;
  }

  function renderVerdict(r) {
    $("empty-state").hidden = true;
    $("verdict-body").hidden = false;
    const s = r.sentiment;
    const lab = $("verdict-label");
    lab.textContent = s.label;
    lab.className = `verdict-label ${util.cls(s.label)}`;
    lab.classList.remove("pop");
    void lab.offsetWidth;
    lab.classList.add("pop");
    global.FX.countUp($("confidence"), r.confidence * 100, { suffix: "%" });
    global.FX.countUp($("compound"), s.compound, { decimals: 2, sign: true });
    const dom = r.emotion.dominant;
    $("dominant").textContent = dom ? `${dom.emoji} ${dom.label}` : "None detected";
    $("elapsed").textContent = `${r.elapsedMs.toFixed(1)} ms`;
    $("language").textContent = r.language.label;
    const ml = global.NP.ml;
    const op = $("ml-opinion");
    if (ml && ml.predict) {
      const p = ml.predict(r.text);
      const agree = p.label === s.label;
      op.className = `ml-opinion ${agree ? "agree" : "disagree"}`;
      $("ml-text").replaceChildren();
      const strong = document.createElement("strong");
      strong.className = util.cls(p.label);
      strong.textContent = p.label;
      $("ml-text").append("Naive Bayes says ", strong, ` (${Math.round(p.proba[p.label] * 100)}%) · ${agree ? "✓ agrees" : "≠ disagrees"}`);
    } else op.hidden = true;
    global.Charts.gauge($("gauge"), s.compound);
    global.Charts.face($("face"), s.compound);
    $("sb-pos").style.width = util.pct(s.positive, 1);
    $("sb-neu").style.width = util.pct(s.neutral, 1);
    $("sb-neg").style.width = util.pct(s.negative, 1);
    global.FX.countUp($("pos-pct"), s.positive * 100, { suffix: "%" });
    global.FX.countUp($("neu-pct"), s.neutral * 100, { suffix: "%" });
    global.FX.countUp($("neg-pct"), s.negative * 100, { suffix: "%" });
  }

  function renderKPIs(r) {
    const st = r.stats;
    global.FX.countUp($("k-words"), st.words);
    global.FX.countUp($("k-sentences"), st.sentences);
    global.FX.countUp($("k-flesch"), st.flesch);
    $("k-level").textContent = st.readability;
    global.FX.countUp($("k-time"), st.readingTimeSec);
    global.FX.countUp($("k-lex"), st.lexicalDiversity * 100);
    global.FX.countUp($("k-signals"), r.sentiment.matches.positive.length + r.sentiment.matches.negative.length);
  }

  function renderEmotions(r) {
    const e = r.emotion;
    global.Charts.radar(
      $("emotion-radar"),
      EMO.map((m) => `${m.emoji} ${m.label}`),
      [{ values: EMO.map((m) => e.scores[m.key]), color: global.Charts.cssVar("--cyan", "#00ffe0") }],
      { max: Math.max(2, ...Object.values(e.scores)) }
    );
    global.Charts.bars(
      $("emotion-bars"),
      EMO.map((m) => ({
        label: `${m.emoji} ${m.label}`,
        value: e.normalized[m.key],
        display: util.pct(e.normalized[m.key]),
        color: m.color,
        tip: e.words[m.key] ? `${m.label}: ${[...new Set(e.words[m.key])].join(", ")}` : `${m.label}: none`,
      })),
      { max: Math.max(0.01, ...Object.values(e.normalized)) }
    );
    $("emotion-note").textContent = e.total
      ? `${e.total} emotion cue${e.total === 1 ? "" : "s"} detected. Hover a bar to see the words.`
      : "No emotion words detected in this text.";
  }

  function renderTimeline(r) {
    const pts = r.sentences.map((s) => ({
      x: `S${s.index}`,
      y: s.compound,
      tip: `S${s.index} (${util.signed(s.compound)}): ${s.text.slice(0, 80)}${s.text.length > 80 ? "…" : ""}`,
    }));
    $("timeline-badge").textContent = `${pts.length} sentence${pts.length === 1 ? "" : "s"}`;
    global.Charts.line($("timeline"), pts, { min: -1, max: 1, ticks: [-1, -0.5, 0, 0.5, 1], baseline: 0, tickFormat: (v) => v });

    const list = $("sentence-list");
    list.replaceChildren();
    r.sentences.forEach((s, i) => {
      const li = el("li", `sent ${util.cls(s.label)}`);
      li.style.animationDelay = `${i * 60}ms`;
      li.append(el("span", "sent-text", s.text), el("span", "pill", util.signed(s.compound)));
      list.appendChild(li);
    });
  }

  function renderHighlight(r) {
    const box = $("highlight");
    box.replaceChildren();
    let k = 0;
    for (const tok of r.sentiment.tokens) {
      if (tok.score) {
        const m = el("mark", tok.score > 0 ? "hl-pos" : "hl-neg", tok.text);
        m.dataset.tip = `${tok.score > 0 ? "+" : ""}${tok.score}`;
        m.style.animationDelay = `${0.3 + k++ * 0.06}s`;
        box.appendChild(m);
      } else box.appendChild(document.createTextNode(tok.text));
    }
  }

  function toneOf(word) {
    const c = global.SentimentAnalyzer.analyze(word).compound;
    return c > 0 ? "pos" : c < 0 ? "neg" : "neu";
  }

  function renderWords(r) {
    const cloud = r.keywords.map((k) => ({ ...k, tone: toneOf(k.word) }));
    global.WordCloud.render($("wordcloud"), cloud);
    const top = r.keywords.slice(0, 8);
    const color = { pos: "var(--cyan)", neg: "var(--magenta)", neu: "var(--violet)" };
    global.Charts.bars(
      $("keyword-bars"),
      top.length
        ? top.map((k) => ({ label: k.word, value: k.count, color: color[toneOf(k.word)], tip: `"${k.word}" appears ${k.count}×` }))
        : [{ label: "—", value: 0, display: "no keywords" }]
    );
  }

  /* ---------- v4: explanation, aspects, sarcasm ---------- */
  let insight = null;

  function renderInsights(r) {
    const I = global.Insights;
    if (!I) return;
    const why = I.explain(r.text, 10);
    const asp = I.aspects(r.text);
    const sar = I.sarcasm(r.text);
    insight = { drivers: why.content.length ? why.content : why.drivers, allDrivers: why.drivers, aspects: asp, sarcasm: sar };

    // Why this verdict: diverging bars around zero
    const box = $("why-bars");
    box.replaceChildren();
    const max = Math.max(0.05, ...why.drivers.map((d) => Math.abs(d.impact)));
    if (!why.drivers.length) box.appendChild(el("p", "muted", "No single word moves the score. The text reads as neutral throughout."));
    why.drivers.forEach((d, i) => {
      const row = el("div", "why-row");
      row.style.animationDelay = `${i * 50}ms`;
      const word = el("span", "why-word", d.word + (d.count > 1 ? ` ×${d.count}` : ""));
      const track = el("span", "why-track");
      const fill = el("span", `why-fill ${d.impact > 0 ? "up" : "down"}`);
      track.appendChild(fill);
      const val = el("span", "why-val", util.signed(d.impact));
      row.append(word, track, val);
      row.dataset.tip = `Without “${d.word}” the score would be ${util.signed(r.sentiment.compound - d.impact)}`;
      box.appendChild(row);
      requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.width = `${(Math.abs(d.impact) / max) * 50}%`)));
    });
    const pool = why.content.length ? why.content : why.drivers;
    const up = pool.filter((d) => d.impact > 0)[0];
    const down = pool.filter((d) => d.impact < 0)[0];
    let lead = "Nothing in this text pulls strongly either way.";
    if (up && down) lead = `“${up.word}” pulls the mood up the most, while “${down.word}” drags it down.`;
    else if (up) lead = `Mostly carried by “${up.word}”. Nothing pulls it down.`;
    else if (down) lead = `Mostly dragged down by “${down.word}”. Nothing lifts it.`;
    $("why-lead").textContent = lead;
    const top = r.sentiment.label === "Positive" ? up : r.sentiment.label === "Negative" ? down : null;
    $("margin-note").textContent = top ? `mostly because of “${top.word}”` : "";

    // Aspects
    const ab = $("aspects");
    ab.replaceChildren();
    $("aspect-badge").textContent = `${asp.length} topic${asp.length === 1 ? "" : "s"} found`;
    if (!asp.length) {
      ab.appendChild(el("p", "muted", "No product or topic words found. Try a review that mentions things like camera, battery, price, delivery, acting or songs."));
    }
    asp.forEach((a, i) => {
      const row = el("div", `aspect ${util.cls(a.sentiment)}`);
      row.style.animationDelay = `${i * 60}ms`;
      const name = el("div", "aspect-name");
      name.append(el("span", "aspect-icon", a.icon), el("strong", null, a.label));
      const scale = el("div", "aspect-scale");
      const pin = el("span", "aspect-pin");
      pin.style.left = `${((a.score + 1) / 2) * 100}%`;
      scale.appendChild(pin);
      const doubt = a.sentiment === "Positive" && sar.level === "Likely";
      const verdict = el("span", "aspect-verdict", a.sentiment === "Neutral" ? "mentioned" : a.sentiment.toLowerCase() + (doubt ? "?" : ""));
      if (doubt) verdict.title = "Reads positive, but the text looks sarcastic";
      const quote = el("p", "aspect-quote", `“${a.snippets[0].text}”${a.mentions > 1 ? `  +${a.mentions - 1} more` : ""}`);
      row.append(name, verdict, scale, quote);
      row.dataset.tip = `${a.label}: average ${util.signed(a.score)} over ${a.mentions} mention${a.mentions === 1 ? "" : "s"}`;
      ab.appendChild(row);
    });

    // Sarcasm & mixed signals
    const sb = $("sarcasm");
    sb.replaceChildren();
    const meter = el("div", `sarc-meter lvl-${sar.level.toLowerCase()}`);
    const needle = el("span", "sarc-fill");
    meter.appendChild(needle);
    requestAnimationFrame(() => requestAnimationFrame(() => (needle.style.width = `${Math.max(4, sar.score * 100)}%`)));
    const head = el("p", "sarc-head");
    head.append(el("strong", `sarc-level lvl-${sar.level.toLowerCase()}`, `Sarcasm: ${sar.level.toLowerCase()}`), el("span", "muted", ` ${Math.round(sar.score * 100)}/100`));
    sb.append(head, meter);
    const ul = el("ul", "sarc-reasons");
    (sar.reasons.length ? sar.reasons : ["No sarcasm cues found: no eye-roll emoji, ironic phrases or praise next to complaints."]).forEach((t) => ul.appendChild(el("li", null, t)));
    sb.appendChild(ul);
    const mix = el("div", "mix");
    const mixBar = el("div", "mix-bar");
    const pp = el("span", "mix-pos"), nn = el("span", "mix-neg");
    const P = r.sentiment.matches.positive.length, N = r.sentiment.matches.negative.length;
    pp.style.flex = P || 0.0001;
    nn.style.flex = N || 0.0001;
    mixBar.append(pp, nn);
    mix.append(el("p", "mix-head", `${sar.mixedLabel} · ${P} positive vs ${N} negative cue${N === 1 ? "" : "s"}`), mixBar);
    if (sar.level !== "Unlikely" && r.sentiment.label === "Positive")
      mix.appendChild(el("p", "sarc-warn", "Careful: this reads positive on the surface, but the cues above suggest the writer may mean the opposite."));
    sb.appendChild(mix);
  }

  function analyze(record = true) {
    const text = $("text-input").value;
    if (!text.trim()) {
      showError("Please enter some text first.");
      $("text-input").classList.add("shake");
      setTimeout(() => $("text-input").classList.remove("shake"), 500);
      return;
    }
    showError("");
    const btn = $("analyze-btn");
    btn.classList.add("loading");
    $("text-input").parentElement.classList.add("scanning");

    const go = () => {
      const r = global.NLPPipeline.run(text);
      last = r;
      renderVerdict(r);
      $("results").hidden = false;
      renderKPIs(r);
      renderEmotions(r);
      renderTimeline(r);
      renderHighlight(r);
      renderWords(r);
      renderInsights(r);
      global.FX.reveal($("results"));
      btn.classList.remove("loading");
      $("text-input").parentElement.classList.remove("scanning");
      if (record) {
        store.add(r, "analyzer");
        if (r.sentiment.compound > 0.75) {
          const rect = $("face").getBoundingClientRect();
          global.FX.confetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      }
    };
    // Short "processing" delay so the scan animation is visible (skipped for live mode).
    if (record && !global.FX.reduce()) setTimeout(go, 450);
    else go();
  }

  function summary(r) {
    const s = r.sentiment;
    return [
      "Neon Pulse — Sentiment Report",
      `Verdict: ${s.label} (score ${util.signed(s.compound)}, confidence ${Math.round(r.confidence * 100)}%)`,
      `Split: ${util.pct(s.positive)} positive · ${util.pct(s.neutral)} neutral · ${util.pct(s.negative)} negative`,
      `Dominant emotion: ${r.emotion.dominant ? r.emotion.dominant.label : "none"}`,
      `Words: ${r.stats.words} · Sentences: ${r.stats.sentences} · Readability: ${r.stats.flesch.toFixed(0)} (${r.stats.readability})`,
      `Keywords: ${r.keywords.slice(0, 8).map((k) => k.word).join(", ") || "—"}`,
    ].join("\n");
  }

  function setupVoice() {
    const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    const btn = $("voice-btn");
    if (!SR) return;
    btn.hidden = false;
    let rec = null;
    btn.addEventListener("click", () => {
      if (rec) {
        rec.stop();
        return;
      }
      rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      const baseText = $("text-input").value ? $("text-input").value.trimEnd() + " " : "";
      rec.onresult = (e) => {
        let t = "";
        for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        $("text-input").value = baseText + t;
        updateCounts();
        if ($("live-toggle").checked) liveRun();
      };
      rec.onerror = (e) => global.FX.toast(`Voice input: ${e.error}`, "error");
      rec.onend = () => {
        btn.classList.remove("recording");
        rec = null;
      };
      rec.start();
      btn.classList.add("recording");
      global.FX.toast("Listening… click the mic again to stop", "info");
    });
  }

  const liveRun = util.debounce(() => {
    if ($("text-input").value.trim()) analyze(false);
  }, 300);

  function init() {
    const chips = $("samples");
    SAMPLES.forEach(([label, text]) => {
      const b = el("button", "chip", label);
      b.type = "button";
      b.addEventListener("click", () => load(text));
      chips.appendChild(b);
    });

    $("analyze-form").addEventListener("submit", (e) => {
      e.preventDefault();
      analyze(true);
    });
    $("text-input").addEventListener("input", () => {
      updateCounts();
      if ($("form-error").textContent) showError("");
      if ($("live-toggle").checked) liveRun();
    });
    $("text-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        $("analyze-form").requestSubmit();
      }
    });
    $("clear-btn").addEventListener("click", () => {
      $("text-input").value = "";
      updateCounts();
      showError("");
      $("results").hidden = true;
      $("verdict-body").hidden = true;
      $("empty-state").hidden = false;
      $("text-input").dispatchEvent(new Event("input"));
      $("text-input").focus();
    });

    $("file-input").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 1024 * 1024) return global.FX.toast("File is larger than 1 MB", "error");
      const reader = new FileReader();
      reader.onload = () => {
        $("text-input").value = String(reader.result).slice(0, 5000);
        updateCounts();
        global.FX.toast(`Loaded ${f.name}`, "success");
        analyze(true);
      };
      reader.readAsText(f);
      e.target.value = "";
    });

    // Drag & drop a text file onto the textarea
    const ta = $("text-input");
    ta.addEventListener("dragover", (e) => {
      e.preventDefault();
      ta.classList.add("drag");
    });
    ta.addEventListener("dragleave", () => ta.classList.remove("drag"));
    ta.addEventListener("drop", (e) => {
      ta.classList.remove("drag");
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        ta.value = String(reader.result).slice(0, 5000);
        updateCounts();
        analyze(true);
      };
      reader.readAsText(f);
    });

    $("copy-btn").addEventListener("click", async () => {
      if (!last) return;
      try {
        await navigator.clipboard.writeText(summary(last));
        global.FX.toast("Summary copied to clipboard", "success");
      } catch (_) {
        global.FX.toast("Clipboard not available here", "error");
      }
    });
    $("json-btn").addEventListener("click", () => {
      if (!last) return;
      const { tokens, ...sent } = last.sentiment;
      void tokens;
      const data = { generatedAt: new Date().toISOString(), ...last, sentiment: sent, insights: insight };
      util.download(`sentiment-report-${Date.now()}.json`, JSON.stringify(data, null, 2), "application/json");
      global.FX.toast("Report downloaded", "success");
    });
    $("print-btn").addEventListener("click", () => global.print());
    $("card-btn").addEventListener("click", async () => {
      if (!last || !global.MoodCard) return;
      const b = $("card-btn");
      b.disabled = true;
      try {
        await global.MoodCard.download(last, insight || {});
        global.FX.toast("Mood card saved as PNG", "success");
      } catch (_) {
        global.FX.toast("Could not draw the mood card in this browser", "error");
      }
      b.disabled = false;
    });
    if (global.InkMeter) global.InkMeter.attach($("text-input"), $("ink-note"));

    addEventListener(
      "resize",
      util.debounce(() => {
        if (last && !$("view-analyzer").hidden) {
          renderWords(last);
          renderTimeline(last);
        }
      }, 250)
    );

    setupVoice();
    updateCounts();
  }

  const load = (text) => {
    $("text-input").value = text;
    updateCounts();
    $("text-input").dispatchEvent(new Event("input"));
    analyze(true);
  };

  global.AnalyzerView = { init, load, SAMPLES, rerender: () => last && (renderEmotions(last), renderTimeline(last), renderWords(last)) };
})(window);
