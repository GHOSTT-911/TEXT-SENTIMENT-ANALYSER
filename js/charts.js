/**
 * Neon Pulse — custom animated SVG chart engine (zero dependencies, works offline).
 *   Charts.gauge(el, value)                 semicircle gauge with spring needle (-1..1)
 *   Charts.face(el, value)                  morphing mood face (-1..1)
 *   Charts.donut(el, items, opts)           animated doughnut
 *   Charts.radar(el, labels, datasets, opts) radar / spider chart
 *   Charts.line(el, points, opts)           line + area chart with drawing animation
 *   Charts.bars(el, items, opts)            horizontal animated bars (HTML)
 * Any element with data-tip="..." gets a hover tooltip (see effects.js).
 */
(function (global) {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  let uid = 0;
  const reduceMotion = () => global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  const ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) =>
      t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  };

  /** rAF tween; returns a cancel function. */
  function tween(duration, fn, easing = ease.outCubic) {
    if (reduceMotion() || duration <= 0) {
      fn(1);
      return () => {};
    }
    let raf;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      fn(easing(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }

  function svgRoot(container, w, h, cls) {
    container.replaceChildren();
    const s = el("svg", { viewBox: `0 0 ${w} ${h}`, class: `np-chart ${cls || ""}`, role: "img" });
    container.appendChild(s);
    return s;
  }

  function polar(cx, cy, r, angleDeg) {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  function arcPath(cx, cy, r, a0, a1) {
    const [x0, y0] = polar(cx, cy, r, a0);
    const [x1, y1] = polar(cx, cy, r, a1);
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  }

  function lerpColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * t));
    const g = Math.round(((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t));
    const bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * t));
    return `rgb(${r},${g},${bl})`;
  }

  function moodColor(v) {
    const neg = cssVar("--magenta", "#ff3cac"), neu = cssVar("--violet", "#7b61ff"), pos = cssVar("--cyan", "#00ffe0");
    return v < 0 ? lerpColor(neu, neg, Math.min(1, -v)) : lerpColor(neu, pos, Math.min(1, v));
  }

  /* ------------------------------------------------------------------ gauge */
  function gauge(container, value, opts = {}) {
    let st = container._gauge;
    if (!st) {
      const W = 240, H = 150, cx = 120, cy = 128, r = 96;
      const s = svgRoot(container, W, H, "gauge");
      const id = `g${++uid}`;
      const defs = el("defs", null, s);
      const lg = el("linearGradient", { id, x1: "0", x2: "1", y1: "0", y2: "0" }, defs);
      el("stop", { offset: "0", "stop-color": cssVar("--magenta", "#ff3cac") }, lg);
      el("stop", { offset: "0.5", "stop-color": cssVar("--violet", "#7b61ff") }, lg);
      el("stop", { offset: "1", "stop-color": cssVar("--cyan", "#00ffe0") }, lg);
      const glow = `f${uid}`;
      const f = el("filter", { id: glow, x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
      el("feGaussianBlur", { stdDeviation: "4", result: "b" }, f);
      const fm = el("feMerge", null, f);
      el("feMergeNode", { in: "b" }, fm);
      el("feMergeNode", { in: "SourceGraphic" }, fm);

      el("path", { d: arcPath(cx, cy, r, -90, 90), class: "gauge-track", "stroke-width": 16, fill: "none" }, s);
      const arc = el("path", {
        d: arcPath(cx, cy, r, -90, 90), stroke: `url(#${id})`, "stroke-width": 16, fill: "none",
        "stroke-linecap": "round",
      }, s);
      const len = Math.PI * r;
      arc.style.strokeDasharray = `${len}`;
      arc.style.strokeDashoffset = `${len}`;
      for (let i = 0; i <= 10; i++) {
        const a = -90 + i * 18;
        const [x0, y0] = polar(cx, cy, r - 16, a);
        const [x1, y1] = polar(cx, cy, r - (i % 5 === 0 ? 28 : 22), a);
        el("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: "gauge-tick" }, s);
      }
      const lbl = (txt, a) => {
        const [x, y] = polar(cx, cy, r + 2, a);
        const t = el("text", { x, y: y + 14, class: "gauge-label", "text-anchor": a < 0 ? "start" : a > 0 ? "end" : "middle" }, s);
        t.textContent = txt;
      };
      lbl("-1", -90); lbl("+1", 90);
      const needle = el("g", { class: "gauge-needle" }, s);
      el("path", { d: `M ${cx - 5} ${cy} L ${cx} ${cy - r + 22} L ${cx + 5} ${cy} Z` }, needle);
      el("circle", { cx, cy, r: 9, class: "gauge-hub" }, s);
      st = container._gauge = { needle, arc, len, cx, cy, value: 0, cancel: null };
    }
    const from = st.value;
    const to = Math.max(-1, Math.min(1, value));
    if (st.cancel) st.cancel();
    st.cancel = tween(opts.duration ?? 1400, (t) => {
      const v = from + (to - from) * t;
      st.needle.setAttribute("transform", `rotate(${v * 90} ${st.cx} ${st.cy})`);
      st.arc.style.strokeDashoffset = `${st.len * (1 - (v + 1) / 2)}`;
      st.value = v;
    }, ease.outElastic);
  }

  /* ------------------------------------------------------------------- face */
  function face(container, value) {
    let st = container._face;
    if (!st) {
      const s = svgRoot(container, 100, 100, "face");
      const head = el("circle", { cx: 50, cy: 50, r: 44, class: "face-head" }, s);
      const browL = el("path", { class: "face-brow" }, s);
      const browR = el("path", { class: "face-brow" }, s);
      const eyes = el("g", { class: "face-eyes" }, s);
      el("ellipse", { cx: 35, cy: 42, rx: 5, ry: 6 }, eyes);
      el("ellipse", { cx: 65, cy: 42, rx: 5, ry: 6 }, eyes);
      const mouth = el("path", { class: "face-mouth" }, s);
      st = container._face = { head, mouth, browL, browR, value: 0, cancel: null };
    }
    const from = st.value, to = Math.max(-1, Math.min(1, value));
    if (st.cancel) st.cancel();
    const draw = (v) => {
      const curve = 66 + v * 16;
      st.mouth.setAttribute("d", `M 30 66 Q 50 ${curve} 70 66`);
      const b = Math.max(0, -v) * 6;
      st.browL.setAttribute("d", `M 27 ${30 - b * 0.3} L 42 ${30 + b}`);
      st.browR.setAttribute("d", `M 73 ${30 - b * 0.3} L 58 ${30 + b}`);
      const c = moodColor(v);
      st.head.style.stroke = c;
      st.head.style.filter = "none";
      st.mouth.style.stroke = c;
      st.value = v;
    };
    st.cancel = tween(1000, (t) => draw(from + (to - from) * t), ease.outBack);
  }

  /* ------------------------------------------------------------------ donut */
  function donut(container, items, opts = {}) {
    const S = 220, cx = 110, cy = 110, r = 80, sw = opts.thickness || 26;
    const s = svgRoot(container, S, S, "donut");
    const C = 2 * Math.PI * r;
    const total = items.reduce((a, b) => a + b.value, 0) || 1;
    el("circle", { cx, cy, r, class: "donut-track", "stroke-width": sw, fill: "none" }, s);
    const g = el("g", { transform: `rotate(-90 ${cx} ${cy})` }, s);
    let acc = 0;
    const segs = items.map((it) => {
      const frac = it.value / total;
      const c = el("circle", {
        cx, cy, r, fill: "none", stroke: it.color, "stroke-width": sw, class: "donut-seg",
        "data-tip": `${it.label}: ${opts.format ? opts.format(it.value, frac) : Math.round(frac * 100) + "%"}`,
      }, g);
      c.style.strokeDasharray = `0 ${C}`;
      c.style.strokeDashoffset = `${-acc * C}`;
      const seg = { c, frac, offset: acc };
      acc += frac;
      return seg;
    });
    const center = el("text", { x: cx, y: cy - 2, class: "donut-center", "text-anchor": "middle" }, s);
    center.textContent = opts.center || "";
    const sub = el("text", { x: cx, y: cy + 20, class: "donut-sub", "text-anchor": "middle" }, s);
    sub.textContent = opts.sub || "";
    tween(1100, (t) => {
      segs.forEach((sg) => {
        const len = Math.max(0, sg.frac * C * t - (sg.frac > 0.01 ? 2 : 0));
        sg.c.style.strokeDasharray = `${len} ${C}`;
        sg.c.style.strokeDashoffset = `${-sg.offset * C * t}`;
      });
    });
  }

  /* ------------------------------------------------------------------ radar */
  function radar(container, labels, datasets, opts = {}) {
    const S = 300, cx = 150, cy = 150, R = 105;
    const s = svgRoot(container, S, S, "radar");
    const n = labels.length;
    const max = opts.max || Math.max(1, ...datasets.flatMap((d) => d.values));
    for (let ring = 1; ring <= 4; ring++) {
      const pts = labels.map((_, i) => polar(cx, cy, (R * ring) / 4, (360 / n) * i).join(",")).join(" ");
      el("polygon", { points: pts, class: "radar-grid" }, s);
    }
    labels.forEach((lab, i) => {
      const [x, y] = polar(cx, cy, R, (360 / n) * i);
      el("line", { x1: cx, y1: cy, x2: x, y2: y, class: "radar-axis" }, s);
      const [lx, ly] = polar(cx, cy, R + 24, (360 / n) * i);
      const t = el("text", { x: lx, y: ly + 4, class: "radar-label", "text-anchor": "middle" }, s);
      t.textContent = lab;
    });
    datasets.forEach((ds, di) => {
      const target = ds.values.map((v, i) => polar(cx, cy, (R * Math.min(v, max)) / max, (360 / n) * i));
      const poly = el("polygon", { class: "radar-area", fill: ds.color, stroke: ds.color, "fill-opacity": 0.22 }, s);
      const dots = target.map((_, i) =>
        el("circle", {
          r: 4, fill: ds.color, class: "radar-dot",
          "data-tip": `${ds.label ? ds.label + " · " : ""}${labels[i]}: ${ds.display ? ds.display[i] : ds.values[i]}`,
        }, s)
      );
      setTimeout(() => {
        tween(1100, (t) => {
          const pts = target.map(([x, y]) => [cx + (x - cx) * t, cy + (y - cy) * t]);
          poly.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
          dots.forEach((d, i) => {
            d.setAttribute("cx", pts[i][0]);
            d.setAttribute("cy", pts[i][1]);
          });
        }, ease.outBack);
      }, di * 180);
    });
  }

  /* ------------------------------------------------------------------- line */
  function line(container, points, opts = {}) {
    // Use the real container width so text stays crisp and the chart never gets too tall.
    const W = Math.max(280, Math.round(container.clientWidth || 560)), H = opts.height || 230, pl = 36, pr = 14, pt = 14, pb = 28;
    const s = svgRoot(container, W, H, "line");
    const min = opts.min ?? Math.min(0, ...points.map((p) => p.y));
    const max = opts.max ?? Math.max(1, ...points.map((p) => p.y));
    const X = (i) => pl + (points.length <= 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (points.length - 1));
    const Y = (v) => pt + ((max - v) * (H - pt - pb)) / (max - min || 1);
    const id = `l${++uid}`;
    const defs = el("defs", null, s);
    const sg = el("linearGradient", { id: id + "s", x1: 0, x2: 0, y1: pt, y2: H - pb, gradientUnits: "userSpaceOnUse" }, defs);
    el("stop", { offset: "0", "stop-color": cssVar("--cyan", "#00ffe0") }, sg);
    el("stop", { offset: "0.5", "stop-color": cssVar("--violet", "#7b61ff") }, sg);
    el("stop", { offset: "1", "stop-color": cssVar("--magenta", "#ff3cac") }, sg);
    const ag = el("linearGradient", { id: id + "a", x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
    el("stop", { offset: "0", "stop-color": cssVar("--cyan", "#00ffe0"), "stop-opacity": 0.35 }, ag);
    el("stop", { offset: "1", "stop-color": cssVar("--violet", "#7b61ff"), "stop-opacity": 0 }, ag);

    const ticks = opts.ticks || [min, (min + max) / 2, max];
    ticks.forEach((v) => {
      el("line", { x1: pl, x2: W - pr, y1: Y(v), y2: Y(v), class: v === 0 ? "line-zero" : "line-grid" }, s);
      const t = el("text", { x: pl - 6, y: Y(v) + 4, class: "axis-label", "text-anchor": "end" }, s);
      t.textContent = opts.tickFormat ? opts.tickFormat(v) : v;
    });
    const step = Math.ceil(points.length / 10);
    points.forEach((p, i) => {
      if (i % step && i !== points.length - 1) return;
      const t = el("text", { x: X(i), y: H - 8, class: "axis-label", "text-anchor": "middle" }, s);
      t.textContent = p.x;
    });
    if (!points.length) return;

    // Smooth path (Catmull-Rom → Bézier)
    const P = points.map((p, i) => [X(i), Y(p.y)]);
    let d = `M ${P[0][0]} ${P[0][1]}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
    }
    const base = Y(Math.max(min, Math.min(max, opts.baseline ?? min)));
    const area = el("path", { d: `${d} L ${P[P.length - 1][0]} ${base} L ${P[0][0]} ${base} Z`, fill: `url(#${id}a)`, class: "line-area" }, s);
    const path = el("path", { d, stroke: `url(#${id}s)`, class: "line-path", fill: "none" }, s);
    const len = path.getTotalLength ? path.getTotalLength() : 1000;
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    area.style.opacity = 0;
    const dots = P.map((p, i) =>
      el("circle", {
        cx: p[0], cy: p[1], r: 0, class: "line-dot",
        fill: moodColor(points[i].y / Math.max(Math.abs(min), Math.abs(max), 1)),
        "data-tip": points[i].tip || `${points[i].x}: ${points[i].y}`,
      }, s)
    );
    tween(1300, (t) => {
      path.style.strokeDashoffset = `${len * (1 - t)}`;
      area.style.opacity = t;
      dots.forEach((dot, i) => {
        const appear = Math.max(0, Math.min(1, t * P.length - i));
        dot.setAttribute("r", (P.length > 40 ? 2.5 : 5) * appear);
      });
    });
  }

  /* ------------------------------------------------------------------- bars */
  function bars(container, items, opts = {}) {
    container.replaceChildren();
    container.classList.add("np-bars");
    const max = opts.max || Math.max(1e-9, ...items.map((i) => i.value));
    items.forEach((it, i) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.dataset.tip = it.tip || `${it.label}: ${it.display ?? it.value}`;
      const lab = document.createElement("span");
      lab.className = "bar-label";
      lab.textContent = it.label;
      const track = document.createElement("span");
      track.className = "bar-track";
      const fill = document.createElement("span");
      fill.className = "bar-fill";
      fill.style.background = it.color || "var(--cyan)";
      fill.style.boxShadow = `0 0 12px ${it.color || "var(--cyan)"}`;
      fill.style.transitionDelay = `${i * 70}ms`;
      track.appendChild(fill);
      const val = document.createElement("span");
      val.className = "bar-value";
      val.textContent = it.display ?? it.value;
      row.append(lab, track, val);
      container.appendChild(row);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => (fill.style.width = `${(it.value / max) * 100}%`))
      );
    });
  }

  global.Charts = { gauge, face, donut, radar, line, bars, tween, ease, moodColor, cssVar };
})(window);
