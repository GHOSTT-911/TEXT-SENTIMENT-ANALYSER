/**
 * Neon Pulse — optional local server (zero dependencies, Node 18+).
 *
 *   node backend/server.js          → http://localhost:3000
 *
 * - Serves the web app (index.html, css/, js/) from the project root.
 * - POST /api/analyze  { "text": "..." }  → sentiment JSON (same engine as the browser).
 * - Listens on 127.0.0.1 only, so other devices on your network cannot reach it.
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { run } = require("../js/pipeline.js");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname, "..");
// Only the web app is public; backend/, data/, docs/ etc. are not served.
const PUBLIC = ["index.html", "css", "js"];
const MAX_BODY = 20 * 1024; // 20 KB

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function handleApi(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  let size = 0;
  const chunks = [];
  req.on("data", (c) => {
    size += c.length;
    if (size > MAX_BODY) {
      send(res, 413, { error: "Body too large" });
      req.destroy();
    } else chunks.push(c);
  });
  req.on("end", () => {
    if (res.writableEnded) return;
    let text;
    try {
      text = JSON.parse(Buffer.concat(chunks).toString("utf8")).text;
    } catch (_) {
      return send(res, 400, { error: "Send JSON like {\"text\": \"...\"}" });
    }
    if (typeof text !== "string" || !text.trim()) return send(res, 400, { error: "'text' must be a non-empty string" });
    if (text.length > 5000) return send(res, 400, { error: "'text' is longer than 5000 characters" });
    const r = run(text);
    const s = r.sentiment;
    send(res, 200, {
      label: s.label,
      compound: s.compound,
      confidence: +r.confidence.toFixed(3),
      positive: +s.positive.toFixed(3),
      neutral: +s.neutral.toFixed(3),
      negative: +s.negative.toFixed(3),
      matches: s.matches,
      emotions: r.emotion.scores,
      dominantEmotion: r.emotion.dominant ? r.emotion.dominant.key : null,
      sentences: r.sentences,
      keywords: r.keywords.slice(0, 10),
      stats: r.stats,
    });
  });
}

function handleStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed" });
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch (_) {
    return send(res, 400, { error: "Bad URL" });
  }
  if (urlPath.endsWith("/")) urlPath += "index.html";
  const file = path.resolve(ROOT, "." + urlPath);
  // Block path traversal (e.g. /../../secret.txt)
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, { error: "Forbidden" });
  if (!PUBLIC.includes(path.relative(ROOT, file).split(path.sep)[0])) return send(res, 404, "Not found", "text/plain; charset=utf-8");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    send(res, 200, data, TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/analyze")) return handleApi(req, res);
  return handleStatic(req, res);
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Neon Pulse running at http://localhost:${PORT}  (press Ctrl+C to stop)`);
  });
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") console.error(`Port ${PORT} is busy. Try: set PORT=3001 && node backend/server.js`);
    else console.error(e);
    process.exit(1);
  });
}

module.exports = server;
