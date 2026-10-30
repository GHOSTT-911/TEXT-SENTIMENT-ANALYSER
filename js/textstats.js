/**
 * Neon Pulse — text statistics: sentences, keywords, readability.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TextStats = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STOP = new Set(
    ("a about above after again against all am an and any are as at be because been before being below between both but by " +
      "can could did do does doing down during each few for from further had has have having he her here hers herself him himself his " +
      "how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out " +
      "over own same she should so some such than that the their theirs them themselves then there these they this those through to too " +
      "under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves " +
      "im ive id youre theyre dont doesnt didnt isnt wasnt cant wont also get got really one much even still well us let lets thats " +
      "theres yet ever may might must shall said say says like just however though although way kept keep keeps make made thing things lot two three four five six seven").split(/\s+/)
  );

  /** Split into sentences, keeping their text. */
  function sentences(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return [];
    const parts = t.match(/[^.!?\n]+[.!?]*|[.!?]+/g) || [t];
    return parts.map((s) => s.trim()).filter((s) => /[A-Za-z0-9\p{Extended_Pictographic}]/u.test(s));
  }

  function words(text) {
    return (String(text || "").toLowerCase().match(/[a-z][a-z'’]*/g) || []).map((w) => w.replace(/['’]/g, ""));
  }

  function syllables(word) {
    let w = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
    const groups = w.match(/[aeiouy]{1,2}/g);
    return Math.max(1, groups ? groups.length : 1);
  }

  function keywords(text, limit = 12) {
    const counts = {};
    for (const w of words(text)) {
      if (w.length < 3 || STOP.has(w)) continue;
      counts[w] = (counts[w] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
  }

  function readabilityLevel(score) {
    if (score >= 90) return "Very easy";
    if (score >= 80) return "Easy";
    if (score >= 70) return "Fairly easy";
    if (score >= 60) return "Standard";
    if (score >= 50) return "Fairly difficult";
    if (score >= 30) return "Difficult";
    return "Very difficult";
  }

  function stats(text) {
    const ws = words(text);
    const ss = sentences(text);
    const wc = ws.length;
    const sc = Math.max(ss.length, wc ? 1 : 0);
    const syl = ws.reduce((a, w) => a + syllables(w), 0);
    const flesch = wc ? 206.835 - 1.015 * (wc / sc) - 84.6 * (syl / wc) : 0;
    const unique = new Set(ws).size;
    return {
      characters: String(text || "").length,
      words: wc,
      sentences: ss.length,
      uniqueWords: unique,
      lexicalDiversity: wc ? unique / wc : 0,
      avgWordLength: wc ? ws.reduce((a, w) => a + w.length, 0) / wc : 0,
      avgSentenceLength: sc ? wc / sc : 0,
      readingTimeSec: Math.round((wc / 230) * 60),
      flesch: Math.max(0, Math.min(100, flesch)),
      readability: wc ? readabilityLevel(flesch) : "—",
    };
  }

  return { sentences, words, keywords, stats, syllables, STOP };
});
