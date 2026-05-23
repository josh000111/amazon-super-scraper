# Amazing Amazon Scraper

Extract clean, structured product data from Amazon using your AI Agent. Drop in your URLs, run one command, get a tidy JSON file per product and a ready-to-use product comparison spreadsheet. DOM-based scraper, no bloated HTML.

---

## Why Amazing Amazon Scraper?

Most Amazon scrapers hand you a 1.5 MB wall of raw HTML and leave the rest to you. **Amazing Amazon Scraper skips the mess entirely.** It drives a real Chromium browser, reads the live page DOM exactly the way Google's and Anthropic's AI assistants do, and extracts only the text that matters — saving it as clean, labelled JSON that any script, spreadsheet, or LLM can read instantly.

### What sets it apart

| | Amazing Amazon Scraper | Typical HTML scrapers |
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

## Quick start

### 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Scrape products

Pass Amazon product URLs as arguments:

```bash
node scrape-amazon-products.js \
  "https://www.amazon.co.uk/dp/B0EXAMPLE1" \
  "https://www.amazon.co.uk/dp/B0EXAMPLE2"
```

Each product is saved as `product_data/<timestamp>__asin-<ASIN>.json`.

### 3. Extract to spreadsheet

Open a new Claude Code session and use the prompt template in `run_prompts/2-EXTRACT_PROMPT_TEMPLATE.txt`. It reads every JSON file in `product_data/` and compiles a `.xlsx` comparison spreadsheet — one row per product, one column per data point.

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

## ⚠️ Rate limiting and blocking warnings

**Do not scrape more than 100 products in a 24-hour period.** Amazon's anti-bot systems will detect patterns and block your IP address, even with rotating user agents and stealth headers in place. Blocks can be temporary (24–72 hours) or permanent.

**If you exceed safe usage thresholds, you may encounter:**
- `503 Service Unavailable` responses
- `429 Too Many Requests` responses
- CAPTCHA challenges (which the scraper cannot pass automatically)
- IP address blocks (temporary or permanent)

**Once blocked, you cannot resume scraping without:**
- Waiting for the block to expire (often 24–72 hours), OR
- Switching to a different IP address (VPN/proxy), OR
- Waiting until Amazon lifts the block

**Best practices:**
- Scrape in small batches (10–50 products) with 24+ hour gaps between runs
- Use a rotating residential VPN if scraping multiple batches
- Monitor Amazon's response codes — stop immediately on 429 or 503
- Respect Amazon's [Conditions of Use](https://www.amazon.com/gp/help/customer/display.html?nodeId=508088)

---

## Before you run

1. **Turn your VPN on.** Without it, requests originate from your real IP address.
2. **Log out of Amazon** in every browser on the machine so scraping activity is never linked to your account.
3. **Region matters for Prime data.** If you scrape from a UK IP, Prime eligibility and delivery dates populate correctly. Scraping from another region may leave the `prime` and `deliveryMessage` fields empty — check the `buybox` field as a fallback.

---

## Project structure

```
Amazing-Amazon-Scraper/
├── scrape-amazon-products.js    # Main scraper — run this
├── amazon-scraper-utils.js      # Shared utilities (UA rotation, stealth, logging)
├── prepare-html.js              # Legacy HTML cleaner (no longer needed)
├── run_prompts/
│   ├── 1-SCRAPE_PROMPT_TEMPLATE.txt   # Claude Code prompt for scraping session
│   └── 2-EXTRACT_PROMPT_TEMPLATE.txt  # Claude Code prompt for extraction session
├── product_data/                # Output: one JSON per product (gitignored)
├── scraped_data/                # Legacy: raw HTML output (gitignored)
└── cleaned_data/                # Legacy: cleaned HTML output (gitignored)
```

---

## Requirements

- Node.js 18+
- [Playwright](https://playwright.dev/) (included in `package.json`)

---

## Keywords

amazon scraper · amazon product data extractor · amazon price scraper · amazon ASIN scraper · amazon product comparison tool · extract amazon product data · amazon DOM scraper · playwright amazon scraper · amazon structured data · amazon product JSON · amazon product details scraper · no API amazon scraper · amazon review scraper · amazon product specifications · amazon Prime availability scraper · amazon delivery date scraper · LLM-ready product data · AI agent product research · automated amazon product comparison · amazon web scraping nodejs

---

## License

MIT — see [LICENSE](LICENSE) for details.
