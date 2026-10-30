/**
 * Neon Pulse — browser extras:
 *   MoodCard.download(report, extra)  draws a shareable PNG "mood card" on a canvas
 *   Palette.init(commands)            Ctrl+K command palette for jumping around the app
 *   InkMeter.attach(textarea, out)    live mood ink while typing (no button press needed)
 */
(function (global) {
  "use strict";

  const css = (name, fb) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;

  /* ------------------------------------------------------------------ mood card */
  function wrap(ctx, text, maxW, maxLines) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) {
        lines.push(line);
        line = w;
        if (lines.length === maxLines) break;
      } else line = t;
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
      let last = lines[maxLines - 1];
      while (ctx.measureText(last + "…").width > maxW && last.length) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Slightly wobbly hand-drawn line, so the card feels marked up by a person. */
  function scribble(ctx, x0, y, x1, color, width) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y);
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      ctx.lineTo(x, y + Math.sin(i * 1.7) * 3 + (i % 3) - 1);
    }
    ctx.stroke();
    ctx.restore();
  }

  async function drawCard(r, extra) {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (_) {}
    }
    const W = 1080, H = 1350;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    const P = { paper: "#eef5e6", panel: "#fbfdf7", ink: "#1e2b22", muted: "#5d6e60", line: "#c9dabd", mint: "#cfeabf", pos: "#2e8b4e", neu: "#b7892b", neg: "#b5384a" };
    const tone = { Positive: P.pos, Neutral: P.neu, Negative: P.neg }[r.sentiment.label];
    const display = '"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif';
    const hand = '"Caveat", "Segoe Print", "Comic Sans MS", cursive';

    // paper + faint ruled lines
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(46,139,78,0.08)";
    ctx.lineWidth = 2;
    for (let y = 120; y < H; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // card body with offset "cut paper" shadow
    ctx.fillStyle = P.mint;
    roundRect(ctx, 78, 92, W - 140, H - 170, 26);
    ctx.fill();
    ctx.fillStyle = P.panel;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 3;
    roundRect(ctx, 64, 78, W - 140, H - 170, 26);
    ctx.fill();
    ctx.stroke();

    const L = 120, R = W - 136;
    ctx.fillStyle = P.muted;
    ctx.font = `500 30px ${display}`;
    ctx.fillText("Neon Pulse mood card", L, 160);
    ctx.textAlign = "right";
    ctx.fillText(new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }), R, 160);
    ctx.textAlign = "left";

    // verdict
    ctx.fillStyle = tone;
    ctx.font = `800 150px ${display}`;
    ctx.fillText(r.sentiment.label, L - 6, 320);
    scribble(ctx, L, 350, L + Math.min(ctx.measureText(r.sentiment.label).width, R - L), tone, 10);

    ctx.fillStyle = P.ink;
    ctx.font = `600 40px ${display}`;
    const sign = r.sentiment.compound > 0 ? "+" : "";
    ctx.fillText(`Score ${sign}${r.sentiment.compound.toFixed(2)}   ·   ${Math.round(r.confidence * 100)}% sure`, L, 430);

    // score scale
    const sx = L, sw = R - L, sy = 480;
    const g = ctx.createLinearGradient(sx, 0, sx + sw, 0);
    g.addColorStop(0, P.neg);
    g.addColorStop(0.5, P.neu);
    g.addColorStop(1, P.pos);
    ctx.fillStyle = g;
    roundRect(ctx, sx, sy, sw, 22, 11);
    ctx.fill();
    const mx = sx + ((r.sentiment.compound + 1) / 2) * sw;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.moveTo(mx, sy - 6);
    ctx.lineTo(mx - 16, sy - 30);
    ctx.lineTo(mx + 16, sy - 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.muted;
    ctx.font = `500 26px ${display}`;
    ctx.fillText("negative", sx, sy + 58);
    ctx.textAlign = "right";
    ctx.fillText("positive", sx + sw, sy + 58);
    ctx.textAlign = "left";

    // quote
    ctx.fillStyle = P.ink;
    ctx.font = `italic 400 38px ${display}`;
    const q = wrap(ctx, `“${r.text.trim()}”`, R - L, 4);
    q.forEach((l, i) => ctx.fillText(l, L, 640 + i * 52));

    let y = 640 + q.length * 52 + 50;
    // facts row
    const dom = r.emotion.dominant;
    const facts = [
      ["Emotion", dom ? `${dom.emoji} ${dom.label}` : "—"],
      ["Language", r.language.label.replace(" (code-mixed)", "")],
      ["Words", String(r.stats.words)],
    ];
    const colW = (R - L) / 3;
    facts.forEach(([k, v], i) => {
      ctx.fillStyle = P.muted;
      ctx.font = `500 26px ${display}`;
      ctx.fillText(k, L + i * colW, y);
      ctx.fillStyle = P.ink;
      ctx.font = `700 36px ${display}`;
      ctx.fillText(v, L + i * colW, y + 46);
    });
    y += 110;

    // aspects
    const asp = (extra && extra.aspects) || [];
    if (asp.length) {
      ctx.fillStyle = P.muted;
      ctx.font = `500 26px ${display}`;
      ctx.fillText("What it says about…", L, y);
      y += 24;
      let x = L;
      ctx.font = `600 28px ${display}`;
      for (const a of asp.slice(0, 6)) {
        const t = `${a.label} ${a.sentiment === "Positive" ? "👍" : a.sentiment === "Negative" ? "👎" : "•"}`;
        const w = ctx.measureText(t).width + 36;
        if (x + w > R) {
          x = L;
          y += 62;
        }
        const col = { Positive: P.pos, Neutral: P.neu, Negative: P.neg }[a.sentiment];
        ctx.fillStyle = col + "22";
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        roundRect(ctx, x, y, w, 48, 24);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = P.ink;
        ctx.fillText(t, x + 18, y + 34);
        x += w + 12;
      }
      y += 90;
    }

    // handwritten margin note: the strongest driver word
    const top = extra && extra.drivers && extra.drivers[0];
    if (top && y < H - 170) {
      ctx.save();
      ctx.translate(L, Math.min(y + 30, H - 170));
      ctx.rotate(-0.025);
      ctx.fillStyle = P.pos;
      ctx.font = `600 50px ${hand}`;
      ctx.fillText(`biggest swing: “${top.word}” (${top.impact > 0 ? "+" : ""}${top.impact.toFixed(2)})`, 0, 0);
      ctx.restore();
    }

    ctx.fillStyle = P.muted;
    ctx.font = `500 24px ${display}`;
    ctx.fillText("Analysed offline · Hinglish-aware sentiment engine", L, H - 120);
    return c;
  }

  async function download(r, extra) {
    const c = await drawCard(r, extra);
    return new Promise((resolve) => {
      c.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `mood-card-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 500);
        resolve();
      }, "image/png");
    });
  }

  /* ------------------------------------------------------------------ command palette */
  function initPalette(commands) {
    const wrapEl = document.createElement("div");
    wrapEl.id = "palette";
    wrapEl.hidden = true;
    wrapEl.innerHTML =
      '<div class="pal-box" role="dialog" aria-modal="true" aria-label="Command palette">' +
      '<input type="text" class="pal-input" placeholder="Type a command or a page name…" aria-label="Search commands" />' +
      '<ul class="pal-list" role="listbox"></ul>' +
      '<p class="pal-foot"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>Enter</kbd> run <kbd>Esc</kbd> close</p></div>';
    document.body.appendChild(wrapEl);
    const input = wrapEl.querySelector(".pal-input");
    const list = wrapEl.querySelector(".pal-list");
    let shown = [];
    let sel = 0;
    let lastFocus = null;

    const score = (cmd, q) => {
      if (!q) return 1;
      const hay = (cmd.label + " " + (cmd.keywords || "")).toLowerCase();
      if (hay.includes(q)) return 2 + (hay.startsWith(q) ? 1 : 0);
      let i = 0;
      for (const ch of hay) if (ch === q[i]) i++;
      return i === q.length ? 1 : 0;
    };
    const render = () => {
      const q = input.value.trim().toLowerCase();
      shown = commands
        .map((c) => ({ c, s: score(c, q) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.c);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.replaceChildren();
      if (!shown.length) {
        const li = document.createElement("li");
        li.className = "pal-empty";
        li.textContent = "No command matches. Try “dark”, “batch” or “sample”.";
        list.appendChild(li);
        return;
      }
      shown.forEach((c, i) => {
        const li = document.createElement("li");
        li.className = "pal-item" + (i === sel ? " sel" : "");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", i === sel);
        const g = document.createElement("span");
        g.className = "pal-group";
        g.textContent = c.group;
        const t = document.createElement("span");
        t.textContent = c.label;
        li.append(t, g);
        li.addEventListener("pointerenter", () => {
          sel = i;
          [...list.children].forEach((n, j) => n.classList.toggle("sel", j === sel));
        });
        li.addEventListener("click", () => run(c));
        list.appendChild(li);
      });
      const cur = list.children[sel];
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
    };
    const open = () => {
      lastFocus = document.activeElement;
      wrapEl.hidden = false;
      input.value = "";
      sel = 0;
      render();
      input.focus();
    };
    const close = () => {
      wrapEl.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };
    const run = (c) => {
      close();
      setTimeout(() => c.run(), 30);
    };
    input.addEventListener("input", () => {
      sel = 0;
      render();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        sel = (sel + 1) % Math.max(1, shown.length);
        render();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        sel = (sel - 1 + shown.length) % Math.max(1, shown.length);
        render();
      } else if (e.key === "Enter" && shown[sel]) {
        e.preventDefault();
        run(shown[sel]);
      } else if (e.key === "Escape") close();
    });
    wrapEl.addEventListener("pointerdown", (e) => {
      if (e.target === wrapEl) close();
    });
    addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        wrapEl.hidden ? open() : close();
      }
    });
    return { open, close };
  }

  /* ------------------------------------------------------------------ live mood ink */
  function attachInk(textarea, note) {
    const wrapEl = textarea.parentElement;
    let t;
    const phrases = {
      empty: "",
      Positive: ["sounds happy so far", "reads positive", "nice tone so far"],
      Negative: ["sounds upset so far", "reads negative", "tone is turning sour"],
      Neutral: ["pretty neutral so far", "no strong mood yet", "flat, factual tone"],
    };
    const update = () => {
      const v = textarea.value;
      if (!v.trim()) {
        wrapEl.style.removeProperty("--ink");
        wrapEl.classList.remove("inked");
        note.textContent = "";
        return;
      }
      const r = global.SentimentAnalyzer.analyze(v);
      const col = global.Charts.moodColor ? global.Charts.moodColor(r.compound) : null;
      if (col) wrapEl.style.setProperty("--ink", col);
      wrapEl.classList.add("inked");
      const opts = phrases[r.label];
      note.textContent = `${opts[Math.abs(Math.round(r.compound * 10)) % opts.length]} (${r.compound > 0 ? "+" : ""}${r.compound.toFixed(2)})`;
    };
    textarea.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(update, 120);
    });
    return { update };
  }

  global.MoodCard = { download, draw: drawCard };
  global.Palette = { init: initPalette };
  global.InkMeter = { attach: attachInk };
})(window);
