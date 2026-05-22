'use strict';

/**
 * prepare-html.js
 *
 * Pre-processing step for the data-extraction stage. Reads every raw HTML file
 * in scraped_data/, removes non-product noise and writes a leaner copy to
 * cleaned_data/.
 *
 * What is preserved:
 *   - Product title, description, bullet features, specifications
 *   - Available colour / variant selectors (twister)
 *   - Aggregate rating summary (overall star count, histogram)
 *   - Amazon Prime eligibility (if present in scraped HTML)
 *   - Delivery date / availability info
 *   - Price and buying options
 *
 * What is removed:
 *   - All images, video, audio, canvas, noscript
 *   - All data-* attributes
 *   - Header / navigation bars and skip-links
 *   - Breadcrumb navigation
 *   - Footer links and info
 *   - Cookie / consent banners
 *   - Individual customer review text
 *   - "No featured offers" / out-of-stock / geo-dispatch panels
 *   - "Other sellers" / All Offers Display panel
 *   - Recommended / similar / "Customers also viewed" products
 *   - "Similar item to consider" / value pick widget
 *   - "Brand in this category on Amazon" carousel
 *   - Sponsored product ads and promotions
 *   - Brand story and A+ carousel sections
 *   - "Would you like to tell us about a lower price?" form
 *   - Product Summary / Quick View overlay (duplicate content)
 *   - Seller feedback, report issue, trade-in UI
 *   - "Brief/Full content visible, double tap to read" accessibility text
 *   - Leftover JSON blobs from stripped scripts
 *   - Excess blank lines
 *
 * NOTE on Amazon Prime: Prime eligibility is stored in apEligibility_feature_div.
 * That section is preserved. If it appears empty, the page was scraped from a
 * non-UK IP address and Amazon did not render Prime info for that location.
 * Re-scrape with a UK IP / UK delivery address to capture Prime eligibility.
 *
 * Usage:  node prepare-html.js
 */

const fs      = require('fs');
const path    = require('path');
const cheerio = require('cheerio');
const { log, SCRAPED_DATA_DIR } = require('./amazon-scraper-utils');

const CLEANED_DATA_DIR = path.join(__dirname, 'cleaned_data');

// ---------------------------------------------------------------------------
// Sections removed by a string-walking pass BEFORE cheerio.
// Used for elements that are too deep in Amazon's DOM for cheerio to reach.
// Each entry is either:
//   { id: "..." }          — remove the block whose opening tag has id="..."
//   { text: "..." }        — remove the block that contains this text string
// ---------------------------------------------------------------------------
const DEEP_REMOVE = [
  // ── "Other sellers" / All Offers Display panel ───────────────────────────
  { id: 'aod-background' },

  // ── "Would you like to tell us about a lower price?" form + Share widget ──
  { id: 'pricingFeedbackDiv' },

  // ── Product Summary / Quick View overlay (duplicate of product content) ───
  { id: 'productQuickView_feature_div' },
  { id: 'a-popover-pqvOverlay' },

  // ── "Similar item to consider" widget (competitor product) ────────────────
  { id: 'valuePick_feature_div' },

  // ── Sponsored products carousels ─────────────────────────────────────────
  { id: 'sponsoredProducts2_feature_div' },
  { id: 'sponsoredProducts2-2_feature_div' },

  // ── "Brand in this category on Amazon" carousel (no id, text-matched) ────
  { text: 'Brand in this category on Amazon' },

  // ── A+ premium carousel (Garden Living Collection etc.) ──────────────────
  { id: 'lawn_and_garden_display_on_website' },
  { id: 'session-similarities-non-behavioral-features' },
  { id: 'aplus-premium-module-13-carousel' },
  { id: 'aplus_premium-module-13-carousel' },
  { id: 'dp_desktop_aplus_premium-module-13-carousel_div' },
  { id: 'p13n-desktop-carousel_DetailPage_0' },
];

// ---------------------------------------------------------------------------
// Exact element IDs to remove via cheerio CSS selector.
// ---------------------------------------------------------------------------
const REMOVE_IDS = [

  // ── Header / navigation / skip-links ────────────────────────────────────
  'nav-belt',
  'nav-bar-left',
  'nav-cart',
  'nav-fill-search',
  'nav-belt-search',
  'GLOW-desktop-nav',
  'Navigation-desktop-navbar',
  'HamburgerMenuDesktop',
  'icp-nav-flyout',
  'btfSubNavDesktop',
  'btfSubNavDesktopCopy',
  'btfSubNavDesktop_feature_div',
  'navbar-main',
  'shortcut-menu',
  'pqv-hidden-ingress',
  'nav-top',

  // ── Breadcrumb navigation ─────────────────────────────────────────────────
  'desktop-breadcrumbs_feature_div',
  'wayfinding-breadcrumbs_feature_div',

  // ── Footer ───────────────────────────────────────────────────────────────
  'navFooter',
  'footer',

  // ── Images / media sections ───────────────────────────────────────────────
  'imageBlock_feature_div',
  'mediaBlock_feature_div',
  'mediaBlockVariations_feature_div',

  // ── Individual customer reviews ───────────────────────────────────────────
  'cm-cr-dp-review-list',
  'cm-cr-global-review-list',
  'cr-top-reviews',
  'CustomerTopReviewsCards',
  'crReviewRow',
  'customer-reviews_feature_div',
  'dp_desktop_customerReviews_feature_div',
  'dp_desktop_customerReviews-media_feature_div',
  'arp-images-in-review',
  'customerReviewsAttributeThirdColumnATF_feature_div',
  'customerReviewsAttribute_feature_div',

  // ── "No featured offers" / out-of-stock / geo-redirect panels ────────────
  'outOfStock',
  'fodcx_feature_div',
  'fod-cx-box',
  'exportAlternativeContentTitle',
  'exportAlternativeContent',
  'outOfStockBuyBox_feature_div',

  // ── Similar / recommended / "customers also viewed" ──────────────────────
  'DetailPage_sims-container_desktop-dp-sims_1_container',
  'DetailPage_sims-container_desktop-dp-sims_2_container',
  'HLCXComparisonJumplink_feature_div',
  'HLCXComparisonWidgetTechnical-2-T2',
  'recommendations_feature_div',
  'rhf',

  // ── Advertisements / promotions ───────────────────────────────────────────
  'dp-ads-center-promo-dramabot',
  'dp-ads-center-promo-dramabot_feature_div',
  'dp-ads-center-promo-top-dramabot',
  'dp-ads-center-promo-top-dramabot_feature_div',
  'heroQuickPromo',
  'heroQuickPromoContainer',
  'heroQuickPromo_feature_div',
  'cos-banner',
  'iesABBanner-ww',
  'iesABBanner_feature_div',
  'amsDetailRight-dramabot',
  'amsDetailRight-dramabot_feature_div',
  'ad-endcap-1-dramabot_feature_div',
  'product-ads-feedback_feature_div',
  'multi-brand-video-desktop_DetailPage_0',

  // ── Brand story / other brand product carousels ───────────────────────────
  'aplusBrandStory_feature_div',
  'aplus_brand-story-carousel',
  'apm-brand-story-carousel',
  'dp_desktop_aplus_horizontal_brand-story-carousel',

  // ── Trade-in / seller / wishlist / reporting UI ───────────────────────────
  'tellAmazon_feature_div',
  'ask_feature_div',
  'sellYoursHere_feature_div',
  'olp_feature_div',
  'olpLinkWidget_feature_div',
  'socialProofingAsinFaceout_feature_div',
  'socialProofingBadge_feature_div',
  'atwl-dd-unavail-holder',
  'productQuickViewAtf_feature_div',
];

// Remove all elements whose id starts with one of these prefixes.
const REMOVE_ID_PREFIXES = [
  'nav-flyout-',
  'nav-assist-',
  'nav-al-',
  'btf-sub-nav-',
  'aplus-brand-story-',
  'aplus_brand-story-',
  'dp_desktop_aplus_brand-story-',
  'tell-amazon-desktop_',
  'sp-cc',
  'a-popover-pqv',               // Product Quick View popovers
  'unifiedTradeInCard-',          // Trade-in / "Sign in to continue" widgets
  'a-popover-cr-review-media-popover-',
];

// Remove all elements whose id contains one of these substrings.
const REMOVE_ID_SUBSTRINGS = [
  'cookie',
  'Cookie',
  'consent',
  'gdpr',
  'brand-story',
  '-dramabot',
];

// HTML tags to strip entirely (all children removed too).
const REMOVE_TAGS = [
  'img',
  'picture',
  'video',
  'audio',
  'noscript',
  'canvas',
  'map',
  'area',
  'form',
];

// ---------------------------------------------------------------------------
// Regex strip passes — applied after DOM removal.
// ---------------------------------------------------------------------------
const STRIP_PASSES = [
  { label: 'HTML comments',
    re: /<!--[\s\S]*?-->/g, to: '' },
  { label: 'script blocks',
    re: /<script\b[^>]*>[\s\S]*?<\/script>/gi, to: '' },
  { label: 'style blocks',
    re: /<style\b[^>]*>[\s\S]*?<\/style>/gi, to: '' },
  { label: 'svg blocks',
    re: /<svg\b[^>]*>[\s\S]*?<\/svg>/gi, to: '' },
  { label: 'iframe blocks',
    re: /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, to: '' },
  { label: 'link tags',
    re: /<link\b[^>]*>/gi, to: '' },
  // Strip all data-* attributes — obfuscated JSON blobs with no product value.
  { label: 'data-* attributes',
    re: /\s+data-[a-zA-Z0-9_-]+=(?:"[^"]*"|'[^']*'|\S+)/g, to: '' },
  { label: 'inline style attrs',
    re: /\sstyle=("[^"]*"|'[^']*')/gi, to: '' },
  // Strip "double tap" mobile accessibility text left in colour/variant selectors.
  { label: 'double-tap a11y text',
    re: /\s*(?:Brief|Full) content visible,?\s*double tap to read (?:brief|full) content\.?\s*/gi, to: ' ' },
  // Strip leftover JSON blobs exposed after script-tag stripping.
  { label: 'JSON price blobs',
    re: /\{(?:&quot;|")desktop_buybox_group[\s\S]{0,6000}?\}(?=\s*<)/g, to: '' },
];

// ---------------------------------------------------------------------------
// String-walking block removal (handles deeply-nested sections cheerio misses)
// ---------------------------------------------------------------------------

/**
 * Find the opening angle bracket of whatever tag contains `searchStr`.
 * Walks at most `maxLookback` characters before `searchPos`.
 */
function findBlockStart(html, searchPos, maxLookback) {
  const scanFrom = Math.max(0, searchPos - maxLookback);
  const chunk = html.slice(scanFrom, searchPos);
  const lastAngle = chunk.lastIndexOf('<');
  if (lastAngle === -1) return -1;
  return scanFrom + lastAngle;
}

/**
 * Given the position of an opening '<', extract the tag name and remove the
 * entire matching block (open tag through balanced closing tag) from html.
 * Returns the modified string, or the original if the block can't be removed.
 */
function exciseBlock(html, openAngle) {
  let nameEnd = openAngle + 1;
  while (nameEnd < html.length && !/[\s>\/]/.test(html[nameEnd])) nameEnd++;
  const tag = html.slice(openAngle + 1, nameEnd).toLowerCase();
  if (!tag || !/^[a-z]/.test(tag)) return html;

  const voidTags = new Set(['br','hr','input','meta','link','img','area','base',
                             'col','embed','param','source','track','wbr']);
  if (voidTags.has(tag)) {
    const end = html.indexOf('>', openAngle);
    return end === -1 ? html : html.slice(0, openAngle) + html.slice(end + 1);
  }

  const openStr  = `<${tag}`;
  const closeStr = `</${tag}>`;
  let depth = 0;
  let pos   = openAngle;

  while (pos < html.length) {
    const nextOpen  = html.indexOf(openStr,  pos);
    const nextClose = html.indexOf(closeStr, pos);
    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      const c = html[nextOpen + openStr.length];
      if (!c || /[\s>\/]/.test(c)) depth++;
      pos = nextOpen + 1;
    } else {
      depth--;
      pos = nextClose + 1;
      if (depth === 0) {
        return html.slice(0, openAngle) + html.slice(nextClose + closeStr.length);
      }
    }
  }
  return html;
}

function removeBlockById(html, targetId) {
  const marker = `id="${targetId}"`;
  const markerPos = html.indexOf(marker);
  if (markerPos === -1) return html;
  const openAngle = html.lastIndexOf('<', markerPos);
  if (openAngle === -1) return html;
  return exciseBlock(html, openAngle);
}

function removeBlockByText(html, searchText) {
  const markerPos = html.indexOf(searchText);
  if (markerPos === -1) return html;
  // Walk back up to 2000 chars to find a parent block-level element.
  const scanFrom = Math.max(0, markerPos - 2000);
  const chunk = html.slice(scanFrom, markerPos);
  // Find the last div/section/article opening in that window.
  let bestPos = -1;
  for (const tag of ['section', 'article', 'aside', 'div']) {
    const idx = chunk.lastIndexOf(`<${tag}`);
    if (idx > bestPos) bestPos = idx;
  }
  if (bestPos === -1) return html;
  return exciseBlock(html, scanFrom + bestPos);
}

function deepRemovePass(html) {
  let out = html;
  for (const entry of DEEP_REMOVE) {
    if (entry.id)   out = removeBlockById(out, entry.id);
    if (entry.text) out = removeBlockByText(out, entry.text);
  }
  return out;
}

// ---------------------------------------------------------------------------

/** Escape CSS selector special chars in an id string. */
function escId(id) {
  return id.replace(/([#.[\]{}()*+?^$|\\,])/g, '\\$1');
}

function domClean(html) {
  // 1. Deep string-walk removal (sections cheerio can't reach by CSS selector).
  let out = deepRemovePass(html);

  const $ = cheerio.load(out, { decodeEntities: false });

  // 2. Exact ID removal.
  for (const id of REMOVE_IDS) {
    $(`#${escId(id)}`).remove();
  }

  // 3. ID prefix removal.
  for (const prefix of REMOVE_ID_PREFIXES) {
    $(`[id^="${prefix}"]`).remove();
  }

  // 4. ID substring removal.
  for (const sub of REMOVE_ID_SUBSTRINGS) {
    $(`[id*="${sub}"]`).remove();
  }

  // 5. cel_widget_id-based removal (Amazon's alternate widget identifier).
  const celRemove = [
    'multi-brand-video', 'similarities', 'sims-',
    'aplus-premium-module', 'p13n-desktop-carousel',
    'valuePick', 'lifestyle-image', 'sponsored',
  ];
  for (const pat of celRemove) {
    $(`[cel_widget_id*="${pat}"]`).remove();
  }

  // 6. Remove specific HTML tags entirely.
  for (const tag of REMOVE_TAGS) {
    $(tag).remove();
  }

  return $.html();
}

function regexClean(html) {
  let out = html;
  for (const pass of STRIP_PASSES) {
    out = out.replace(pass.re, pass.to);
  }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function cleanHtml(html) {
  return regexClean(domClean(html));
}

// ---------------------------------------------------------------------------

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function percentDrop(before, after) {
  return before > 0 ? (100 * (1 - after / before)).toFixed(1) : '0.0';
}

function main() {
  if (!fs.existsSync(SCRAPED_DATA_DIR)) {
    log(`No scraped_data/ folder found at ${SCRAPED_DATA_DIR}. Nothing to do.`, 'WARN');
    process.exit(0);
  }

  const files = fs
    .readdirSync(SCRAPED_DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith('.html'))
    .sort();

  if (files.length === 0) {
    log('scraped_data/ contains no .html files. Nothing to do.', 'WARN');
    process.exit(0);
  }

  if (!fs.existsSync(CLEANED_DATA_DIR)) {
    fs.mkdirSync(CLEANED_DATA_DIR, { recursive: true });
  }

  log(`Cleaning ${files.length} HTML file(s): scraped_data/ -> cleaned_data/`);

  let totalBefore = 0;
  let totalAfter  = 0;
  let processed   = 0;

  for (const file of files) {
    try {
      const raw     = fs.readFileSync(path.join(SCRAPED_DATA_DIR, file), 'utf8');
      const cleaned = cleanHtml(raw);

      const before = Buffer.byteLength(raw, 'utf8');
      const after  = Buffer.byteLength(cleaned, 'utf8');

      fs.writeFileSync(path.join(CLEANED_DATA_DIR, file), cleaned, 'utf8');

      totalBefore += before;
      totalAfter  += after;
      processed   += 1;
      log(`  ${file}: ${formatBytes(before)} -> ${formatBytes(after)} (-${percentDrop(before, after)}%)`);
    } catch (err) {
      log(`  ${file}: SKIPPED - ${err.message}`, 'ERROR');
    }
  }

  log(
    `Done - ${processed}/${files.length} file(s) cleaned: ` +
      `${formatBytes(totalBefore)} -> ${formatBytes(totalAfter)} ` +
      `(-${percentDrop(totalBefore, totalAfter)}% overall). Output: ${CLEANED_DATA_DIR}`
  );
}

main();
