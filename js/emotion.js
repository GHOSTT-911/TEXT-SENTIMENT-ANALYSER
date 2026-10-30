/**
 * Neon Pulse — emotion detection (Plutchik's 8 basic emotions).
 * Lexicon-based: each word/emoji maps to one or more emotions with a weight.
 * Negated words are skipped ("not happy" does not count as joy).
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EmotionAnalyzer = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const EMOTIONS = [
    { key: "joy", label: "Joy", emoji: "😄", color: "#e0b130" },
    { key: "trust", label: "Trust", emoji: "🤝", color: "#5fae6b" },
    { key: "fear", label: "Fear", emoji: "😨", color: "#6c8f7d" },
    { key: "surprise", label: "Surprise", emoji: "😲", color: "#4f98b8" },
    { key: "sadness", label: "Sadness", emoji: "😢", color: "#5a6fa6" },
    { key: "disgust", label: "Disgust", emoji: "🤢", color: "#8a6a9e" },
    { key: "anger", label: "Anger", emoji: "😠", color: "#c0433f" },
    { key: "anticipation", label: "Anticipation", emoji: "🤩", color: "#d4823a" },
  ];

  const W = {
    joy: "khush khushi maza mazaa maja mast pyaar pyar wah waah mazedaar jeet jeeta shabash zabardast kamaal jhakaas happy happier happiest joy joyful love loved loves lovely glad delighted delight cheerful smile smiling laugh laughing fun enjoy enjoyed enjoying excited exciting wonderful amazing awesome fantastic great beautiful celebrate celebration pleased pleasure thrilled ecstatic blessed grateful thankful yay hooray brilliant perfect best win won success proud",
    trust: "bharosa bharosemand bhrosa vishwas bhaiya imaandar imandar madadgar sahi theek clean smooth fast quality guaranteed trust trusted trustworthy reliable dependable honest loyal faithful safe secure confident confidence believe faith sure certain support supportive helpful recommend recommended friend friendly respect respected genuine authentic guarantee professional consistent stable solid",
    fear: "darr dar ghabrahat tension dara dari darr gaya bhay confusing confused exam deadline afraid fear feared scared scary terrified terrifying panic anxious anxiety nervous worry worried worrying dread horror horrified threat threatening danger dangerous unsafe risk risky frightened frightening alarm alarming creepy nightmare uncertain insecure tense",
    surprise: "gazab gajab arre arey arey baap omg kya sach mein achanak surprise surprised surprising wow whoa unexpected unexpectedly suddenly sudden shocked shocking astonished astonishing amazed stunning stunned unbelievable incredible omg speechless remarkable strange odd weird mysterious",
    sadness: "dukh dukhi udaas udas rona roya royi haar haare akela fail failed failing failure lonely sigh unfortunately unfortunate sad sadder saddest sorrow unhappy depressed depressing depression cry crying cried tears lonely alone miserable grief grieve heartbroken broken hurt hurting pain painful loss lost lose miss missing disappointed disappointing disappointment regret gloomy hopeless sorry down",
    disgust: "ghatiya ghatia kachra ganda gandi gande wahiyat wahiyaat bakwas bakwaas chhee chi yuck bland overpriced stale greasy disgust disgusting disgusted gross nasty yuck awful revolting horrible vile filthy dirty sick sickening repulsive terrible worst trash garbage rotten smelly ugly pathetic toxic creepy cheap",
    anger: "gussa ghussa naraz naraaz pareshan dhokha chor loot bakwas bekaar faltu besharam crashing crashes crashed ignored delayed late broke furious annoy terrible awful angry anger mad furious rage hate hated hatred annoyed annoying irritated irritating frustrated frustrating outraged outrage hostile rude unfair unacceptable ridiculous stupid idiot damn scam cheated liar lied fight yelling shouting worst useless",
    anticipation: "intezaar intezar besabri jaldi kal aage umeed anticipate anticipation expect expecting expected hope hoping hopeful await awaiting eager soon future plan planning ready excited waiting looking forward upcoming launch tomorrow next goal dream curious prepare preparing",
  };

  const EMOJI = {
    "😀": ["joy"], "😃": ["joy"], "😄": ["joy"], "😁": ["joy"], "😊": ["joy"], "🙂": ["joy"],
    "😂": ["joy"], "😍": ["joy", "trust"], "🥰": ["joy", "trust"], "🎉": ["joy", "anticipation"],
    "❤": ["joy", "trust"], "❤️": ["joy", "trust"], "👍": ["trust"], "🤝": ["trust"],
    "😨": ["fear"], "😱": ["fear", "surprise"], "😰": ["fear"], "😲": ["surprise"], "😮": ["surprise"],
    "🤯": ["surprise"], "😢": ["sadness"], "😭": ["sadness"], "😞": ["sadness"], "💔": ["sadness"],
    "🤢": ["disgust"], "🤮": ["disgust"], "😠": ["anger"], "😡": ["anger"], "🤬": ["anger"],
    "🤩": ["anticipation", "joy"], "🔥": ["anticipation"], "⏳": ["anticipation"],
  };

  const LEX = {};
  for (const [emo, list] of Object.entries(W)) {
    for (const w of list.split(/\s+/)) (LEX[w] = LEX[w] || []).push(emo);
  }

  const NEGATORS = new Set(["not", "no", "never", "dont", "doesnt", "didnt", "isnt", "wasnt", "arent", "werent", "cant", "cannot", "wont", "hardly", "barely", "without", "nothing"]);

  const POST_NEG = new Set(["nahi", "nahin", "nhi", "nai"]);

  function analyze(text) {
    const scores = Object.fromEntries(EMOTIONS.map((e) => [e.key, 0]));
    const words = {};
    const re = /([\p{Extended_Pictographic}]\uFE0F?)|([A-Za-z][A-Za-z'’]*)|([.!?;,])/gu;
    const toks = [];
    let m;
    while ((m = re.exec(String(text || ""))) !== null) {
      if (m[3]) toks.push({ t: ".", kind: "stop" });
      else if (m[1]) toks.push({ t: m[1], kind: "emoji" });
      else toks.push({ t: m[2].toLowerCase().replace(/['’]/g, ""), kind: "word" });
    }
    let negate = 0;
    for (let i = 0; i < toks.length; i++) {
      const { t, kind } = toks[i];
      if (kind === "stop") {
        negate = 0;
        continue;
      }
      if (kind === "word" && NEGATORS.has(t)) {
        negate = 3;
        continue;
      }
      const emos = kind === "emoji" ? EMOJI[t] || EMOJI[t.replace(/\uFE0F/g, "")] : LEX[t];
      if (!emos) {
        if (negate > 0) negate--;
        continue;
      }
      // Hindi negation follows the word: "khush nahi hoon"
      let postNeg = false;
      for (let j = i + 1; j <= i + 3 && j < toks.length && toks[j].kind !== "stop"; j++) {
        if (POST_NEG.has(toks[j].t)) postNeg = true;
      }
      if (negate > 0 || postNeg) {
        negate = 0;
        continue;
      }
      for (const e of emos) {
        scores[e] += 1;
        (words[e] = words[e] || []).push(t);
      }
    }
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const normalized = Object.fromEntries(
      Object.entries(scores).map(([k, v]) => [k, total ? v / total : 0])
    );
    let dominant = null;
    if (total) {
      const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
      dominant = EMOTIONS.find((e) => e.key === best);
    }
    return { scores, normalized, total, dominant, words };
  }

  return { analyze, EMOTIONS };
});
