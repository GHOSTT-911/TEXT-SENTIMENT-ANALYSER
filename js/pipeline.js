/**
 * Neon Pulse — NLP pipeline: runs every module on a text and returns one report.
 *   Input → preprocessing → sentiment scoring → emotion mapping → sentence analysis → statistics
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./sentiment.js"), require("./emotion.js"), require("./textstats.js"), require("./language.js"));
  } else {
    root.NLPPipeline = factory(root.SentimentAnalyzer, root.EmotionAnalyzer, root.TextStats, root.LanguageDetector);
  }
})(typeof self !== "undefined" ? self : this, function (Sentiment, Emotion, Stats, Lang) {
  "use strict";

  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  function run(text) {
    const t0 = now();
    const language = Lang.detect(text);
    const sentiment = Sentiment.analyze(text);
    const emotion = Emotion.analyze(text);
    const stats = Stats.stats(text);
    const keywords = Stats.keywords(text, 30);
    const sentences = Stats.sentences(text).map((s, i) => {
      const r = Sentiment.analyze(s);
      return { index: i + 1, text: s, compound: r.compound, label: r.label };
    });
    // Confidence: how far the score is from neutral, boosted by how much evidence we found.
    const evidence = sentiment.matches.positive.length + sentiment.matches.negative.length;
    const confidence = Math.min(
      0.99,
      sentiment.label === "Neutral"
        ? 0.55 + 0.4 * (1 - Math.min(1, Math.abs(sentiment.compound) * 4)) * (evidence ? 0.6 : 1)
        : 0.5 + Math.abs(sentiment.compound) * 0.4 + Math.min(evidence, 5) * 0.02
    );
    return {
      text: String(text || ""),
      language,
      sentiment,
      emotion,
      stats,
      keywords,
      sentences,
      confidence,
      elapsedMs: now() - t0,
    };
  }

  return { run };
});
