/**
 * Neon Pulse — Module 03: compare two texts side by side.
 */
(function (global) {
  "use strict";

  const { util } = global.NP;
  const $ = (id) => document.getElementById(id);
  const EMO = global.EmotionAnalyzer.EMOTIONS;
  const COLOR_A = "#2f7d4f";
  const COLOR_B = "#c77d1a";

  const EXAMPLES = [
    [
      "The new update is fantastic! The app feels much faster, the design is clean and I love the dark mode.",
      "Since the new update the app is slow and keeps crashing. The redesign is confusing and I hate the new icons.",
    ],
    [
      "Our team delivered the project on time and the client was very happy with the results.",
      "The project was delivered, though a few features were delayed and the client asked for changes.",
    ],
  ];
  let exampleIdx = 0;
  let lastPair = null;

  function versusRow(container, label, a, b, fmt, i) {
    const max = Math.max(Math.abs(a), Math.abs(b), 1e-9);
    const row = document.createElement("div");
    row.className = "vs-row";
    row.style.animationDelay = `${i * 80}ms`;
    const va = document.createElement("span");
    va.className = "vs-val a" + (a > b ? " win" : "");
    va.textContent = fmt(a);
    const left = document.createElement("span");
    left.className = "vs-track left";
    const fa = document.createElement("span");
    fa.className = "vs-fill a";
    left.appendChild(fa);
    const mid = document.createElement("span");
    mid.className = "vs-label";
    mid.textContent = label;
    const right = document.createElement("span");
    right.className = "vs-track right";
    const fb = document.createElement("span");
    fb.className = "vs-fill b";
    right.appendChild(fb);
    const vb = document.createElement("span");
    vb.className = "vs-val b" + (b > a ? " win" : "");
    vb.textContent = fmt(b);
    row.append(va, left, mid, right, vb);
    container.appendChild(row);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        fa.style.width = `${(Math.abs(a) / max) * 100}%`;
        fb.style.width = `${(Math.abs(b) / max) * 100}%`;
      })
    );
  }

  function render(A, B, quiet) {
    $("cmp-results").hidden = false;
    const sa = A.sentiment, sb = B.sentiment;
    const diff = sa.compound - sb.compound;
    const banner = $("cmp-verdict");
    banner.replaceChildren();
    const h = document.createElement("h2");
    const p = document.createElement("p");
    p.className = "muted";
    if (Math.abs(diff) < 0.05) {
      h.textContent = "⚖️ Both texts carry a similar tone";
      p.textContent = `Scores differ by only ${Math.abs(diff).toFixed(2)}.`;
    } else {
      const winner = diff > 0 ? "A" : "B";
      h.innerHTML = "";
      h.append("🏆 Text ");
      const tag = document.createElement("span");
      tag.className = winner === "A" ? "tag-a" : "tag-b";
      tag.textContent = winner;
      h.append(tag, " is more positive");
      p.textContent = `by ${Math.abs(diff).toFixed(2)} points on the −1…+1 scale (${util.signed(sa.compound)} vs ${util.signed(sb.compound)}).`;
    }
    banner.append(h, p);

    for (const [key, r] of [["a", A], ["b", B]]) {
      const lab = $(`cmp-${key}-label`);
      lab.textContent = r.sentiment.label;
      lab.className = util.cls(r.sentiment.label);
      global.Charts.gauge($(`cmp-gauge-${key}`), r.sentiment.compound);
    }

    global.Charts.radar(
      $("cmp-radar"),
      EMO.map((m) => `${m.emoji} ${m.label}`),
      [
        { label: "A", values: EMO.map((m) => A.emotion.scores[m.key]), color: COLOR_A },
        { label: "B", values: EMO.map((m) => B.emotion.scores[m.key]), color: COLOR_B },
      ],
      { max: Math.max(2, ...Object.values(A.emotion.scores), ...Object.values(B.emotion.scores)) }
    );

    const vs = $("cmp-versus");
    vs.replaceChildren();
    const rowsDef = [
      ["Score", sa.compound + 1, sb.compound + 1, (v) => util.signed(v - 1)],
      ["Positive", sa.positive, sb.positive, (v) => util.pct(v)],
      ["Negative", sa.negative, sb.negative, (v) => util.pct(v)],
      ["Confidence", A.confidence, B.confidence, (v) => util.pct(v)],
      ["Emotion cues", A.emotion.total, B.emotion.total, (v) => String(v)],
      ["Words", A.stats.words, B.stats.words, (v) => String(v)],
      ["Readability", A.stats.flesch, B.stats.flesch, (v) => v.toFixed(0)],
    ];
    rowsDef.forEach((d, i) => versusRow(vs, d[0], d[1], d[2], d[3], i));
    global.FX.reveal($("cmp-results"));
    if (!quiet) $("cmp-verdict").scrollIntoView({ behavior: global.FX.reduce() ? "auto" : "smooth", block: "start" });
  }

  function run() {
    const a = $("cmp-a").value, b = $("cmp-b").value;
    if (!a.trim() || !b.trim()) return global.FX.toast("Enter both Text A and Text B", "error");
    $("cmp-run").classList.add("loading");
    setTimeout(() => {
      lastPair = [global.NLPPipeline.run(a), global.NLPPipeline.run(b)];
      render(lastPair[0], lastPair[1]);
      $("cmp-run").classList.remove("loading");
    }, global.FX.reduce() ? 0 : 400);
  }

  function init() {
    $("cmp-run").addEventListener("click", run);
    $("cmp-demo").addEventListener("click", () => {
      const [a, b] = EXAMPLES[exampleIdx++ % EXAMPLES.length];
      $("cmp-a").value = a;
      $("cmp-b").value = b;
      run();
    });
    $("cmp-swap").addEventListener("click", () => {
      const a = $("cmp-a").value;
      $("cmp-a").value = $("cmp-b").value;
      $("cmp-b").value = a;
      if (lastPair) run();
    });
  }

  global.CompareView = {
    init,
    rerender: () => {
      if (lastPair) {
        $("cmp-gauge-a")._gauge = null;
        $("cmp-gauge-b")._gauge = null;
        render(lastPair[0], lastPair[1], true);
      }
    },
  };
})(window);
