/**
 * Neon Pulse — visual effects: boot splash, particle network, count-up numbers,
 * ripples, 3D tilt, scroll reveal, typewriter, toasts and tooltips.
 */
(function (global) {
  "use strict";

  const reduce = () => global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- boot splash ---------------- */
  function splash(done) {
    const el = document.getElementById("splash");
    if (!el) return done && done();
    const bar = el.querySelector(".splash-bar span");
    const status = el.querySelector(".splash-status");
    const steps = [
      "Reading the word lists…",
      "Teaching it Hinglish…",
      "Ready",
    ];
    if (reduce()) {
      el.remove();
      return done && done();
    }
    let i = 0;
    const tick = () => {
      status.textContent = steps[i];
      bar.style.width = `${((i + 1) / steps.length) * 100}%`;
      i++;
      if (i < steps.length) setTimeout(tick, 240);
      else
        setTimeout(() => {
          el.classList.add("out");
          setTimeout(() => el.remove(), 700);
          done && done();
        }, 350);
    };
    tick();
  }

  /* ---------------- particle network background ---------------- */
  function particles(canvas) {
    if (!canvas || reduce()) return;
    const ctx = canvas.getContext("2d");
    let W, H, pts, dpr;
    const mouse = { x: -9999, y: -9999 };
    const resize = () => {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      W = canvas.width = innerWidth * dpr;
      H = canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
      const n = Math.min(90, Math.floor((innerWidth * innerHeight) / 16000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35 * dpr, vy: (Math.random() - 0.5) * 0.35 * dpr,
        r: (Math.random() * 1.6 + 0.6) * dpr,
      }));
    };
    resize();
    addEventListener("resize", resize);
    addEventListener("pointermove", (e) => {
      mouse.x = e.clientX * dpr;
      mouse.y = e.clientY * dpr;
    });
    const link = 130;
    const frame = () => {
      if (document.hidden) return requestAnimationFrame(frame);
      ctx.clearRect(0, 0, W, H);
      const c1 = getComputedStyle(document.documentElement).getPropertyValue("--particle").trim() || "0,255,224";
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < (120 * dpr) ** 2) {
          p.x += dx * 0.012; p.y += dy * 0.012;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c1},0.7)`;
        ctx.fill();
      }
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < link * dpr) {
            ctx.strokeStyle = `rgba(${c1},${0.16 * (1 - d / (link * dpr))})`;
            ctx.lineWidth = dpr;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ---------------- count-up numbers ---------------- */
  function countUp(el, to, opts = {}) {
    if (!el) return;
    const dec = opts.decimals ?? 0;
    const prefix = opts.prefix || "";
    const suffix = opts.suffix || "";
    const sign = opts.sign && to > 0 ? "+" : "";
    const from = Number(el.dataset.value || 0);
    el.dataset.value = to;
    const fmt = (v) => prefix + (opts.sign && v > 0 ? "+" : "") + v.toFixed(dec) + suffix;
    if (reduce()) return (el.textContent = fmt(to));
    const dur = opts.duration || 1100;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 4);
      el.textContent = fmt(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(step);
    };
    void sign;
    requestAnimationFrame(step);
  }

  /* ---------------- button ripple ---------------- */
  function ripples() {
    document.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest(".btn, .chip, .nav-link");
      if (!btn || reduce()) return;
      const r = btn.getBoundingClientRect();
      const s = document.createElement("span");
      const size = Math.max(r.width, r.height) * 2;
      s.className = "ripple";
      s.style.width = s.style.height = `${size}px`;
      s.style.left = `${e.clientX - r.left - size / 2}px`;
      s.style.top = `${e.clientY - r.top - size / 2}px`;
      btn.appendChild(s);
      setTimeout(() => s.remove(), 650);
    });
  }

  /* ---------------- 3D tilt on cards ---------------- */
  function tilt() {
    if (reduce() || !global.matchMedia("(hover: hover)").matches) return;
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest(".tilt");
      document.querySelectorAll(".tilt.tilting").forEach((c) => {
        if (c !== card) {
          c.classList.remove("tilting");
          c.style.transform = "";
        }
      });
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.classList.add("tilting");
      card.style.transform = `perspective(900px) rotateX(${-y * 5}deg) rotateY(${x * 6}deg) translateY(-2px)`;
      card.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
      card.style.setProperty("--my", `${(y + 0.5) * 100}%`);
    });
  }

  /* ---------------- reveal on scroll ---------------- */
  let observer;
  function reveal(root = document) {
    const els = root.querySelectorAll(".reveal:not(.in)");
    if (!("IntersectionObserver" in global) || reduce()) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    observer =
      observer ||
      new IntersectionObserver(
        (entries) =>
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add("in");
              observer.unobserve(en.target);
            }
          }),
        { threshold: 0.08 }
      );
    els.forEach((e, i) => {
      e.style.transitionDelay = `${Math.min(i, 8) * 60}ms`;
      observer.observe(e);
    });
  }

  /* ---------------- typewriter ---------------- */
  function typewriter(el, phrases) {
    if (!el) return;
    if (reduce()) return (el.textContent = phrases[0]);
    let p = 0, i = 0, del = false;
    const tick = () => {
      const word = phrases[p];
      el.textContent = word.slice(0, i);
      if (!del && i < word.length) i++;
      else if (!del) {
        del = true;
        return setTimeout(tick, 1800);
      } else if (i > 0) i--;
      else {
        del = false;
        p = (p + 1) % phrases.length;
      }
      setTimeout(tick, del ? 28 : 55);
    };
    tick();
  }

  /* ---------------- toasts ---------------- */
  function toast(msg, type = "info") {
    let box = document.getElementById("toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      document.body.appendChild(box);
    }
    const t = document.createElement("div");
    t.className = `toast toast-${type}`;
    t.setAttribute("role", "status");
    const icon = { success: "✓", error: "!", info: "i" }[type] || "i";
    const ic = document.createElement("span");
    ic.className = "toast-icon";
    ic.textContent = icon;
    const tx = document.createElement("span");
    tx.textContent = msg;
    t.append(ic, tx);
    box.appendChild(t);
    setTimeout(() => t.classList.add("out"), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  /* ---------------- tooltips ---------------- */
  function tooltips() {
    const tip = document.createElement("div");
    tip.id = "tooltip";
    document.body.appendChild(tip);
    let current = null;
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("[data-tip]");
      if (!t) return;
      current = t;
      tip.textContent = t.dataset.tip;
      tip.classList.add("show");
    });
    document.addEventListener("pointerout", (e) => {
      if (current && !current.contains(e.relatedTarget)) {
        tip.classList.remove("show");
        current = null;
      }
    });
    document.addEventListener("pointermove", (e) => {
      if (!current) return;
      const w = tip.offsetWidth;
      const x = Math.min(innerWidth - w - 8, Math.max(8, e.clientX - w / 2));
      tip.style.transform = `translate(${x}px, ${e.clientY - tip.offsetHeight - 14}px)`;
    });
  }

  /* ---------------- confetti burst (for very positive results) ---------------- */
  function confetti(x, y) {
    if (reduce()) return;
    const colors = ["#3f9a5a", "#9fd88a", "#e0b130", "#2f6b45", "#cfeabf"];
    for (let i = 0; i < 36; i++) {
      const c = document.createElement("span");
      c.className = "confetti";
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
      c.style.background = colors[i % colors.length];
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 160;
      c.style.setProperty("--dx", `${Math.cos(a) * v}px`);
      c.style.setProperty("--dy", `${Math.sin(a) * v - 80}px`);
      c.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 1300);
    }
  }

  global.FX = { splash, particles, countUp, ripples, tilt, reveal, typewriter, toast, tooltips, confetti, reduce };
})(window);
