/**
 * Neon Pulse — deeper insights on top of the rule engine.
 *   Insights.explain(text)  → which words pushed the score, measured by leave-one-out
 *   Insights.aspects(text)  → aspect-based sentiment ("camera: positive, battery: negative")
 *   Insights.sarcasm(text)  → heuristic sarcasm / mixed-signal check with reasons
 * Works in the browser and in Node (same pattern as the other engine files).
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./sentiment.js"), require("./language.js"));
  } else {
    root.Insights = factory(root.SentimentAnalyzer, root.LanguageDetector);
  }
})(typeof self !== "undefined" ? self : this, function (Sentiment, Lang) {
  "use strict";

  const norm = (w) => (Lang && Lang.normalize ? Lang.normalize(w) : String(w).toLowerCase());

  /* ------------------------------------------------------------------ explain */
  /**
   * Leave-one-out attribution: remove each word / emoji in turn, re-score the text,
   * and record how much the compound score moved. Captures negators ("nahi"),
   * boosters ("bahut") and contrast words ("but") as well as plain sentiment words.
   */
  function explain(text, limit = 10) {
    const src = String(text || "");
    const base = Sentiment.analyze(src).compound;
    const toks = Sentiment.tokenize(src);
    const idx = [];
    toks.forEach((t, i) => {
      if (t.type === "word" || t.type === "emoji" || t.type === "emoticon") idx.push(i);
    });
    // Keep it fast on long inputs: only test the first 400 candidate tokens.
    const candidates = idx.slice(0, 400);
    const seen = new Map();
    for (const i of candidates) {
      const without = toks.map((t, j) => (j === i ? " " : t.text)).join("");
      const delta = base - Sentiment.analyze(without).compound;
      if (Math.abs(delta) < 0.005) continue;
      const key = toks[i].text.toLowerCase();
      const prev = seen.get(key);
      if (prev) {
        prev.impact += delta;
        prev.count++;
      } else seen.set(key, { word: toks[i].text, impact: delta, count: 1 });
    }
    const list = [...seen.values()]
      .map((d) => ({ ...d, impact: Number(d.impact.toFixed(3)) }))
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, limit);
    // "Content" drivers carry sentiment themselves; the rest are structure words (but, nahi, bahut…).
    const content = list.filter((d) => /\p{Extended_Pictographic}/u.test(d.word) || Sentiment.analyze(d.word).compound !== 0);
    return { base, drivers: list, content };
  }

  /* ------------------------------------------------------------------ aspects */
  const ASPECTS = [
    { key: "camera", label: "Camera", icon: "📷", words: ["camera", "cam", "photo", "photos", "picture", "pictures", "selfie", "lens", "video", "videos"] },
    { key: "battery", label: "Battery", icon: "🔋", words: ["battery", "charge", "charging", "charger", "backup"] },
    { key: "performance", label: "Speed & performance", icon: "⚡", words: ["performance", "speed", "fast", "slow", "lag", "lags", "laggy", "hang", "hangs", "heating", "heat", "processor", "gaming"] },
    { key: "display", label: "Screen", icon: "🖥️", words: ["display", "screen", "brightness", "resolution"] },
    { key: "build", label: "Build & quality", icon: "🧱", words: ["quality", "build", "material", "design", "box", "packaging", "damaged", "durable"] },
    { key: "price", label: "Price & value", icon: "💰", words: ["price", "prices", "cost", "costly", "value", "money", "paisa", "paise", "mehenga", "sasta", "worth", "expensive", "cheap", "rate", "budget", "vasool"] },
    { key: "delivery", label: "Delivery", icon: "📦", words: ["delivery", "delivered", "shipping", "courier", "arrived", "parcel", "order", "late"] },
    { key: "service", label: "Support & service", icon: "🎧", words: ["service", "support", "customer", "care", "staff", "helpline", "refund", "replacement", "response", "manager", "waiter", "waiters"] },
    { key: "food", label: "Food & taste", icon: "🍛", words: ["food", "taste", "khana", "swad", "dish", "dishes", "meal", "biryani", "pizza", "spicy", "bland", "menu", "breakfast", "dinner", "lunch"] },
    { key: "room", label: "Room & cleanliness", icon: "🛏️", words: ["room", "rooms", "bed", "bathroom", "clean", "dirty", "hygiene", "safai", "ac"] },
    { key: "internet", label: "Wi-Fi & network", icon: "📶", words: ["wifi", "internet", "network", "signal", "connection", "5g", "4g"] },
    { key: "story", label: "Story & script", icon: "📖", words: ["story", "plot", "script", "kahani", "storyline", "ending", "climax", "screenplay", "direction", "director"] },
    { key: "acting", label: "Acting", icon: "🎭", words: ["acting", "actor", "actress", "hero", "heroine", "villain", "performance", "cast", "role"] },
    { key: "music", label: "Music & songs", icon: "🎵", words: ["music", "song", "songs", "gaana", "gaane", "gane", "bgm", "soundtrack", "album"] },
    { key: "teaching", label: "Teaching", icon: "🧑‍🏫", words: ["teacher", "teaching", "faculty", "lecture", "lectures", "professor", "sir", "maam", "class", "classes", "padhai"] },
    { key: "exam", label: "Exams & study", icon: "📝", words: ["exam", "exams", "paper", "test", "marks", "result", "syllabus"] },
    { key: "app", label: "App & UI", icon: "📱", words: ["app", "ui", "interface", "update", "bug", "bugs", "crash", "crashes", "login", "feature", "features"] },
  ];
  const ASPECT_INDEX = new Map();
  ASPECTS.forEach((a) => a.words.forEach((w) => { if (!ASPECT_INDEX.has(w)) ASPECT_INDEX.set(w, a); }));

  // Clause boundaries: sentence stops and contrast / joining words in English and Hinglish.
  const SPLITTERS = /(?<=\p{Extended_Pictographic}\uFE0F?)\s+|\s*(?:[.!?;\n]+|,|\bbut\b|\bhowever\b|\balthough\b|\bthough\b|\bwhile\b|\bwhereas\b|\blekin\b|\bmagar\b|\bpar\b|\bpr\b|\band\b|\baur\b|\bphir bhi\b)\s*/iu;

  function clauses(text) {
    return String(text || "")
      .split(SPLITTERS)
      .map((s) => (s || "").trim())
      .filter((s) => s && /[a-z]/i.test(s));
  }

  function aspects(text) {
    const parts = clauses(text);
    const found = new Map();
    let carry = null; // "camera is great and fast" → "fast" inherits the last aspect
    for (const part of parts) {
      const words = (part.toLowerCase().match(/[a-z0-9][a-z0-9'’]*/g) || []).map((w) => w.replace(/['’]/g, ""));
      const hits = new Set();
      for (const w of words) {
        const a = ASPECT_INDEX.get(w) || ASPECT_INDEX.get(norm(w));
        if (a) hits.add(a);
      }
      const r = Sentiment.analyze(part);
      const evidence = r.matches.positive.length + r.matches.negative.length;
      if (!hits.size && carry && evidence) hits.add(carry);
      if (!hits.size) continue;
      for (const a of hits) {
        const rec = found.get(a.key) || { key: a.key, label: a.label, icon: a.icon, scores: [], snippets: [] };
        if (evidence) rec.scores.push(r.compound);
        rec.snippets.push({ text: part, compound: r.compound });
        found.set(a.key, rec);
      }
      carry = hits.size === 1 ? [...hits][0] : null;
    }
    return [...found.values()]
      .map((r) => {
        const score = r.scores.length ? r.scores.reduce((s, v) => s + v, 0) / r.scores.length : 0;
        const label = score >= 0.05 ? "Positive" : score <= -0.05 ? "Negative" : "Neutral";
        return { key: r.key, label: r.label, icon: r.icon, score: Number(score.toFixed(3)), sentiment: label, mentions: r.snippets.length, snippets: r.snippets };
      })
      .sort((a, b) => b.mentions - a.mentions || Math.abs(b.score) - Math.abs(a.score));
  }

  /* ------------------------------------------------------------------ sarcasm */
  const SARC_EMOJI = /[🙄😒🙃😏🤡👏🤦]/u;
  const SARC_PHRASES = [
    [/\byeah right\b/i, "“yeah right” is usually ironic"],
    [/\boh (great|wow|nice|wonderful|perfect)\b/i, "“oh great”-style opener"],
    [/\bjust what i (needed|wanted)\b/i, "“just what I needed” is a classic sarcastic line"],
    [/\bthanks a lot\b|\bthank you so much\b.*\b(not|never|late|broke|nahi)\b/i, "Thanks paired with a complaint"],
    [/\b(wah|waah|wow) (re|kya baat|bhai|ji)\b|\bkya baat hai\b/i, "“wah / kya baat hai” often mocks in Hinglish"],
    [/\bbahut (hi )?badhiya\b.*\b(nahi|late|kharab|bekar|bekaar|hang)\b/i, "Praise next to a failure"],
    [/\bclap(s|ping)?\b|👏{2,}/iu, "Slow-clap praise"],
    [/\bsure,? (because|cause)\b|\bas if\b/i, "Dismissive “as if / sure, because”"],
    [/\bwhat a (great|wonderful|lovely|brilliant)\b/i, "“what a great …” exclamation"],
    [/\bnot\b[^.!?]{0,20}\b(at all)\b/i, "Emphatic denial"],
  ];
  // Words that describe things going wrong, even though they are not sentiment words themselves.
  const MISHAPS = new Set([
    "late", "delayed", "delay", "broke", "broken", "crash", "crashed", "crashes", "hang", "hangs", "stuck", "waited", "waiting",
    "hours", "again", "cancelled", "canceled", "lost", "missing", "dead", "died", "rain", "traffic", "queue", "refund",
    "kharab", "band", "ruk", "atak", "gayab", "ghante", "phir", "dobara", "toot", "tuta", "tooti", "jal", "leak",
  ]);

  function sarcasm(text) {
    const src = String(text || "");
    const r = Sentiment.analyze(src);
    const reasons = [];
    let score = 0;
    const pos = r.matches.positive.length;
    const neg = r.matches.negative.length;
    const words = (src.toLowerCase().match(/[a-z][a-z'’]*/g) || []).map((w) => norm(w));
    const mishaps = [...new Set(words.filter((w) => MISHAPS.has(w)))];

    if (SARC_EMOJI.test(src)) {
      score += 0.3;
      reasons.push("Eye-roll / smirk / clap emoji");
    }
    for (const [re, why] of SARC_PHRASES) {
      if (re.test(src)) {
        score += 0.28;
        reasons.push(why);
      }
    }
    if (/["“'‘](?:great|amazing|awesome|perfect|best|nice|helpful|fast|mast|badhiya|zabardast)["”'’]/i.test(src)) {
      score += 0.3;
      reasons.push("Praise word inside quote marks");
    }
    if (pos && mishaps.length && r.compound > 0) {
      score += 0.22 + Math.min(mishaps.length, 3) * 0.06;
      reasons.push(`Positive words next to things going wrong (${mishaps.slice(0, 3).join(", ")})`);
    }
    if (/(great|amazing|awesome|perfect|nice|wow|best)[^a-z]{0,3}\.{3}/i.test(src)) {
      score += 0.15;
      reasons.push("Praise trailing off with “…”");
    }
    // Emoji that disagree with the words around them.
    const emo = r.tokens.filter((t) => (t.type === "emoji" || t.type === "emoticon") && t.score);
    const wordScore = r.tokens.filter((t) => t.type === "word" && t.score).reduce((s, t) => s + t.score, 0);
    if (emo.some((t) => Math.sign(t.score) !== Math.sign(wordScore)) && Math.abs(wordScore) >= 2) {
      score += 0.25;
      reasons.push("Emoji mood contradicts the words");
    }
    score = Math.min(1, score);

    const mixed = pos > 0 && neg > 0 ? Math.min(pos, neg) / Math.max(pos, neg) : 0;
    const level = score >= 0.55 ? "Likely" : score >= 0.25 ? "Possible" : "Unlikely";
    return {
      score: Number(score.toFixed(2)),
      level,
      reasons,
      mixed: Number(mixed.toFixed(2)),
      mixedLabel: mixed >= 0.6 ? "Strongly mixed" : mixed >= 0.3 ? "Somewhat mixed" : pos + neg ? "One-sided" : "No opinion words",
    };
  }

  return { explain, aspects, sarcasm, clauses, ASPECTS };
});
