#!/usr/bin/env node
/**
 * Capture screenshots via Microlink API (no browser install needed).
 *
 * Free tier: ~1,500 requests/month.
 * Falls back gracefully on rate limits — just re-run for remaining URLs.
 *
 * Usage:
 *   node scripts/capture_microlink.js
 *   node scripts/capture_microlink.js --limit 10
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const URLS_FILE = path.join(__dirname, "urls.json");
const OUTPUT_DIR = path.join(__dirname, "..", "public", "designs");
const METADATA_PATH = path.join(__dirname, "..", "data", "design_metadata.json");

const VIEWPORT_WIDTH = 1440;
const VIEWPORT_HEIGHT = 900;

// Microlink free tier: be polite, 1 request per 3 seconds
const DELAY_MS = 3000;

function slugify(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[\/\?#:]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-$/, "")
    .toLowerCase()
    .slice(0, 80);
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`));
        }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (url) => {
      https.get(url, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          request(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      }).on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    request(url);
  });
}

async function captureOne(entry) {
  const id = slugify(entry.url);
  const outputPath = path.join(OUTPUT_DIR, `${id}.png`);

  if (fs.existsSync(outputPath)) {
    console.log(`  SKIP ${id}`);
    return { id, status: "skipped", entry };
  }

  const apiUrl =
    `https://api.microlink.io?url=${encodeURIComponent(entry.url)}` +
    `&screenshot=true` +
    `&viewport.width=${VIEWPORT_WIDTH}` +
    `&viewport.height=${VIEWPORT_HEIGHT}` +
    `&viewport.deviceScaleFactor=2` +
    `&waitUntil=networkidle0` +
    `&overlay.browser=none`;

  try {
    const data = await fetchJSON(apiUrl);

    if (data.status === "fail") {
      console.log(`  FAIL ${id} — ${data.message || "API error"}`);
      return { id, status: "failed", error: data.message, entry };
    }

    const screenshotUrl = data.data?.screenshot?.url;
    if (!screenshotUrl) {
      console.log(`  FAIL ${id} — no screenshot URL in response`);
      return { id, status: "failed", error: "no screenshot", entry };
    }

    await downloadFile(screenshotUrl, outputPath);
    console.log(`  OK   ${id}`);
    return { id, status: "ok", entry };
  } catch (err) {
    console.log(`  FAIL ${id} — ${err.message.slice(0, 80)}`);
    return { id, status: "failed", error: err.message, entry };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  console.log(`\nMicrolink Screenshot Capture`);
  console.log(`  Viewport: ${VIEWPORT_WIDTH}×${VIEWPORT_HEIGHT} @2x`);
  console.log(`  Output: ${OUTPUT_DIR}\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(METADATA_PATH), { recursive: true });

  const urls = JSON.parse(fs.readFileSync(URLS_FILE, "utf-8"));
  const toCapture = urls.slice(0, limit);

  console.log(`Capturing ${toCapture.length} URLs...\n`);

  const results = [];
  for (const entry of toCapture) {
    const result = await captureOne(entry);
    results.push(result);

    // Rate limit
    if (result.status !== "skipped") {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // Write metadata
  const metadata = results
    .filter((r) => r.status === "ok" || r.status === "skipped")
    .map((r) => ({
      id: r.id,
      url: r.entry.url,
      category: r.entry.category,
      region: r.entry.region,
      format: r.entry.format,
      tags: r.entry.tags,
      filename: `${r.id}.png`,
    }));

  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));

  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;

  console.log(`\n--- Summary ---`);
  console.log(`  Captured: ${ok}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Metadata: ${METADATA_PATH}`);

  if (failed > 0) {
    console.log(`\nRe-run to retry failed URLs (captured ones will be skipped).`);
  }

  console.log(`\nNext steps:`);
  console.log(`  1. Review screenshots in ${OUTPUT_DIR}`);
  console.log(`  2. python scripts/embed_designs.py`);
  console.log(`  3. python scripts/compute_taste_axes.py`);
}

main().catch(console.error);
