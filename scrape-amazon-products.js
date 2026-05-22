'use strict';

/**
 * scrape-amazon-products.js
 *
 * Low-volume Amazon product page fetcher for personal product comparison.
 *
 * Usage:
 *   node scrape-amazon-products.js [url1] [url2] ...
 *   (with no args, the PRODUCT_URLS list below is used)
 *
 * Behaviour: one URL at a time, a fresh browser context per request, a random
 * 3-8s pause between requests, and an IMMEDIATE halt (no retry) the moment a
 * 503 / CAPTCHA / timeout is seen.
 */

const { chromium } = require('playwright');
const utils = require('./amazon-scraper-utils');

// Replace these with the product URLs you want to compare, or pass URLs as
// command-line arguments (CLI args take precedence over this list).
const PRODUCT_URLS = [
  // 'https://www.amazon.com/dp/B0EXAMPLE1',
  // 'https://www.amazon.com/dp/B0EXAMPLE2',
];

// networkidle on a heavy site can legitimately take a while; if it exceeds
// this, we treat it as a block signal and stop (per spec).
const NAV_TIMEOUT_MS = 60000;

function printStartupWarning() {
  const line = '='.repeat(74);
  console.log(`
${line}
  ***  READ THIS BEFORE RUNNING  ***
${line}
  1. Turn your VPN ON. Without it, requests originate from your real IP.
  2. Log OUT of Amazon in every normal/headed browser on this machine, so
     this activity is never associated with your Amazon account.
  3. This is for occasional personal product comparison only. Automated
     access to Amazon is restricted by their Conditions of Use - for any
     real volume, use the official Product Advertising API instead.
  4. This script STOPS on the first 503 / CAPTCHA / timeout. Do not "fix"
     that by retrying - back off and try again much later.
${line}
`);
}

/** Log a STOP reason and exit immediately, without retrying. */
async function halt(reason, browser) {
  utils.log(`STOP - ${reason}`, 'STOP');
  utils.log('Halting immediately. No retry will be attempted.', 'STOP');
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* ignore close errors during shutdown */
    }
  }
  process.exit(1);
}

/**
 * Click every collapsed accordion expander on the page so that sections like
 * "Item details" and "Materials & Care" are visible in the DOM before extraction.
 */
async function expandAllSections(page) {
  const expanderTriggers = page.locator('a.a-expander-header, span.a-expander-header');
  const count = await expanderTriggers.count();
  if (count === 0) return;

  utils.log(`  Expanding ${count} accordion section(s)...`);

  for (let i = 0; i < count; i++) {
    try {
      const trigger = expanderTriggers.nth(i);
      const isCollapsed = await trigger.evaluate((el) => {
        const content = el.closest('.a-expander-container, .a-expander-section-container')
          ?.querySelector('[data-expanded]');
        return content ? content.getAttribute('data-expanded') === 'false' : false;
      });
      if (!isCollapsed) continue;

      await trigger.scrollIntoViewIfNeeded();
      await trigger.click({ force: true });
      await page.waitForTimeout(400);
    } catch {
      // If a single expander fails (hidden, detached, etc.) just skip it.
    }
  }
}

/** Collapse excess whitespace in an extracted text field. */
function normalizeText(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return trimmed || null;
}

/** Fetch a single URL, extract structured product data, and save as JSON. */
async function fetchOne(browser, url, index, total) {
  utils.log(`(${index + 1}/${total}) Fetching: ${url}`);

  const userAgent = utils.getRandomUserAgent();
  const viewport = utils.getRandomViewport();
  utils.log(`Context: UA="${userAgent}" viewport=${viewport.width}x${viewport.height}`);

  const context = await browser.newContext({
    userAgent,
    viewport,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: utils.getRealisticHeaders(userAgent),
  });
  await context.addInitScript(utils.STEALTH_INIT_SCRIPT);

  const page = await context.newPage();

  let response;
  try {
    response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: NAV_TIMEOUT_MS,
    });
  } catch (err) {
    await context.close();
    await halt(`Navigation failed / timed out - ${url}: ${err.message}`, browser);
    return;
  }

  const status = response ? response.status() : 0;

  const blockReason = utils.detectBlock(status, await page.content());
  if (blockReason) {
    await context.close();
    await halt(`${blockReason} - ${url}`, browser);
    return;
  }

  // Expand all collapsed accordion sections before extraction so their text
  // is present in the DOM (Item details, Materials & Care, etc.).
  await expandAllSections(page);

  // Extract only product-relevant text from known DOM sections.
  // innerText gives clean readable text — no HTML tags, no JS, no attributes.
  const raw = await page.evaluate(() => {
    function getText(selector) {
      const el = document.querySelector(selector);
      return el ? el.innerText.trim() : null;
    }
    function firstOf(...selectors) {
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el) {
          const t = el.innerText.trim();
          if (t) return t;
        }
      }
      return null;
    }

    return {
      url:       window.location.href,
      asin:      (window.location.href.match(/\/dp\/([A-Z0-9]{10})/i) || [])[1] || null,
      scrapedAt: new Date().toISOString(),

      // ── Product information ─────────────────────────────────────────────────

      // Main product title
      title: firstOf('#productTitle', '#title'),

      // "About this item" bullet points — primary feature list
      featureBullets: getText('#featurebullets_feature_div'),

      // "Product Description" long-form text section
      productDescription: getText('#productDescription_feature_div'),

      // A+ Enhanced Brand Content — rich multi-paragraph descriptions,
      // materials, use-case info provided by the brand
      aplusContent: firstOf('#aplus_feature_div', '#aplusContent_feature_div'),

      // "From the manufacturer" — second A+ block when present
      fromManufacturer: firstOf(
        '#aplus3pContent_feature_div',
        '#dpx-aplus-3p-middle_feature_div',
        '#dpx-aplus-3p-bottom_feature_div'
      ),

      // ── Product specifications ──────────────────────────────────────────────

      // Main specs table: dimensions, weight, materials, ASIN, etc.
      productDetails: getText('#productDetails_feature_div'),

      // Bullet-style spec list (appears on some categories instead of a table)
      detailBullets: getText('#detailBulletsWrapper_feature_div'),

      // Technical specifications table (electronics / complex products)
      technicalSpecs: getText('#technicalSpecifications_feature_div'),

      // ── Colour / size / style variants ─────────────────────────────────────
      variations: getText('#twister_feature_div'),

      // ── Ratings & reviews summary ───────────────────────────────────────────
      // Captures overall star rating AND total review count in one block
      ratingSummary: getText('#averageCustomerReviews_feature_div'),

      // ── Buy box: price, Prime badge, delivery date ──────────────────────────
      // The buy box is the single most reliable source for Prime status,
      // estimated delivery dates, and availability together
      buybox: getText('#buybox'),

      // Availability text ("In Stock", "Only 3 left", "Usually dispatched...")
      availability: firstOf('#availability_feature_div', '#availability'),

      // Prime eligibility section — empty if page was not scraped from the
      // correct region (UK/US). Re-scrape from the right IP to populate this.
      prime: getText('#apEligibility_feature_div'),

      // Standalone delivery date message (supplements buybox when present)
      deliveryMessage: firstOf(
        '#ddmDeliveryMessage_feature_div',
        '#deliveryBlockMessage_feature_div',
        '#mir-layout-DELIVERY_BLOCK_feature_div'
      ),
    };
  });

  // Normalise whitespace in every string field.
  const productData = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, normalizeText(v)])
  );

  const savedPath = utils.saveJson(productData, url);

  const fieldCount = Object.values(productData).filter(
    (v) => v !== null && typeof v === 'string'
  ).length;
  utils.log(
    `Saved JSON (HTTP ${status}, ${fieldCount} fields populated) -> ${savedPath}`
  );

  await context.close();
}

async function main() {
  printStartupWarning();

  const cliUrls = process.argv.slice(2);
  const urls = cliUrls.length > 0 ? cliUrls : PRODUCT_URLS;

  if (urls.length === 0) {
    utils.log(
      'No product URLs provided. Add URLs to PRODUCT_URLS or pass them as CLI args.',
      'WARN'
    );
    process.exit(0);
  }

  utils.log(`Starting run - ${urls.length} URL(s) queued.`);
  utils.ensureProductDataDir();

  const browser = await chromium.launch(utils.getLaunchOptions());

  try {
    for (let i = 0; i < urls.length; i++) {
      // Random 3-8s pause between requests (not before the first).
      if (i > 0) {
        const delay = utils.getRandomDelayMs();
        utils.log(`Waiting ${(delay / 1000).toFixed(1)}s before next request...`);
        await utils.sleep(delay);
      }
      await fetchOne(browser, urls[i], i, urls.length);
    }
    utils.log(`Done - ${urls.length} product(s) saved to ${utils.PRODUCT_DATA_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  utils.log(`Fatal error: ${err && err.stack ? err.stack : err}`, 'ERROR');
  process.exit(1);
});
