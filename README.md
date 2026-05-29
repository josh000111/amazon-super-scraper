# Amazon Super Scraper

Extract clean, structured product data from Amazon using your AI Agent. Drop in your Amazon product URLs, run one command, get a tidy JSON file per product and a ready-to-use product comparison spreadsheet. DOM-based scraper, no bloated HTML.

**Built-in anti-detection** — rotating user agents, stealth headers, jittered delays, and automated section expansion mean you can scrape quietly without tripping Amazon's bot systems.

---

## Why Amazon Super Scraper?

Most Amazon scrapers hand you a 1.5 MB wall of raw HTML and leave the rest to you. **Amazon Super Scraper skips the mess entirely.** It drives a real Chromium browser, reads the live page DOM exactly the way Google's and Anthropic's AI assistants do, and extracts only the text that matters — saving it as clean, labelled JSON that any script, spreadsheet, or LLM can read instantly.

### What sets it apart

| | Amazon Super Scraper | Typical HTML scrapers |
|---|---|---|
| **Output format** | Structured JSON — labelled fields, plain text | Raw HTML dump |
| **File size per product** | ~5–20 KB | ~1–2 MB |
| **Cleaning step needed** | None | Yes (often complex) |
| **Collapsible sections captured** | ✅ Auto-expands all accordions | ❌ Often missed |
| **A+ Brand Content captured** | ✅ Full text extracted | ❌ Usually skipped |
| **LLM / AI-agent ready** | ✅ Feed JSON directly | ❌ Requires preprocessing |
| **Anti-detection** | Rotating UAs, jittered viewports, stealth headers | Minimal |
| **On block / CAPTCHA** | Halts immediately, no retries | Often retries and gets banned faster |

---

## What it extracts

Every product is saved as a `.json` file with these fields:

| Field | Content |
|---|---|
| `title` | Product title |
| `featureBullets` | "About this item" bullet points |
| `productDescription` | Long-form product description |
| `aplusContent` | A+ Enhanced Brand Content (rich descriptions, materials, care) |
| `fromManufacturer` | "From the manufacturer" section |
| `productDetails` | Specs table (dimensions, weight, materials, ASIN, etc.) |
| `detailBullets` | Bullet-style specs (used on some categories) |
| `technicalSpecs` | Technical specifications table |
| `variations` | Available colours, sizes, and styles |
| `ratingSummary` | Overall star rating and total review count |
| `buybox` | Price, Prime badge, and delivery date together |
| `availability` | Stock status |
| `prime` | Prime eligibility |
| `deliveryMessage` | Estimated delivery date |

---

## Project structure

```
amazon-super-scraper/
├── scrape-amazon-products.js    # Main scraper — this is what you run
├── amazon-scraper-utils.js      # Shared config: delays, user agents, headers, stealth, logging
├── prepare-html.js              # Legacy HTML cleaner — no longer needed, ignore this
├── run_prompts/
│   ├── 1-SCRAPE_PROMPT_TEMPLATE.txt    # Paste into a new agent session to scrape URLs
│   └── 2-EXTRACT_PROMPT_TEMPLATE.txt   # Paste into a new agent session to build the spreadsheet
├── product_data/                # Output folder — one JSON per scraped product (gitignored)
├── package.json                 # Node.js dependencies
├── scraped_data/                # Legacy: raw HTML output (gitignored, unused)
└── cleaned_data/                # Legacy: cleaned HTML output (gitignored, unused)
```

---

## Dependencies

| Dependency | Purpose | Install |
|---|---|---|
| **Node.js 18+** | JavaScript runtime | [nodejs.org](https://nodejs.org/) |
| **Playwright** (npm package) | Drives the Chromium browser | `npm install` |
| **Chromium** (Playwright browser) | The actual browser the scraper uses | `npx playwright install chromium` |
| **cheerio** (npm package) | HTML parsing utility (bundled, not used by main scraper) | `npm install` |

> **Playwright CLI vs. Playwright library:** This project uses the **Playwright npm library**, driven by the Node.js script. There is no separate "Playwright CLI" command to install or run — `node scrape-amazon-products.js` is the only command you need. Your agent does not need to install the Playwright CLI separately.

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/Josh5983/amazon-super-scraper.git
cd amazon-super-scraper

# 2. Install Node.js dependencies
npm install

# 3. Install the Chromium browser that Playwright drives
npx playwright install chromium
```

That's it. No API keys, no accounts, no configuration files.

---

## Before every scraping run — required steps

**Do these every time before running the scraper, without exception:**

1. **Turn your VPN on** — without it, requests come from your real IP address.
2. **Match your VPN location to the Amazon store you are scraping** (see [VPN region guidance](#vpn-region-and-amazon-store-matching) below).
3. **Log out of Amazon** in every browser on the machine — scraping activity must never be linked to your Amazon account.

---

## VPN region and Amazon store matching

This is the most commonly overlooked setup step and it affects the accuracy of your scraped data significantly.

**The rule: your VPN exit country must match the Amazon store's country.**

| Scraping this store | Set your VPN to |
|---|---|
| amazon.co.uk | United Kingdom |
| amazon.de | Germany |
| amazon.it | Italy |
| amazon.fr | France |
| amazon.es | Spain |
| amazon.com | United States |
| amazon.com.au | Australia |

**Why this matters:**

- **Delivery availability** — if your VPN is set to USA and you scrape `amazon.it`, Amazon thinks you are in the USA. Italian products are not shipped to the USA, so every product will show "this product is not available for delivery to your country" — even if it is perfectly available to Italian customers.
- **Prime availability** — Amazon only shows Prime eligibility for your apparent location. A USA VPN scraping `amazon.it` will not show Prime badges because Italian Prime products are not Prime-eligible for US delivery.
- **Pricing** — some prices, VAT, and currency displays depend on the detected region.
- **The `prime` and `deliveryMessage` JSON fields will be empty** if the VPN location does not match the store. Check the `buybox` field as a fallback — it often still contains delivery estimates even when the standalone fields are empty.

**You are logged out of Amazon for the scraping session.** This means Amazon cannot use your account region to correct for a mismatched VPN. What it sees is purely your VPN exit IP.

---

## Using long URLs instead of short URLs

**Always use full Amazon product URLs.** Do not use short or redirect URLs (amzn.to, amzn.eu, tinyurl.com, bit.ly, etc.).

**Why:** Short URLs often show an interstitial "holding page" with either a countdown timer before auto-redirecting, or a manual "Continue to destination" button the user must click. The scraper cannot interact with these pages — it will time out or land on the wrong page entirely. When this happens, your agent may report that "these URLs are broken or deprecated" when in fact the URLs are valid but require a click-through the scraper cannot perform.

**How to get the full URL:**

- On Amazon, click into any product. The URL in your browser address bar is the full URL.
- Example of a correct full URL: `https://www.amazon.co.uk/dp/B0EXAMPLE1`
- Example of what **not** to use: `https://amzn.to/3xABCDE` or `https://amzn.eu/d/abcdefg`

If you only have a short URL, open it in a browser, let it redirect to the final Amazon product page, then copy the URL from the address bar.

---

## Usage — Manual (running the scraper yourself)

Use this approach if you want to run the scraper directly from your terminal without an AI agent.

### Step 1 — Prepare

Complete the [required pre-run steps](#before-every-scraping-run--required-steps) above (VPN on, correct region, logged out of Amazon).

### Step 2 — Run the scraper

Pass your Amazon product URLs as command-line arguments:

```bash
node scrape-amazon-products.js \
  "https://www.amazon.co.uk/dp/B0EXAMPLE1" \
  "https://www.amazon.co.uk/dp/B0EXAMPLE2" \
  "https://www.amazon.co.uk/dp/B0EXAMPLE3"
```

Alternatively, edit `scrape-amazon-products.js` and paste your URLs into the `PRODUCT_URLS` array at the top of the file, then run without arguments:

```bash
node scrape-amazon-products.js
```

The scraper processes one URL at a time, waits 3–8 seconds between requests, and saves each product to `product_data/` as `<timestamp>__asin-<ASIN>.json`.

### Step 3 — Extract to spreadsheet

Open a new terminal and start a Claude Code session in this project directory. Open `run_prompts/2-EXTRACT_PROMPT_TEMPLATE.txt`, paste it into the session, and Claude will read every JSON file in `product_data/` and compile a `.xlsx` comparison spreadsheet — one row per product, one column per data point.

---

## Usage — Agent-assisted (letting your AI agent guide you)

Use this approach if you want your AI agent (Claude Code, Cursor, etc.) to handle the scraping and extraction process for you.

### Session 1 — Scraping

1. Open a **new agent session** in this project directory.
2. Open `run_prompts/1-SCRAPE_PROMPT_TEMPLATE.txt`.
3. Replace the placeholder `[PASTE LINK]` entries with your actual Amazon product URLs (full URLs — see [long vs short URL guidance](#using-long-urls-instead-of-short-urls)).
4. Paste the entire prompt into the new agent session.
5. The agent will ask you to confirm your VPN is on and you are logged out of Amazon before it does anything. Reply with confirmation only when both are true.
6. The agent will run the scraper and report back with the saved file paths and field counts.
7. If a run stops early (block, CAPTCHA, timeout), the agent will report which URL triggered the stop and which URLs were never attempted. Do not ask it to retry — back off and try again later.

> **Recommended model for scraping:** Switch to a token-efficient model like Claude Haiku for the scraping session. If the run fails due to a Node.js error or dependency issue (not a 503/CAPTCHA/timeout stop), re-run with a more capable model like Claude Sonnet, which is better at debugging.

### Session 2 — Extraction

1. Open a **separate new agent session** in this project directory.
2. Open `run_prompts/2-EXTRACT_PROMPT_TEMPLATE.txt`.
3. Edit the `DATA POINTS TO EXTRACT` list in the prompt to match what you need.
4. Paste the entire prompt into the new agent session.
5. The agent will read the JSON files in `product_data/` one at a time and compile a `.xlsx` spreadsheet.

> **Recommended model for extraction:** Use Claude Sonnet (or equivalent) — extraction requires reading and reasoning across multiple files.

### Agent instructions quick-reference

```
Point your agent at:   run_prompts/
Session 1 prompt:      1-SCRAPE_PROMPT_TEMPLATE.txt  →  add your URLs  →  paste into new session
Session 2 prompt:      2-EXTRACT_PROMPT_TEMPLATE.txt  →  edit data points  →  paste into new session
Output folder:         product_data/
```

---

## Customising what gets scraped

To change which data is extracted from the Amazon page, edit **`scrape-amazon-products.js`**.

The extraction logic is in the `page.evaluate()` call starting around **line 153**. Each field is a CSS selector that targets a specific Amazon DOM section:

```js
// Example: the product title
title: firstOf('#productTitle', '#title'),

// Example: feature bullets ("About this item")
featureBullets: firstOf('#featurebullets_feature_div', '#pqv-feature-bullets'),
```

**To add a new field:**

1. Inspect the Amazon product page in a browser (right-click → Inspect) to find the DOM element containing the data you want.
2. Note its `id` attribute (e.g., `id="someNewSection_feature_div"`).
3. Add a new line inside the `return { ... }` block in `page.evaluate()`:
   ```js
   myNewField: getText('#someNewSection_feature_div'),
   ```
4. Use `getText(selector)` for a single selector, or `firstOf(selector1, selector2)` to try multiple selectors (useful when Amazon uses different IDs on different page layouts).

**To remove a field:** Delete its line from the `return { ... }` block.

**To change delay timing** (to reduce scraping speed if you are getting blocked): Edit `amazon-scraper-utils.js`:

```js
const MIN_DELAY_MS = 3000;   // minimum wait between requests (milliseconds)
const MAX_DELAY_MS = 8000;   // maximum wait between requests (milliseconds)
```

Increase these values to slow down the scraper. For example, `MIN_DELAY_MS = 10000` and `MAX_DELAY_MS = 20000` adds a 10–20 second gap between each request, significantly reducing detection risk.

**Do not edit `amazon-scraper-utils.js`** for anything other than delay timing. All other configuration (user agents, headers, stealth flags, viewport jitter) is intentionally set and should not be changed casually.

---

## How it works

```
Amazon URL
    │
    ▼
Playwright (real Chromium browser)
    │  • Fresh browser context per request
    │  • Rotating user agents + jittered viewports
    │  • Realistic HTTP headers (Sec-Ch-Ua, etc.)
    │  • Stealth init script (removes webdriver flag)
    │  • Random 3–8s delay between requests
    │
    ▼
expandAllSections()
    │  Clicks every collapsed accordion so hidden
    │  content (Item details, Materials & Care, etc.)
    │  is present in the DOM before extraction
    │
    ▼
page.evaluate() — DOM text extraction
    │  Targets specific Amazon section IDs
    │  Returns innerText only — no HTML, no JS, no attributes
    │
    ▼
product_data/<timestamp>__asin-<ASIN>.json
```

The scraper reads the **live rendered DOM** — the same source that browser-based AI assistants use — rather than parsing raw HTML. This means JavaScript-rendered content, dynamically loaded sections, and A+ brand content are all captured correctly.

---

## Anti-detection features

- **Fresh browser context per request** — isolated cookies, storage, and fingerprint
- **Rotating Mac/Chrome user agents** — pool of realistic, recent UA strings
- **Jittered viewports** — randomised around common macOS screen sizes
- **Realistic HTTP headers** — `Sec-Ch-Ua`, `Sec-Fetch-*`, `Accept-Language` etc., consistent with the chosen UA
- **Stealth init script** — removes `navigator.webdriver` and other automation tells
- **Random 3–8 second delays** between requests
- **Immediate halt on block signals** — stops on first 503, 429, CAPTCHA, or navigation timeout with no retries

> **This tool is designed for low-volume personal use only.** Automated access to Amazon is restricted by their [Conditions of Use](https://www.amazon.com/gp/help/customer/display.html?nodeId=508088). For commercial-scale data needs, use the official [Amazon Product Advertising API](https://affiliate-program.amazon.com/help/node/topic/G42REQNFVHCPUQ2K).

---

## Rate limiting, blocking, and recovery

### Avoiding blocks

**Scrape in small batches.** Keep each run to 10–50 products. Do not exceed 100 products in a 24-hour period — Amazon's anti-bot systems detect usage patterns even with rotating user agents and stealth headers in place.

**Allow time between runs.** Leave at least 24 hours between batches. The scraper's built-in 3–8 second delay between requests is the minimum — more is always better.

**Increase delay timing if you are getting blocked frequently.** Edit `amazon-scraper-utils.js` and raise `MIN_DELAY_MS` and `MAX_DELAY_MS` (see [Customising what gets scraped](#customising-what-gets-scraped) for how). A 10–20 second delay substantially reduces detection risk.

**Do not ask your agent to retry a stopped run.** The scraper halts immediately on any block signal (503, 429, CAPTCHA, timeout) — this is intentional. Retrying after a block makes the block worse and risks a permanent ban. Surface the stop to yourself, wait, then try again later.

### Recognising a block

| Signal | Meaning |
|---|---|
| `HTTP 503 – Service Unavailable` | Rate limited or blocked |
| `HTTP 429 – Too Many Requests` | Rate limited |
| `HTTP 403 – Forbidden` | Access blocked |
| CAPTCHA / Robot Check page | Bot detected |
| Navigation timeout | Slow page or soft block — treat as a block |

### Recovery protocol

If you are blocked:

1. **Stop immediately.** Do not run the scraper again from the same IP.
2. **Wait 24–72 hours** for a temporary block to expire, OR switch to a different VPN exit IP (a different server in the same country is usually enough for a temporary block).
3. **Test with a single URL** before resuming a full batch. If it succeeds, proceed slowly with longer delays.
4. **If blocks persist after 72 hours**, the IP may be flagged longer-term. Switch to a residential VPN or a different VPN provider.
5. **If your Amazon account is ever challenged** (unusual sign-in request, security check), stop using the scraper entirely and review Amazon's Conditions of Use.

---

## Requirements

- Node.js 18+
- [Playwright](https://playwright.dev/) (included in `package.json` — run `npm install`)
- Chromium browser (run `npx playwright install chromium` after `npm install`)

---

## Keywords

amazon scraper · amazon product data extractor · amazon price scraper · amazon ASIN scraper · amazon product comparison tool · extract amazon product data · amazon DOM scraper · playwright amazon scraper · amazon structured data · amazon product JSON · amazon product details scraper · no API amazon scraper · amazon review scraper · amazon product specifications · amazon Prime availability scraper · amazon delivery date scraper · LLM-ready product data · AI agent product research · automated amazon product comparison · amazon web scraping nodejs

---

## License

MIT — see [LICENSE](LICENSE) for details.
