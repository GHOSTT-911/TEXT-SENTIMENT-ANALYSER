/**
 * Neon Pulse — lexicon-based sentiment engine.
 *
 * Runs entirely in the browser (and also in Node, for the optional backend/tests).
 * Features:
 *   - ~300-word weighted lexicon (scores 1–4)
 *   - negation that flips the next few words ("not good", "don't like")
 *   - intensifiers / dampeners ("very good", "slightly bad")
 *   - "but" handling: the clause after "but" counts more
 *   - exclamation marks, ALL-CAPS words, emoji and emoticons
 *   - returns the matched words so the UI can highlight them
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SentimentAnalyzer = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const POSITIVE = {
    // 4 — very strong
    amazing: 4, awesome: 4, brilliant: 4, excellent: 4, exceptional: 4, fantastic: 4,
    flawless: 4, incredible: 4, love: 4, loved: 4, loving: 4, magnificent: 4, outstanding: 4,
    perfect: 4, phenomenal: 4, spectacular: 4, superb: 4, wonderful: 4, best: 4, ecstatic: 4,
    thrilled: 4, masterpiece: 4, adore: 4, adored: 4,
    // 3 — strong
    beautiful: 3, delighted: 3, delightful: 3, enjoy: 3, enjoyed: 3, excited: 3, exciting: 3,
    gorgeous: 3, great: 3, happy: 3, impressive: 3, impressed: 3, joy: 3, joyful: 3,
    lovely: 3, marvelous: 3, recommend: 3, recommended: 3, stunning: 3, terrific: 3,
    grateful: 3, thankful: 3, success: 3, successful: 3, win: 3, winner: 3, glad: 3,
    favorite: 3, favourite: 3, remarkable: 3, inspiring: 3, blessed: 3, fabulous: 3,
    // 2 — moderate
    good: 2, nice: 2, like: 2, liked: 2, likes: 2, fun: 2, helpful: 2, kind: 2, pleasant: 2,
    pleased: 2, proud: 2, satisfied: 2, smooth: 2, friendly: 2, cool: 2, clean: 2,
    comfortable: 2, easy: 2, fast: 2, quick: 2, reliable: 2, useful: 2, worth: 2, worthy: 2,
    benefit: 2, improved: 2, improvement: 2, positive: 2, super: 2, wow: 2, thanks: 2,
    thank: 2, appreciate: 2, appreciated: 2, cheerful: 2, hope: 2, hopeful: 2, safe: 2,
    secure: 2, strong: 2, valuable: 2, welcome: 2, fresh: 2, tasty: 2, delicious: 3,
    affordable: 2, cute: 2, charming: 2, elegant: 2, efficient: 2, polite: 2, fair: 2,
    calm: 2, relaxed: 2, relaxing: 2, peaceful: 2, smart: 2, clever: 2, solid: 2,
    // 1 — mild
    ok: 1, okay: 1, fine: 1, decent: 1, yes: 1, better: 1, interesting: 1, adequate: 1,
    works: 1, working: 1, sure: 1, alright: 1,
    happier: 3, happiest: 4, greatest: 4, nicer: 2, nicest: 3, loves: 4, enjoying: 3, enjoys: 3,
    excellently: 4, beautifully: 3, perfectly: 4, wonderfully: 4, easier: 2, faster: 2,
  };

  const NEGATIVE = {
    // 4 — very strong
    abysmal: 4, atrocious: 4, awful: 4, disgusting: 4, dreadful: 4, hate: 4, hated: 4,
    horrible: 4, horrendous: 4, terrible: 4, worst: 4, pathetic: 4, furious: 4,
    nightmare: 4, appalling: 4, despise: 4, miserable: 4, catastrophe: 4, disaster: 4,
    useless: 4, scam: 4, garbage: 4, trash: 4,
    // 3 — strong
    angry: 3, annoyed: 3, annoying: 3, bad: 3, broken: 3, cruel: 3, depressed: 3,
    depressing: 3, disappointed: 3, disappointing: 3, disappointment: 3, fail: 3,
    failed: 3, failure: 3, fails: 3, frustrated: 3, frustrating: 3, sad: 3, unhappy: 3,
    upset: 3, ugly: 3, rude: 3, stupid: 3, painful: 3, poor: 3, lousy: 3, toxic: 3,
    waste: 3, wasted: 3, regret: 3, scary: 3, afraid: 3, hurt: 3, unacceptable: 3,
    dislike: 3, crap: 3, sucks: 3, ruined: 3, lost: 2, lose: 2, worse: 3, mess: 3,
    // 2 — moderate
    boring: 2, bored: 2, confusing: 2, confused: 2, difficult: 2, expensive: 2, problem: 2,
    problems: 2, wrong: 2, worried: 2, worry: 2, slow: 2, dirty: 2, buggy: 2, bug: 2,
    error: 2, errors: 2, crash: 2, crashed: 2, crashes: 2, unfair: 2, weak: 2, sick: 2,
    tired: 2, lonely: 2, nervous: 2, anxious: 2, stress: 2, stressed: 2, stressful: 2,
    complaint: 2, complain: 2, mediocre: 2, overpriced: 2, unreliable: 2, uncomfortable: 2,
    negative: 2, delay: 2, delayed: 2, late: 2, cheap: 1, sorry: 1, hard: 1, missing: 2,
    damaged: 3, dangerous: 3, unsafe: 3, sorrow: 3, cry: 2, crying: 2, fear: 3,
    // 1 — mild
    hates: 4, failing: 3, failure: 3, overrated: 2, pricey: 2, laggy: 2, noisy: 2, smelly: 3, broke: 3, cracked: 2, leaking: 2, refund: 1, rubbish: 3, unusable: 4, worthless: 4, nervous: 2, scared: 3, terrified: 4, ignored: 2, cold: 1, stale: 2, saddest: 4, sadder: 3, worsened: 3, angrier: 3, horribly: 4, terribly: 4, badly: 3,
    issue: 1, issues: 1, meh: 1, odd: 1, strange: 1, lacking: 1, average: 1, bland: 1,
  };

  const EMOJI = {
    "😀": 3, "😃": 3, "😄": 3, "😁": 3, "😊": 3, "🙂": 2, "😍": 4, "🥰": 4, "😘": 3,
    "👍": 2, "👏": 2, "🎉": 3, "❤️": 3, "❤": 3, "💖": 3, "🔥": 2, "✨": 2, "😂": 2, "🤩": 4,
    "😢": -3, "😭": -3, "😞": -3, "😔": -2, "😠": -3, "😡": -4, "🤬": -4, "👎": -2, "💔": -3,
    "😩": -3, "😫": -3, "🙁": -2, "☹️": -2, "😒": -2, "🤮": -4,
  };
  const EMOTICONS = {
    ":)": 2, ":-)": 2, ":d": 3, ":-d": 3, "<3": 3, ";)": 1, ":p": 1,
    ":(": -2, ":-(": -2, ":'(": -3, ">:(": -3, ":/": -1, "</3": -3,
  };


  /* ---------------- Hinglish (Romanised Hindi) lexicon ----------------
     Covers common spelling variants seen on social media. */
  const HI_POSITIVE = {
    accha: 2, acha: 2, achha: 2, acchha: 2, achcha: 2, acchi: 2, achi: 2, achhi: 2, acche: 2, ache: 2, achhe: 2,
    badhiya: 3, badiya: 3, badhia: 3, bdiya: 3, badhiyaa: 3,
    mast: 3, zabardast: 4, jabardast: 4, zabrdast: 4, jabardust: 4,
    kamaal: 4, kamal: 3, shandaar: 4, shandar: 4, behtareen: 4, behtarin: 4, lajawab: 4, lajawaab: 4,
    khatarnak: 3, khatarnaak: 3, dhansu: 4, jhakaas: 4, jhakas: 4, gazab: 4, gajab: 4, ghazab: 4,
    pasand: 2, pyaar: 3, pyar: 3, pyaara: 3, pyara: 3, pyari: 3, pyaari: 3, pyaare: 3,
    khush: 3, khushi: 3, maza: 3, mazaa: 3, maja: 3, majaa: 3, mazedaar: 3, mazedar: 3,
    sundar: 3, khoobsurat: 3, khubsurat: 3, sahi: 2, sach: 1, vasool: 3, vasul: 3, wasool: 3,
    wah: 3, waah: 3, vah: 2, shukriya: 2, dhanyavad: 2, dhanyawad: 2, shabash: 3, shabaash: 3,
    superhit: 4, blockbuster: 4, hit: 2, osm: 3, awsm: 3, op: 2, lit: 2, khaas: 2, khas: 2,
    jeet: 2, jeeta: 2, jeete: 2, jeetenge: 2, sukoon: 3, sukun: 3, aaram: 2, araam: 2, tagda: 3, tagdi: 3,
    swadisht: 3, tasty: 2, imaandar: 3, imandar: 3, madadgar: 2, behtar: 2, sasta: 1, saste: 1, sasti: 1,
    josh: 2, umeed: 1, garv: 2, fakhr: 2, theek: 1, thik: 1,
  };
  const HI_NEGATIVE = {
    bakwas: 4, bakwaas: 4, bekaar: 3, bekar: 3, ghatiya: 4, ghatia: 4, faltu: 3, faltoo: 3,
    bura: 3, buri: 3, bure: 3, pakau: 3, pakaau: 3, bor: 2, dukh: 3, dukhi: 3, udaas: 3, udas: 3,
    dard: 2, gussa: 3, naraz: 3, naraaz: 3, pareshan: 3, pareshaan: 3, takleef: 2, taklif: 2,
    dhokha: 4, dhoka: 4, chor: 3, loot: 3, lootna: 3, barbaad: 4, barbad: 4, flop: 3, kachra: 4,
    wahiyat: 4, wahiyaat: 4, nautanki: 2, jhooth: 3, jhoot: 3, jhootha: 3, jhutha: 3,
    ganda: 3, gandi: 3, gande: 3, mehenga: 2, mehnga: 2, mehanga: 2, mehngi: 2, mehengi: 2,
    kharab: 3, kharaab: 3, galat: 2, nakli: 3, dhima: 2, dheema: 2, darr: 2, ghabrahat: 2,
    haar: 2, haare: 2, haara: 2, hang: 2, rona: 2, sharam: 2, sharmnaak: 4, sharmnak: 4,
    bekaboo: 2, bewakoof: 3, bevakoof: 3, pagal: 1, ullu: 2, tension: 2, jhamela: 2, lafda: 2,
    ghussa: 3, thaka: 1, thakaan: 1, thanda: 1, besharam: 3, ghatiyapan: 4, fraud: 4,
  };
  const HI_BOOSTERS = {
    bahut: 1.6, bahot: 1.6, bhot: 1.6, bohot: 1.6, bht: 1.6, bhut: 1.6, bahuut: 1.7,
    ekdum: 1.7, ekdam: 1.7, bilkul: 1.5, kaafi: 1.3, kafi: 1.3, zyada: 1.4, jyada: 1.4, zada: 1.4,
    itna: 1.4, itni: 1.4, itne: 1.4, sabse: 1.6, sbse: 1.6, poora: 1.3, pura: 1.3, puri: 1.3,
    thoda: 0.6, thodi: 0.6, thode: 0.6, halka: 0.6, zara: 0.7,
  };
  // Hindi negation usually comes AFTER the word: "acchi nahi thi" (= was not good).
  const HI_POST_NEGATORS = new Set(["nahi", "nahin", "nai", "nhi", "nahee", "nahii"]);
  const HI_PRE_NEGATORS = new Set(["mat", "bina", "na"]);
  const HI_CONTRAST = new Set(["lekin", "magar", "parantu", "pr", "par"]);

  const NEGATORS = new Set([
    "not", "no", "never", "none", "nobody", "nothing", "neither", "nor", "hardly",
    "barely", "scarcely", "without", "cannot", "cant", "dont", "doesnt", "didnt", "isnt",
    "arent", "wasnt", "werent", "wont", "wouldnt", "shouldnt", "couldnt", "aint", "havent",
    "hasnt", "hadnt", "nt",
  ]);

  const BOOSTERS = {
    very: 1.5, really: 1.5, so: 1.4, extremely: 1.8, absolutely: 1.8, totally: 1.6,
    completely: 1.6, incredibly: 1.8, super: 1.5, highly: 1.5, truly: 1.4, too: 1.3,
    quite: 1.2, most: 1.4, deeply: 1.6, utterly: 1.8, especially: 1.3,
    slightly: 0.5, somewhat: 0.6, little: 0.6, bit: 0.6, kinda: 0.6, kindof: 0.6,
    barely: 0.5, mildly: 0.5, fairly: 0.8, partly: 0.6,
  };

  const CONTRAST = new Set(["but", "however", "although", "though", "yet"]);
  const NEGATION_WINDOW = 3;
  // "never been happier", "couldn't be better": negated comparatives stay positive.
  const IDIOM_COMPARATIVES = new Set(["happier", "better", "greater", "nicer", "easier", "prouder"]);

  function normalizeWord(w) {
    return w.replace(/'/g, "").replace(/’/g, "");
  }

  /** Split text into display tokens (words, emoticons, emoji, punctuation, spaces). */
  function tokenize(text) {
    const re =
      /(>:\(|:'\(|<\/3|<3|:-?[)(dDpP\/]|;\))|([\p{Extended_Pictographic}](?:️)?)|([A-Za-z][A-Za-z'’]*)|(\s+)|([^\sA-Za-z])/gu;
    const out = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[1]) out.push({ text: m[1], type: "emoticon" });
      else if (m[2]) out.push({ text: m[2], type: "emoji" });
      else if (m[3]) out.push({ text: m[3], type: "word" });
      else if (m[4]) out.push({ text: m[4], type: "space" });
      else out.push({ text: m[5], type: m[5] === "!" ? "bang" : /[.?;,:]/.test(m[5]) ? "stop" : "punct" });
    }
    return out;
  }

  /**
   * @param {string} text
   * @returns {{
   *   label: "Positive"|"Neutral"|"Negative",
   *   compound: number,       // -1 … +1
   *   positive: number, neutral: number, negative: number,  // shares, sum to 1
   *   tokens: Array<{text:string,type:string,score?:number}>,
   *   matches: {positive:string[], negative:string[]},
   *   wordCount: number
   * }}
   */
  function analyze(text, opts) {
    const hi = !opts || opts.hinglish !== false;
    const tokens = tokenize(String(text || ""));
    let negateLeft = 0;
    let boost = 1;
    let afterContrast = false;
    let pos = 0;
    let neg = 0;
    let wordCount = 0;
    let lastHit = null; // last sentiment word, for Hindi post-negation
    const matches = { positive: [], negative: [] };
    const bangs = (String(text).match(/!/g) || []).length;

    const posOf = (w) => POSITIVE[w] || (hi && HI_POSITIVE[w]) || 0;
    const negOf = (w) => NEGATIVE[w] || (hi && HI_NEGATIVE[w]) || 0;
    const boostOf = (w) => BOOSTERS[w] || (hi && HI_BOOSTERS[w]) || 0;

    const record = (tok, s, sign) => {
      if (sign > 0) {
        pos += s;
        matches.positive.push(tok.text);
      } else {
        neg += s;
        matches.negative.push(tok.text);
      }
    };
    const unrecord = (tok, s, sign) => {
      const list = sign > 0 ? matches.positive : matches.negative;
      const i = list.lastIndexOf(tok.text);
      if (i >= 0) list.splice(i, 1);
      if (sign > 0) pos -= s;
      else neg -= s;
    };

    for (const tok of tokens) {
      if (tok.type === "space" || tok.type === "punct") continue;
      if (tok.type === "stop") {
        negateLeft = 0;
        boost = 1;
        lastHit = null;
        continue;
      }
      if (tok.type === "bang") continue;

      let base = 0;
      if (tok.type === "emoji") {
        base = EMOJI[tok.text] || EMOJI[tok.text.replace(/️/g, "")] || 0;
      } else if (tok.type === "emoticon") {
        base = EMOTICONS[tok.text.toLowerCase()] || 0;
      } else {
        wordCount++;
        const raw = tok.text;
        const w = normalizeWord(raw.toLowerCase()).replace(/(.)\1{2,}/g, "$1$1"); // "bahuuut" → "bahuut"

        if (CONTRAST.has(w) || (hi && HI_CONTRAST.has(w) && w !== "par" && w !== "pr")) {
          // Text before "but/lekin" matters less, text after matters more.
          pos *= 0.5;
          neg *= 0.5;
          afterContrast = true;
          negateLeft = 0;
          boost = 1;
          lastHit = null;
          continue;
        }
        if (hi && HI_POST_NEGATORS.has(w)) {
          if (lastHit && !lastHit.negated && wordCount - lastHit.at <= 3) {
            // Flip the previous sentiment word: "accha nahi" → negative.
            const t = lastHit;
            unrecord(t.tok, Math.abs(t.s), Math.sign(t.s));
            const ns = -0.75 * t.s;
            record(t.tok, Math.abs(ns), Math.sign(ns));
            t.tok.score = Number(ns.toFixed(2));
            t.negated = true;
          } else {
            negateLeft = NEGATION_WINDOW; // "nahi pasand" style
          }
          continue;
        }
        if (NEGATORS.has(w) || /n[’']t$/.test(raw.toLowerCase()) || (hi && HI_PRE_NEGATORS.has(w) && w !== "na")) {
          negateLeft = NEGATION_WINDOW;
          continue;
        }
        const b = boostOf(w);
        if (b && !posOf(w)) {
          boost *= b;
          continue;
        }
        if (posOf(w)) base = posOf(w);
        else if (negOf(w)) base = -negOf(w);

        if (base && raw.length > 2 && raw === raw.toUpperCase()) base *= 1.3; // SHOUTING
      }

      if (base) {
        let s = base * boost;
        const word = tok.type === "word" ? normalizeWord(tok.text.toLowerCase()) : "";
        // Emoji keep their own polarity: "help nahi ki 😡" must stay negative.
        const wasNegated = negateLeft > 0 && tok.type === "word" && !IDIOM_COMPARATIVES.has(word);
        if (wasNegated) s *= -0.75; // "not good" is negative, but softer than "bad"
        if (afterContrast) s *= 1.5;
        tok.score = Number(s.toFixed(2));
        record(tok, Math.abs(s), Math.sign(s));
        lastHit = tok.type === "word" ? { tok, s, at: wordCount, negated: wasNegated } : null;
        boost = 1;
        negateLeft = 0;
      } else if (negateLeft > 0) {
        negateLeft--;
      }
    }

    // Exclamation marks amplify whichever direction dominates.
    if (bangs && pos + neg > 0) {
      const amp = 1 + Math.min(bangs, 4) * 0.08;
      if (pos >= neg) pos *= amp;
      else neg *= amp;
    }

    // Compound in -1..1 (VADER-style normalization).
    const net = pos - neg;
    const compound = Number((net / Math.sqrt(net * net + 15)).toFixed(3));

    // Shares: neutral mass = words that carried no sentiment.
    const sentimentWords = matches.positive.length + matches.negative.length;
    const neutralMass = Math.max(wordCount - sentimentWords, 0) * 0.6 + 0.5;
    const total = pos + neg + neutralMass;

    let label = "Neutral";
    if (compound >= 0.05 && pos > neg) label = "Positive";
    else if (compound <= -0.05 && neg > pos) label = "Negative";

    return {
      label,
      compound,
      positive: pos / total,
      negative: neg / total,
      neutral: neutralMass / total,
      tokens,
      matches,
      wordCount,
    };
  }

  const LEXICON_SIZE = Object.keys(POSITIVE).length + Object.keys(NEGATIVE).length;
  const HINGLISH_SIZE = Object.keys(HI_POSITIVE).length + Object.keys(HI_NEGATIVE).length;

  return { analyze, tokenize, LEXICON_SIZE, HINGLISH_SIZE, HI_POSITIVE, HI_NEGATIVE, HI_BOOSTERS };
});
