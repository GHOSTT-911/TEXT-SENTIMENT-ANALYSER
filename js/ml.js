/**
 * Neon Pulse — machine-learning module (pure JavaScript, no libraries).
 *
 *   Feature extraction : normalised unigrams + bigrams (Hinglish spelling normalisation)
 *   Models             : Multinomial Naive Bayes, Multinomial Logistic Regression (TF-IDF, SGD, L2)
 *   Evaluation         : stratified k-fold cross-validation, accuracy, precision, recall, F1, confusion matrix
 *   Engines compared   : English lexicon · Hinglish-aware lexicon (ours) · NB · LR · Hybrid (rules + NB)
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./language.js"), require("./sentiment.js"));
  } else {
    root.ML = factory(root.LanguageDetector, root.SentimentAnalyzer);
  }
})(typeof self !== "undefined" ? self : this, function (Lang, Sentiment) {
  "use strict";

  const LABELS = ["Positive", "Neutral", "Negative"];

  /* ---------------------------------------------------------- utilities */
  function rng(seed) {
    // mulberry32 — small deterministic PRNG so results are reproducible
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function normalizeLabel(v) {
    const s = String(v || "").trim().toLowerCase();
    if (["positive", "pos", "p", "1", "+1", "+"].includes(s)) return "Positive";
    if (["negative", "neg", "n", "-1", "-"].includes(s)) return "Negative";
    if (["neutral", "neu", "0", "o"].includes(s)) return "Neutral";
    return null;
  }

  /* ------------------------------------------------- feature extraction */
  function tokens(text) {
    const raw = String(text || "").toLowerCase().match(/[\p{Extended_Pictographic}]|[a-z][a-z'’]*|[!?]/gu) || [];
    return raw.map((t) => (/^[a-z]/.test(t) ? Lang.normalize(t) : t));
  }

  function features(text) {
    const t = tokens(text);
    const f = t.slice();
    for (let i = 0; i < t.length - 1; i++) f.push(t[i] + "_" + t[i + 1]);
    return f;
  }

  /* ------------------------------------------------ Multinomial Naive Bayes */
  class NaiveBayes {
    constructor(alpha = 1) {
      this.alpha = alpha;
    }
    fit(texts, labels) {
      this.vocab = new Map();
      this.counts = Object.fromEntries(LABELS.map((l) => [l, new Map()]));
      this.totals = Object.fromEntries(LABELS.map((l) => [l, 0]));
      this.docs = Object.fromEntries(LABELS.map((l) => [l, 0]));
      texts.forEach((txt, i) => {
        const y = labels[i];
        this.docs[y]++;
        for (const f of features(txt)) {
          if (!this.vocab.has(f)) this.vocab.set(f, this.vocab.size);
          const c = this.counts[y];
          c.set(f, (c.get(f) || 0) + 1);
          this.totals[y]++;
        }
      });
      this.n = texts.length;
      return this;
    }
    predictProba(text) {
      const V = this.vocab.size;
      const logp = {};
      for (const y of LABELS) {
        let lp = Math.log((this.docs[y] + 1) / (this.n + LABELS.length));
        const c = this.counts[y];
        const denom = this.totals[y] + this.alpha * V;
        for (const f of features(text)) {
          if (!this.vocab.has(f)) continue;
          lp += Math.log(((c.get(f) || 0) + this.alpha) / denom);
        }
        logp[y] = lp;
      }
      const m = Math.max(...Object.values(logp));
      const ex = Object.fromEntries(LABELS.map((y) => [y, Math.exp(logp[y] - m)]));
      const z = LABELS.reduce((a, y) => a + ex[y], 0);
      return Object.fromEntries(LABELS.map((y) => [y, ex[y] / z]));
    }
    /** Most indicative features per class (log-probability ratio vs other classes). */
    topFeatures(k = 10) {
      const V = this.vocab.size;
      const out = {};
      for (const y of LABELS) {
        const scores = [];
        for (const f of this.vocab.keys()) {
          if (f.includes("_")) continue;
          const p = ((this.counts[y].get(f) || 0) + this.alpha) / (this.totals[y] + this.alpha * V);
          let other = 0;
          for (const o of LABELS) if (o !== y) other += ((this.counts[o].get(f) || 0) + this.alpha) / (this.totals[o] + this.alpha * V);
          other /= LABELS.length - 1;
          if ((this.counts[y].get(f) || 0) >= 2) scores.push([f, Math.log(p / other)]);
        }
        out[y] = scores.sort((a, b) => b[1] - a[1]).slice(0, k);
      }
      return out;
    }
  }

  /* ------------------------------------- Multinomial Logistic Regression */
  class LogisticRegression {
    constructor(opts = {}) {
      this.epochs = opts.epochs || 40;
      this.lr = opts.lr || 0.4;
      this.l2 = opts.l2 ?? 1e-4;
      this.seed = opts.seed || 42;
    }
    vectorize(text) {
      const tf = new Map();
      for (const f of features(text)) {
        const j = this.vocab.get(f);
        if (j !== undefined) tf.set(j, (tf.get(j) || 0) + 1);
      }
      let norm = 0;
      for (const [j, v] of tf) {
        const w = (1 + Math.log(v)) * this.idf[j];
        tf.set(j, w);
        norm += w * w;
      }
      norm = Math.sqrt(norm) || 1;
      for (const [j, v] of tf) tf.set(j, v / norm);
      return tf;
    }
    fit(texts, labels) {
      this.vocab = new Map();
      const df = [];
      texts.forEach((t) => {
        for (const f of new Set(features(t))) {
          if (!this.vocab.has(f)) {
            this.vocab.set(f, this.vocab.size);
            df.push(0);
          }
          df[this.vocab.get(f)]++;
        }
      });
      const N = texts.length;
      this.idf = df.map((d) => Math.log((1 + N) / (1 + d)) + 1);
      const V = this.vocab.size, K = LABELS.length;
      this.W = Array.from({ length: K }, () => new Float64Array(V));
      this.b = new Float64Array(K);
      const X = texts.map((t) => this.vectorize(t));
      const Y = labels.map((l) => LABELS.indexOf(l));
      const rand = rng(this.seed);
      let idx = X.map((_, i) => i);
      for (let ep = 0; ep < this.epochs; ep++) {
        idx = shuffle(idx, rand);
        const lr = this.lr / (1 + ep * 0.05);
        for (const i of idx) {
          const p = this.softmax(X[i]);
          for (let k = 0; k < K; k++) {
            const g = p[k] - (Y[i] === k ? 1 : 0);
            const Wk = this.W[k];
            for (const [j, v] of X[i]) Wk[j] -= lr * (g * v + this.l2 * Wk[j]);
            this.b[k] -= lr * g;
          }
        }
      }
      return this;
    }
    softmax(x) {
      const z = this.b.map((bk, k) => {
        let s = bk;
        for (const [j, v] of x) s += this.W[k][j] * v;
        return s;
      });
      const m = Math.max(...z);
      const e = z.map((v) => Math.exp(v - m));
      const sum = e.reduce((a, b) => a + b, 0);
      return e.map((v) => v / sum);
    }
    predictProba(text) {
      const p = this.softmax(this.vectorize(text));
      return Object.fromEntries(LABELS.map((y, k) => [y, p[k]]));
    }
  }

  const argmax = (proba) => LABELS.reduce((best, y) => (proba[y] > proba[best] ? y : best), LABELS[0]);

  /* ------------------------------------------------------------ engines */
  function ruleProba(text, hinglish) {
    const c = Sentiment.analyze(text, { hinglish }).compound;
    const p = Math.max(c, 0), n = Math.max(-c, 0);
    return { Positive: p, Negative: n, Neutral: Math.max(0, 1 - p - n) * 0.9 + 0.05 };
  }

  /** Each engine: train(texts, labels) → predict(text) → { label, proba? } */
  const ENGINES = [
    {
      key: "lex_en",
      name: "English lexicon (baseline)",
      short: "EN lexicon",
      train: () => (t) => ({ label: Sentiment.analyze(t, { hinglish: false }).label }),
    },
    {
      key: "lex_hi",
      name: "Hinglish-aware lexicon (ours)",
      short: "Hinglish rules",
      train: () => (t) => ({ label: Sentiment.analyze(t, { hinglish: true }).label }),
    },
    {
      key: "nb",
      name: "Naive Bayes (ML)",
      short: "Naive Bayes",
      train: (X, y) => {
        const m = new NaiveBayes(1).fit(X, y);
        return (t) => {
          const proba = m.predictProba(t);
          return { label: argmax(proba), proba };
        };
      },
    },
    {
      key: "lr",
      name: "Logistic Regression (ML)",
      short: "Log. Regression",
      train: (X, y) => {
        const m = new LogisticRegression().fit(X, y);
        return (t) => {
          const proba = m.predictProba(t);
          return { label: argmax(proba), proba };
        };
      },
    },
    {
      key: "hybrid",
      name: "Hybrid: rules + Naive Bayes (ours)",
      short: "Hybrid",
      train: (X, y) => {
        const m = new NaiveBayes(1).fit(X, y);
        return (t) => {
          const a = ruleProba(t, true), b = m.predictProba(t);
          const proba = Object.fromEntries(LABELS.map((l) => [l, 0.4 * a[l] + 0.6 * b[l]]));
          return { label: argmax(proba), proba };
        };
      },
    },
  ];

  /* --------------------------------------------------------- evaluation */
  function metrics(yTrue, yPred) {
    const idx = Object.fromEntries(LABELS.map((l, i) => [l, i]));
    const matrix = LABELS.map(() => LABELS.map(() => 0));
    yTrue.forEach((t, i) => matrix[idx[t]][idx[yPred[i]]]++);
    const perClass = {};
    let f1Sum = 0, correct = 0;
    LABELS.forEach((l, i) => {
      const tp = matrix[i][i];
      correct += tp;
      const predicted = LABELS.reduce((a, _, r) => a + matrix[r][i], 0);
      const actual = matrix[i].reduce((a, b) => a + b, 0);
      const precision = predicted ? tp / predicted : 0;
      const recall = actual ? tp / actual : 0;
      const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
      perClass[l] = { precision, recall, f1, support: actual };
      f1Sum += f1;
    });
    return { accuracy: yTrue.length ? correct / yTrue.length : 0, macroF1: f1Sum / LABELS.length, perClass, matrix };
  }

  function stratifiedFolds(labels, k, seed) {
    const rand = rng(seed);
    const folds = Array.from({ length: k }, () => []);
    for (const l of LABELS) {
      const ids = shuffle(labels.map((y, i) => (y === l ? i : -1)).filter((i) => i >= 0), rand);
      ids.forEach((id, n) => folds[n % k].push(id));
    }
    return folds;
  }

  /**
   * k-fold cross-validation of every engine.
   * Returns per-engine: mean/std accuracy & macro-F1, pooled metrics, misclassified examples, timing.
   * onProgress(fraction) is called after each fold.
   */
  function crossValidate(texts, labels, opts = {}) {
    const k = Math.min(opts.k || 5, Math.max(2, Math.min(...LABELS.map((l) => labels.filter((y) => y === l).length))));
    const folds = stratifiedFolds(labels, k, opts.seed || 7);
    const results = {};
    for (const e of ENGINES) results[e.key] = { engine: e, accs: [], f1s: [], yTrue: [], yPred: [], errors: [], trainMs: 0, predictMs: 0 };
    folds.forEach((testIdx, f) => {
      const testSet = new Set(testIdx);
      const trX = [], trY = [];
      texts.forEach((t, i) => {
        if (!testSet.has(i)) {
          trX.push(t);
          trY.push(labels[i]);
        }
      });
      for (const e of ENGINES) {
        const r = results[e.key];
        let t0 = Date.now();
        const predict = e.train(trX, trY);
        r.trainMs += Date.now() - t0;
        t0 = Date.now();
        const yT = [], yP = [];
        for (const i of testIdx) {
          const p = predict(texts[i]).label;
          yT.push(labels[i]);
          yP.push(p);
          if (p !== labels[i]) r.errors.push({ text: texts[i], actual: labels[i], predicted: p });
        }
        r.predictMs += Date.now() - t0;
        const m = metrics(yT, yP);
        r.accs.push(m.accuracy);
        r.f1s.push(m.macroF1);
        r.yTrue.push(...yT);
        r.yPred.push(...yP);
      }
      if (opts.onProgress) opts.onProgress((f + 1) / k);
    });
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const std = (a) => Math.sqrt(mean(a.map((v) => (v - mean(a)) ** 2)));
    const out = ENGINES.map((e) => {
      const r = results[e.key];
      return {
        key: e.key,
        name: e.name,
        short: e.short,
        accuracy: mean(r.accs),
        accuracyStd: std(r.accs),
        macroF1: mean(r.f1s),
        macroF1Std: std(r.f1s),
        pooled: metrics(r.yTrue, r.yPred),
        errors: r.errors,
        msPerText: (r.trainMs + r.predictMs) / texts.length,
      };
    });
    return { k, n: texts.length, results: out };
  }

  return { LABELS, NaiveBayes, LogisticRegression, ENGINES, metrics, crossValidate, stratifiedFolds, features, tokens, normalizeLabel, argmax, rng };
});
