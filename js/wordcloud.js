/**
 * Neon Pulse — animated word cloud (spiral placement with collision detection).
 *   WordCloud.render(container, [{word, count, tone}])   tone: "pos" | "neg" | "neu"
 */
(function (global) {
  "use strict";

  function render(container, items) {
    container.replaceChildren();
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "muted center";
      p.textContent = "Not enough meaningful words yet.";
      container.appendChild(p);
      return;
    }
    const W = container.clientWidth || 400;
    const H = container.clientHeight || 260;
    const ctx = document.createElement("canvas").getContext("2d");
    const maxC = Math.max(...items.map((i) => i.count));
    const minC = Math.min(...items.map((i) => i.count));
    const family = getComputedStyle(container).fontFamily || "sans-serif";
    const placed = [];
    const overlaps = (r) =>
      placed.some((p) => r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y);
    const base = Math.min(W, 560) / 560;

    items.forEach((it, i) => {
      const t = maxC === minC ? 0.6 : (it.count - minC) / (maxC - minC);
      let size = Math.round((14 + t * 34) * Math.max(0.6, base));
      let rect = null;
      for (let attempt = 0; attempt < 3 && !rect; attempt++) {
        ctx.font = `600 ${size}px ${family}`;
        const w = ctx.measureText(it.word).width + 8;
        const h = size * 1.05;
        for (let a = 0; a < 900; a++) {
          const ang = a * 0.35;
          const rad = 3 * Math.sqrt(a) * 2.2;
          const x = W / 2 + rad * Math.cos(ang) * 1.5 - w / 2;
          const y = H / 2 + rad * Math.sin(ang) - h / 2;
          if (x < 0 || y < 0 || x + w > W || y + h > H) continue;
          const r = { x, y, w, h };
          if (!overlaps(r)) {
            rect = r;
            break;
          }
        }
        if (!rect) size = Math.round(size * 0.75);
      }
      if (!rect) return;
      placed.push(rect);
      const span = document.createElement("span");
      span.className = `wc-word wc-${it.tone || "neu"}`;
      span.textContent = it.word;
      span.dataset.tip = `"${it.word}" × ${it.count}`;
      span.style.left = `${rect.x + 4}px`;
      span.style.top = `${rect.y}px`;
      span.style.fontSize = `${size}px`;
      span.style.transitionDelay = `${i * 45}ms`;
      span.style.animationDelay = `${(i % 7) * 0.4}s`;
      container.appendChild(span);
      requestAnimationFrame(() => requestAnimationFrame(() => span.classList.add("in")));
    });
  }

  global.WordCloud = { render };
})(window);
