/**
 * Neon Pulse — language identification & Hinglish spelling normalisation.
 *
 *   LanguageDetector.detect(text)    → { code, label, hindiShare, hindiWords, englishWords }
 *   LanguageDetector.normalize(word) → canonical spelling ("bahot" → "bahut", "nhi" → "nahi")
 *
 * Code-mixed text is labelled "Hinglish" when a meaningful share of words are Romanised Hindi.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LanguageDetector = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Frequent Romanised-Hindi words (function words + common vocabulary).
  // Ambiguous English look-alikes (the, me, to, main, so, he, par) are deliberately excluded.
  const HINDI = new Set(
    ("hai hain h tha thi thhe ka ki ke ko se mein mai mujhe mera meri mere tera teri tere apna apni apne " +
      "nahi nahin nhi nai bhi toh aur ek yeh ye woh wo voh kya kyu kyun kyon kaise kaisa kaisi kuch kuchh " +
      "bahut bahot bhot bohot bht yaar yar bhai bhaiya abhi sab sabhi hum tum aap unka uska iska wala wali wale " +
      "raha rahi rahe gaya gayi gaye diya di kar karo kiya kiye karna karte karta karti hua hui hue ho hoga hogi " +
      "lekin magar phir fir bas jo ab jab tab kab kahan yahan wahan accha acha achha acchi achi ekdum bilkul " +
      "matlab kyunki isliye waise vaise sirf bohat zyada jyada thoda thodi kitna kitni itna itni bada badi chota " +
      "chhota pehle baad aaj kal raat din waqt samay paisa paise log logon ladka ladki dost ghar khana pani " +
      "dekha dekho dekhna suna bola bolo bolna laga lagi lage lagta lagti aaya aayi aaye gya gyi diya liya " +
      "theek thik haan han na mat bina sahi galat pata chal chalo chala chali wapas jaldi der koi kisi " +
      "mast bakwas bakwaas bekaar bekar ghatiya zabardast jabardast badhiya badiya kamaal shandaar pasand pyaar " +
      "pyar khush maza mazaa faltu kharab kharaab dhokha gussa dukh paisa vasool barbaad wah waah ji").split(/\s+/)
  );

  const ENGLISH = new Set(
    ("the a an is are was were be been am i you he she it we they this that these those of in on at for with " +
      "and or but not no very so to from by as my your our their his her its me him them what which who when " +
      "where why how all any some more most good bad great love like hate movie phone service product time " +
      "really just also have has had do does did will would can could should get got make made go went").split(/\s+/)
  );

  // Spelling variants → canonical form (used by the ML feature extractor).
  const VARIANTS = {
    bahot: "bahut", bahoot: "bahut", bhot: "bahut", bohot: "bahut", bht: "bahut", bhut: "bahut", bohat: "bahut", bahuut: "bahut",
    acha: "accha", achha: "accha", acchha: "accha", achcha: "accha", acchi: "accha", achi: "accha", achhi: "accha",
    acche: "accha", ache: "accha", achhe: "accha",
    nahin: "nahi", nhi: "nahi", nai: "nahi", nahee: "nahi", nahii: "nahi",
    h: "hai", hy: "hai", hain: "hai",
    bakwaas: "bakwas", bekar: "bekaar", ghatia: "ghatiya", faltoo: "faltu", kharaab: "kharab",
    jabardast: "zabardast", zabrdast: "zabardast", jabardust: "zabardast",
    badiya: "badhiya", badhia: "badhiya", bdiya: "badhiya", badhiyaa: "badhiya",
    shandar: "shandaar", behtarin: "behtareen", lajawaab: "lajawab", gajab: "gazab", ghazab: "gazab",
    pyar: "pyaar", pyara: "pyaara", pyari: "pyaara", pyaari: "pyaara", pyaare: "pyaara",
    maja: "maza", mazaa: "maza", majaa: "maza", mazedar: "mazedaar",
    naraaz: "naraz", pareshaan: "pareshan", taklif: "takleef", dhoka: "dhokha", barbad: "barbaad",
    wahiyaat: "wahiyat", jhoot: "jhooth", jhutha: "jhootha", mehnga: "mehenga", mehanga: "mehenga",
    mehngi: "mehenga", mehengi: "mehenga", thik: "theek", ekdam: "ekdum", kafi: "kaafi",
    jyada: "zyada", zada: "zyada", kyun: "kyu", kyon: "kyu", yar: "yaar", vasul: "vasool", wasool: "vasool",
    waah: "wah", vah: "wah", gya: "gaya", gyi: "gayi", fir: "phir", kuchh: "kuch",
    pls: "please", plz: "please", thx: "thanks", tq: "thanks", u: "you", ur: "your", r: "are",
    gud: "good", gr8: "great", awsm: "awesome", osm: "awesome", luv: "love", bcoz: "because", coz: "because",
  };

  function normalize(word) {
    let w = String(word).toLowerCase().replace(/['’]/g, "").replace(/(.)\1{2,}/g, "$1$1");
    if (VARIANTS[w]) return VARIANTS[w];
    w = w.replace(/(.)\1+/g, "$1$1");
    return VARIANTS[w] || w;
  }

  function detect(text) {
    const s = String(text || "");
    if (/[ऀ-ॿ]/.test(s)) {
      return { code: "hi-deva", label: "Hindi (Devanagari)", hindiShare: 1, hindiWords: 0, englishWords: 0, supported: false };
    }
    const words = (s.toLowerCase().match(/[a-z][a-z'’]*/g) || []).map((w) => w.replace(/['’]/g, ""));
    if (!words.length) return { code: "unknown", label: "—", hindiShare: 0, hindiWords: 0, englishWords: 0, supported: true };
    let h = 0, e = 0;
    for (const raw of words) {
      const w = normalize(raw);
      if (HINDI.has(raw) || HINDI.has(w)) h++;
      else if (ENGLISH.has(raw)) e++;
    }
    const share = h / words.length;
    let code = "en", label = "English";
    if (share >= 0.55 && e <= words.length * 0.15) {
      code = "hi-latn";
      label = "Hindi (Roman)";
    } else if (share >= 0.15 || (h >= 2 && share >= 0.1)) {
      code = "hinglish";
      label = "Hinglish (code-mixed)";
    }
    return { code, label, hindiShare: share, hindiWords: h, englishWords: e, supported: true };
  }

  return { detect, normalize, HINDI, VARIANTS };
});
