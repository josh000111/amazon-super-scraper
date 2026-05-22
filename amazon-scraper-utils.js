'use strict';

/**
 * amazon-scraper-utils.js
 *
 * Reusable utilities for low-volume, single-threaded Amazon product page
 * fetching with Playwright. Intended for occasional personal product/price
 * comparison.
 *
 * NOTE: Automated access to Amazon is restricted by their Conditions of Use.
 * This toolkit is intentionally low-impact (long delays, no retries, halts on
 * the first block signal). For anything beyond occasional personal use, prefer
 * the official Amazon Product Advertising API.
 */

const fs = require('fs');
const path = require('path');

// --- Configuration ---------------------------------------------------------

const SCRAPED_DATA_DIR  = path.join(__dirname, 'scraped_data');
const PRODUCT_DATA_DIR  = path.join(__dirname, 'product_data');

const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 8000;

// Realistic, recent Mac + Chrome user agent strings.
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
];

// Common macOS desktop viewport sizes, used as jitter bases.
const VIEWPORT_BASES = [
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1280, height: 800 },
  { width: 1680, height: 1050 },
];

// Chromium flags that suppress the most obvious automation signals.
const LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-component-update',
];

// Markers (lower-cased) that indicate a CAPTCHA / bot-check interstitial.
const CAPTCHA_MARKERS = [
  'enter the characters you see below',
  'type the characters you see in this image',
  "we just need to make sure you're not a robot",
  'to discuss automated access to amazon data',
  'api-services-support@amazon.com',
  'errors/validatecaptcha',
  'validatecaptcha',
  'opfcaptcha-prod',
  '<title>robot check</title>',
];

// --- Random helpers --------------------------------------------------------

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** A random user agent from the Mac/Chrome pool. */
function getRandomUserAgent() {
  return pickRandom(USER_AGENTS);
}

/** Random inter-request delay in milliseconds (3-8s by default). */
function getRandomDelayMs(min = MIN_DELAY_MS, max = MAX_DELAY_MS) {
  return randomInt(min, max);
}

/** Promise that resolves after `ms` milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A viewport based on a real Mac size, jittered slightly per call. */
function getRandomViewport() {
  const base = pickRandom(VIEWPORT_BASES);
  return {
    width: base.width + randomInt(-40, 40),
    height: base.height + randomInt(-30, 30),
  };
}

// --- Browser fingerprint helpers ------------------------------------------

/** Extract the Chrome major version from a UA string. */
function chromeMajorVersion(userAgent) {
  const m = userAgent.match(/Chrome\/(\d+)/);
  return m ? m[1] : '131';
}

/**
 * Realistic HTTP headers that mimic a real Chrome-on-macOS request. The
 * client-hint values are derived from the chosen user agent so they stay
 * internally consistent.
 */
function getRealisticHeaders(userAgent) {
  const v = chromeMajorVersion(userAgent);
  return {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': `"Chromium";v="${v}", "Google Chrome";v="${v}", "Not_A Brand";v="24"`,
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
}

/**
 * Small init script that smooths over a few remaining automation tells.
 * Runs in every page before site scripts. Kept deliberately minimal.
 */
const STEALTH_INIT_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  window.chrome = window.chrome || { runtime: {} };
`;

/** Full options object for chromium.launch(). */
function getLaunchOptions() {
  return {
    headless: true,
    args: LAUNCH_ARGS,
    ignoreDefaultArgs: ['--enable-automation'],
  };
}

// --- Logging ---------------------------------------------------------------

function timestamp() {
  return new Date().toISOString();
}

/** Timestamped console log. Levels: INFO, WARN, ERROR, STOP. */
function log(message, level = 'INFO') {
  const line = `[${timestamp()}] [${level}] ${message}`;
  if (level === 'STOP' || level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

// --- Persistence -----------------------------------------------------------

/** Create scraped_data/ if it does not already exist. */
function ensureDataDir() {
  if (!fs.existsSync(SCRAPED_DATA_DIR)) {
    fs.mkdirSync(SCRAPED_DATA_DIR, { recursive: true });
  }
}

/** Create product_data/ if it does not already exist. */
function ensureProductDataDir() {
  if (!fs.existsSync(PRODUCT_DATA_DIR)) {
    fs.mkdirSync(PRODUCT_DATA_DIR, { recursive: true });
  }
}

/** Build a filesystem-safe slug from an Amazon URL (prefers the ASIN). */
function slugFromUrl(url) {
  const asin = url.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i);
  if (asin) return `asin-${asin[1]}`;
  try {
    const u = new URL(url);
    const seg = u.pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
    return (seg || u.hostname).slice(0, 60);
  } catch {
    return 'page';
  }
}

/**
 * Save raw HTML to scraped_data/ with a timestamped filename.
 * Returns the absolute path written.
 */
function saveHtml(html, url) {
  ensureDataDir();
  const stamp = timestamp().replace(/[:.]/g, '-');
  const file = path.join(SCRAPED_DATA_DIR, `${stamp}__${slugFromUrl(url)}.html`);
  fs.writeFileSync(file, html, 'utf8');
  return file;
}

/**
 * Save extracted product data JSON to product_data/ with a timestamped filename.
 * Returns the absolute path written.
 */
function saveJson(data, url) {
  ensureProductDataDir();
  const stamp = timestamp().replace(/[:.]/g, '-');
  const file = path.join(PRODUCT_DATA_DIR, `${stamp}__${slugFromUrl(url)}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  return file;
}

// --- Block / CAPTCHA detection --------------------------------------------

/**
 * Inspect an HTTP status + page HTML for block signals.
 * Returns a human-readable reason string, or null if the page looks clean.
 */
function detectBlock(status, html) {
  if (status === 503) return 'HTTP 503 - Service Unavailable (rate limited / blocked)';
  if (status === 429) return 'HTTP 429 - Too Many Requests (rate limited)';
  if (status === 403) return 'HTTP 403 - Forbidden (access blocked)';
  if (status >= 500) return `HTTP ${status} - server error`;

  const haystack = (html || '').toLowerCase();
  for (const marker of CAPTCHA_MARKERS) {
    if (haystack.includes(marker)) {
      return `CAPTCHA / bot-check page detected (marker: "${marker}")`;
    }
  }
  return null;
}

module.exports = {
  SCRAPED_DATA_DIR,
  PRODUCT_DATA_DIR,
  MIN_DELAY_MS,
  MAX_DELAY_MS,
  USER_AGENTS,
  LAUNCH_ARGS,
  STEALTH_INIT_SCRIPT,
  getRandomUserAgent,
  getRandomDelayMs,
  sleep,
  getRandomViewport,
  getRealisticHeaders,
  getLaunchOptions,
  log,
  ensureDataDir,
  ensureProductDataDir,
  slugFromUrl,
  saveHtml,
  saveJson,
  detectBlock,
};
