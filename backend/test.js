/**
 * Quick self-test:  node backend/test.js
 */
"use strict";

const assert = require("assert");
const http = require("http");
const { analyze } = require("../js/sentiment.js");
const server = require("./server.js");
const Emotion = require("../js/emotion.js");
const Stats = require("../js/textstats.js");

const cases = [
  ["I love this product, it is absolutely amazing!!", "Positive"],
  ["This is terrible, worst purchase ever.", "Negative"],
  ["This is not good at all.", "Negative"],
  ["It isn't bad", "Positive"],
  ["The meeting is at 3pm in room 4.", "Neutral"],
  ["The food was good but the service was terrible.", "Negative"],
  ["Slightly disappointing, but overall I am happy :)", "Positive"],
  ["Never been happier, thanks!", "Positive"],
  ["VERY BAD experience 😡", "Negative"],
  ["", "Neutral"],
];

let passed = 0;
for (const [text, expected] of cases) {
  const r = analyze(text);
  assert.strictEqual(r.label, expected, `"${text}" → ${r.label}, expected ${expected}`);
  const sum = r.positive + r.neutral + r.negative;
  assert.ok(Math.abs(sum - 1) < 1e-9, "shares must sum to 1");
  assert.ok(r.compound >= -1 && r.compound <= 1, "compound in range");
  passed++;
}
console.log(`engine: ${passed}/${cases.length} passed`);

const emo = Emotion.analyze("I am so happy and excited, but a little scared. I am not angry.");
assert.ok(emo.scores.joy >= 1 && emo.scores.fear >= 1, "joy + fear detected");
assert.strictEqual(emo.scores.anger, 0, "negated anger ignored");
const st = Stats.stats("The cat sat. The dog ran!");
assert.strictEqual(st.sentences, 2);
assert.strictEqual(st.words, 6);
assert.ok(st.flesch > 80, "simple text is easy to read");
console.log("emotion + stats: passed");

// Hinglish support
const hinglish = [
  ["movie acchi nahi thi", "Negative"],
  ["bhot badiya", "Positive"],
  ["camera mast hai but battery bekaar", "Negative"],
  ["match kal 7 baje hai", "Neutral"],
  ["yaar ekdum bakwas film hai", "Negative"],
  ["bilkul pasand nahi aaya", "Negative"],
  ["service bahut slow hai lekin khana mast tha", "Positive"],
];
for (const [t, exp] of hinglish) assert.strictEqual(analyze(t).label, exp, `"${t}" → ${analyze(t).label}, expected ${exp}`);
assert.strictEqual(analyze("movie bahut acchi thi", { hinglish: false }).label, "Neutral", "English-only baseline ignores Hinglish");
const Lang = require("../js/language.js");
assert.strictEqual(Lang.detect("movie bahut acchi thi yaar").code, "hinglish");
assert.strictEqual(Lang.detect("The delivery was on time").code, "en");
assert.strictEqual(Lang.normalize("bhot"), "bahut");
console.log(`hinglish: ${hinglish.length + 4} checks passed`);

// ML
const ML = require("../js/ml.js");
const fs = require("fs");
const path = require("path");
global.window = {};
require(path.join(__dirname, "..", "js", "dataset.js"));
const ds = global.window.NP_DATASET;
const X = ds.rows.map((r) => r[0]), Y = ds.rows.map((r) => r[1]);
const nb = new ML.NaiveBayes().fit(X, Y);
assert.strictEqual(ML.argmax(nb.predictProba("ekdum bakwas aur bekaar")), "Negative");
const p = nb.predictProba("movie mast thi");
assert.ok(Math.abs(p.Positive + p.Neutral + p.Negative - 1) < 1e-9, "probabilities sum to 1");
const cv = ML.crossValidate(X, Y, { k: 5 });
assert.strictEqual(cv.results.length, 5);
for (const r of cv.results) assert.ok(r.accuracy > 0.3 && r.accuracy <= 1, r.name + " accuracy sane");
const m = ML.metrics(["Positive", "Negative", "Neutral", "Positive"], ["Positive", "Negative", "Positive", "Positive"]);
assert.strictEqual(m.accuracy, 0.75);
assert.ok(fs.existsSync(path.join(__dirname, "..", "data", "sample_hinglish_dataset.csv")));
console.log("ml: passed");

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port: server.address().port, method, path, headers: { "Content-Type": "application/json" } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, body: d }));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

server.listen(0, "127.0.0.1", async () => {
  try {
    let r = await request("POST", "/api/analyze", JSON.stringify({ text: "What a great day!" }));
    assert.strictEqual(r.status, 200);
    const body = JSON.parse(r.body);
    assert.strictEqual(body.label, "Positive");
    assert.ok(body.emotions && typeof body.emotions.joy === "number", "emotions returned");
    assert.ok(Array.isArray(body.sentences) && body.stats.words === 4, "sentences + stats returned");

    r = await request("POST", "/api/analyze", "not json");
    assert.strictEqual(r.status, 400);

    r = await request("GET", "/");
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.includes("Neon Pulse"));

    r = await request("GET", "/js/app.js");
    assert.strictEqual(r.status, 200);

    r = await request("GET", "/../backend/server.js");
    assert.ok(r.status === 403 || r.status === 404, "path traversal blocked");

    r = await request("GET", "/%2e%2e/backend/server.js");
    assert.ok(r.status === 403 || r.status === 404, "encoded traversal blocked");

    r = await request("GET", "/backend/server.js");
    assert.strictEqual(r.status, 404, "non-public folders not served");

    console.log("server: all checks passed");
  } catch (e) {
    console.error("FAILED:", e.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
