// Paint Masters Daily Ops Board — standalone server
// Zero dependencies. Serves the board page and a tiny JSON API backed by a file on disk.
// No Claude account or login required — access is gated by a single shared passphrase.

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PASSPHRASE = process.env.PASSPHRASE || "";
const BOARD_FILE = process.env.BOARD_FILE || path.join(__dirname, "data", "board.json");
const SEED_FILE = path.join(__dirname, "data", "seed-board.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const INDEX_FILE = path.join(PUBLIC_DIR, "index.html");

if (!PASSPHRASE) {
  console.warn("WARNING: PASSPHRASE env var is not set — the API is running with NO passphrase check. Set PASSPHRASE before deploying.");
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkAuth(req) {
  if (!PASSPHRASE) return true; // no passphrase configured -> local/dev mode, allow
  const supplied = req.headers["x-passphrase"] || "";
  return timingSafeEqual(supplied, PASSPHRASE);
}

function ensureDataDir() {
  const dir = path.dirname(BOARD_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readBoard() {
  ensureDataDir();
  if (!fs.existsSync(BOARD_FILE)) {
    // First boot on a fresh disk: seed from the bundled starting data (real board
    // contents as of the migration) so the board isn't blank on first load.
    if (fs.existsSync(SEED_FILE)) {
      try {
        const seed = fs.readFileSync(SEED_FILE, "utf8");
        fs.writeFileSync(BOARD_FILE, seed);
        console.log("Seeded " + BOARD_FILE + " from " + SEED_FILE);
        return JSON.parse(seed);
      } catch (e) {
        console.error("Failed to seed board file:", e.message);
      }
    }
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(BOARD_FILE, "utf8"));
  } catch (e) {
    console.error("Failed to parse board file:", e.message);
    return null;
  }
}

function writeBoard(data) {
  ensureDataDir();
  const tmp = BOARD_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, BOARD_FILE);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req, maxBytes, cb) {
  let total = 0;
  const chunks = [];
  req.on("data", (chunk) => {
    total += chunk.length;
    if (total > maxBytes) {
      req.destroy();
      cb(new Error("payload too large"));
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => cb(null, Buffer.concat(chunks).toString("utf8")));
  req.on("error", (err) => cb(err));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/healthz") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/board") {
    if (!checkAuth(req)) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    if (req.method === "GET") {
      const data = readBoard();
      sendJson(res, 200, data || {});
      return;
    }

    if (req.method === "POST") {
      readBody(req, 2 * 1024 * 1024, (err, bodyText) => {
        if (err) {
          sendJson(res, 413, { error: "payload too large" });
          return;
        }
        let data;
        try {
          data = JSON.parse(bodyText || "{}");
        } catch (e) {
          sendJson(res, 400, { error: "invalid json" });
          return;
        }
        try {
          writeBoard(data);
        } catch (e) {
          console.error("Failed to write board file:", e.message);
          sendJson(res, 500, { error: "write failed" });
          return;
        }
        sendJson(res, 200, data);
      });
      return;
    }

    res.writeHead(405, { "Allow": "GET, POST" });
    res.end();
    return;
  }

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    fs.readFile(INDEX_FILE, (err, buf) => {
      if (err) {
        res.writeHead(500);
        res.end("Board page missing");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(buf);
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log("Paint Masters Ops Board listening on port " + PORT);
  console.log("Board data file: " + BOARD_FILE);
});
