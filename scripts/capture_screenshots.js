#!/usr/bin/env node
/**
 * Capture above-the-fold screenshots of curated design URLs using Playwright.
 *
 * Usage:
 *   npx playwright install chromium        # first time only
 *   node scripts/capture_screenshots.js
 *   node scripts/capture_screenshots.js --mobile         # mobile viewport
 *   node scripts/capture_screenshots.js --limit 10       # first 10 only
 *   node scripts/capture_screenshots.js --concurrency 8  # 8 parallel contexts (default 5)
 *
 * Reads URLs from scripts/urls.json
 * Saves screenshots to public/designs/
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const URLS_FILE = path.join(__dirname, "urls.json");
const OUTPUT_DIR = path.join(__dirname, "..", "public", "designs");

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

// Common cookie banner selectors to auto-dismiss
const COOKIE_SELECTORS = [
  '[id*="cookie"] button',
  '[class*="cookie"] button',
  '[id*="consent"] button',
  '[class*="consent"] button',
  '[aria-label*="cookie" i] button',
  '[aria-label*="accept" i]',
  'button:has-text("Accept")',
  'button:has-text("Accept all")',
  'button:has-text("Got it")',
  'button:has-text("OK")',
  'button:has-text("I agree")',
  'button:has-text("Allow")',
  'button:has-text("Close")',
];

async function dismissCookies(page) {
  for (const selector of COOKIE_SELECTORS) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click({ timeout: 1000 });
        await page.waitForTimeout(500);
        return true;
      }
    } catch {
      // selector didn't match, try next
    }
  }
  return false;
}

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

async function captureScreenshot(browser, entry, viewport, suffix, progress) {
  const id = slugify(entry.url) + (suffix ? `-${suffix}` : "");
  const outputPath = path.join(OUTPUT_DIR, `${id}.jpeg`);
  const label = `[${progress.current}/${progress.total}]`;

  // Skip if already captured
  if (fs.existsSync(outputPath)) {
    console.log(`${label} SKIP ${id} (already exists)`);
    return { id, status: "skipped", entry };
  }

  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2, // Retina-quality captures
    locale: "en-US",
    timezoneId: "America/New_York",
    bypassCSP: true,
  });

  const page = await context.newPage();

  // Block heavy resources that don't affect above-the-fold appearance
  await page.route("**/*.{mp4,webm,ogg,mp3,wav}", (route) => route.abort());

  try {
    await page.goto(entry.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for visual stability (minimum 2s per context, runs in parallel across batch)
    await page.waitForTimeout(2000);

    // Try to dismiss cookie banners
    await dismissCookies(page);

    // Wait a beat more for any animations to settle
    await page.waitForTimeout(1000);

    // Capture viewport screenshot (above the fold)
    await page.screenshot({
      path: outputPath,
      type: "jpeg",
      quality: 90,
      clip: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      },
    });

    console.log(`${label} OK   ${id}`);
    await context.close();
    return { id, status: "ok", entry };
  } catch (err) {
    console.log(`${label} FAIL ${id} — ${err.message.slice(0, 80)}`);
    await context.close();
    return { id, status: "failed", error: err.message, entry };
  }
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  const args = process.argv.slice(2);
  const isMobile = args.includes("--mobile");

  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  const concurrencyIdx = args.indexOf("--concurrency");
  const concurrency = concurrencyIdx !== -1 ? parseInt(args[concurrencyIdx + 1], 10) : 5;

  const viewport = isMobile ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;
  const suffix = isMobile ? "mobile" : "";

  console.log(`\nCapture settings:`);
  console.log(`  Viewport:    ${viewport.width}×${viewport.height}${isMobile ? " (mobile)" : " (desktop)"}`);
  console.log(`  Output:      ${OUTPUT_DIR}`);
  console.log(`  Scale:       2x (retina)`);
  console.log(`  Concurrency: ${concurrency}\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const urls = JSON.parse(fs.readFileSync(URLS_FILE, "utf-8"));
  const toCapture = urls.slice(0, limit);
  const total = toCapture.length;

  console.log(`Capturing ${total} URLs in batches of ${concurrency}...\n`);

  const browser = await chromium.launch({
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const batches = chunkArray(toCapture, concurrency);
  const results = [];
  let completed = 0;

  for (const batch of batches) {
    // Assign progress counters before launching — all N in the batch run simultaneously
    const batchWithProgress = batch.map((entry) => {
      completed += 1;
      return { entry, progress: { current: completed, total } };
    });

    const batchResults = await Promise.all(
      batchWithProgress.map(({ entry, progress }) =>
        captureScreenshot(browser, entry, viewport, suffix, progress)
      )
    );

    results.push(...batchResults);
  }

  await browser.close();

  // Write metadata for captured screenshots
  const metadata = results
    .filter((r) => r.status === "ok" || r.status === "skipped")
    .map((r) => ({
      id: r.id,
      url: r.entry.url,
      category: r.entry.category,
      region: r.entry.region,
      format: r.entry.format,
      tags: r.entry.tags,
      filename: `${r.id}.jpeg`,
    }));

  const metadataPath = path.join(__dirname, "..", "data", "design_metadata.json");
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // Summary
  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;

  console.log(`\n--- Summary ---`);
  console.log(`  Captured: ${ok}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Metadata: ${metadataPath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review screenshots in ${OUTPUT_DIR}`);
  console.log(`  2. Delete any that are broken/blank/low-quality`);
  console.log(`  3. Run: python scripts/embed_designs.py`);
  console.log(`  4. Run: python scripts/seed_database.py`);
}

main().catch(console.error);
