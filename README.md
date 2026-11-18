# MrScraper Node.js SDK

![](./mrscraper.jpeg)

Seven services matching the [MrScraper CLI](https://github.com/mrscraper-com/cli).

| Service           | Method           | Purpose                                       |
| ----------------- | ---------------- | --------------------------------------------- |
| `account`         | `account`        | Account, subscription, quota, and rate limits |
| `scrape-html`     | `scrapeHtml`     | Raw page HTML                                 |
| `scrape-markdown` | `scrapeMarkdown` | Clean Markdown; optional HTML                 |
| `get-screenshot`  | `getScreenshot`  | Full-page or top-viewport base64 screenshot   |
| `scrape-brand`    | `scrapeBrand`    | Brand data as JSON                            |
| `scrape-json`     | `scrapeJson`     | Structured extraction using a prompt          |
| `web-search`      | `webSearch`      | Ranked web search results                     |

## Install and use

Requires Node.js 18+. Obtain a token from [the app](https://app.mrscraper.com).

```bash
npm install @mrscraper/sdk
export MRSCRAPER_API_TOKEN="YOUR_TOKEN"
```

```js
import {
  account,
  scrapeHtml,
  scrapeMarkdown,
  getScreenshot,
  scrapeBrand,
  scrapeJson,
  webSearch,
} from "@mrscraper/sdk";

console.log((await account()).data);
const html = await scrapeHtml("https://books.toscrape.com/");
const markdown = await scrapeMarkdown("https://books.toscrape.com/", {
  html: true,
});
const screenshot = await getScreenshot("https://example.com", {
  screenshot: "top",
});
const brand = await scrapeBrand("https://mrscraper.com");
const data = await scrapeJson("https://books.toscrape.com/", {
  prompt: "Extract titles and prices",
});
const results = await webSearch("web scraping", {
  country: "id",
  numResults: 20,
});
console.log(results.data);
```

Functions accept `{ token: "YOUR_TOKEN" }` in their options, or read `MRSCRAPER_API_TOKEN` / `MRSCRAPER_API_KEY`. Names and options use JavaScript camelCase. TypeScript option and response types are exported.

Every response has `status_code`, `data`, and `headers`. JSON is parsed, text remains a string, and binary responses remain `Buffer`. Screenshot JSON retains the upstream base64 `screenshot`. Account returns a safe summary with `subscription_status`, `enterprise`, `token_usage`, `token_limit`, `token_remaining`, `usage_percent`, `rate_limit`, `rate_ttl`, `auto_renew`, `ends_at`, and `user` (`name`, `email`, `verified`), excluding credentials and billing identifiers. Account accepts a positive `timeout` (default 30 seconds).

Failures throw `MrScraperError` with an optional HTTP `status`; credentials are redacted from error messages. `MRSCRAPER_FETCH_BASE_URL` and `MRSCRAPER_API_BASE_URL` can override the API hosts for local testing.

## Options

| Python / LangChain  | Node / MCP         | Default              | Meaning                                             |
| ------------------- | ------------------ | -------------------- | --------------------------------------------------- |
| `timeout`           | `timeout`          | `300`                | Page deadline in seconds, integer 1–300             |
| `geo_code`          | `geoCode`          | `"us"`               | Country to load the page from                       |
| `proxy_country`     | `proxyCountry`     | `"us"`               | Proxy server country                                |
| `super`             | `superMode`        | `False` / `false`    | Use real-device routing; sent as `super`            |
| `wait_until`        | `waitUntil`        | `"domcontentloaded"` | Also accepts `load`, `networkidle0`, `networkidle2` |
| `proxy`             | `proxy`            | omitted              | Custom proxy URL                                    |
| `max_retries`       | `maxRetries`       | omitted              | Nonnegative retry limit; omission means no limit    |
| `save_result`       | `saveResult`       | `False` / `false`    | Save the result in the dashboard                    |
| `block_resources`   | `blockResources`   | `False` / `false`    | Block images, fonts, and stylesheets                |
| `wait_for_selector` | `waitForSelector`  | omitted              | Wait for a CSS selector                             |
| `return_cookie`     | `returnCookie`     | `False` / `false`    | Include session cookies                             |
| `browser_rendering` | `browserRendering` | `False` / `false`    | Enable browser rendering                            |

The first eight page controls apply to HTML, Markdown, screenshots, and JSON. The three loading controls (`block_resources`/`blockResources`, `wait_for_selector`/`waitForSelector`, `return_cookie`/`returnCookie`) apply to HTML, Markdown, and screenshots. Browser rendering can be selected for HTML, Markdown, and JSON; screenshots always enable it.

Markdown accepts `html=False` / `html: false`; enabling HTML forces browser rendering. Screenshots accept `screenshot="full"` or `"top"`, `html=True` / `true`, and `markdown=False` / `false`. JSON accepts a `prompt` (default `"Extract all data as complete as possible."`), `html=False` / `false`, and `screenshot=False` / `false`. JSON does not expose loading or cookie controls. Brand takes only the target URL, plus authentication in the Node SDK.

Search takes `query`, `country="us"`, and `num_results=10` / `numResults: 10` (integer 10–100). Queries are trimmed and must contain 1–1,000 characters. Countries are two ASCII letters and are sent in lowercase. Search also accepts a positive local `timeout`, default 120 seconds. This timeout is not sent upstream as a page option.

## HTTP contract

The CLI repository is the source of truth for service behavior. These are seven services, using two API hosts:

| Service    | Request                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Account    | `GET https://api.app.mrscraper.com/api/v1/subscription-accounts`                                     |
| HTML       | `GET https://api.mrscraper.com?url=…&html=true&markdown=false&screenshot=false`                      |
| Markdown   | `GET https://api.mrscraper.com?url=…&html=false&markdown=true&screenshot=false`                      |
| Screenshot | `GET https://api.mrscraper.com?url=…&browserRendering=true&screenshot=full&html=true&markdown=false` |
| Brand      | `GET https://api.mrscraper.com?action=brand-scraping&url=…&bundle=none`                              |
| JSON       | `GET https://api.mrscraper.com?url=…&agent=general&prompt=…&html=false&screenshot=false`             |
| Web search | `GET https://api.mrscraper.com?action=websearch&query=…&country=us&numResults=10`                    |

JSON uses GET until the encoded URL exceeds 8,000 characters. It then uses POST with `{ "url", "prompt", "agent": "general" }` in the JSON body and page controls in the query. Append `Json Schema:` and a JSON schema to the prompt to shape the extraction.

Authentication uses headers. Credentials are never placed in the query string. Page requests allow 30 seconds beyond the page timeout for HTTP transport; brand and search default to 120 seconds. Brand returns JSON synchronously with `bundle=none`.

## Migration

Version 6.0.0 replaces `scraper_api` and `web_search` with the seven camelCase services. Use `scrapeHtml(url)`, `scrapeMarkdown(url, { html: true })`, or `getScreenshot(url, { html: true, markdown: true })` for the old combined output calls. Rename snake_case options to camelCase (for example `geo_code` → `geoCode`, `max_retries` → `maxRetries`, `super` → `superMode`). The old `full_page` option becomes `screenshot: "full"` or `"top"`.

Page defaults now match the CLI: 300-second timeout, US geolocation and proxy country, rendering off unless required by a chosen service, and no explicit retry limit. Search uses `query`, `country`, and a result count; old URL/locale/raw/format options are removed. Legacy scraper job, sitemap, rerun, result, and bundle-download methods are outside this seven-service API.

## Manual testing

These commands make live calls and consume quota. Each service can be tested separately.

```bash
npm install
npm run build
export MRSCRAPER_API_TOKEN="YOUR_TOKEN"
node file.js all
node file.js account
node file.js scrapeHtml https://example.com
node file.js scrapeMarkdown https://example.com '{"html":true}'
node file.js getScreenshot https://example.com '{"screenshot":"top"}'
node file.js scrapeBrand https://mrscraper.com
node file.js scrapeJson https://books.toscrape.com '{"prompt":"Extract titles and prices"}'
node file.js webSearch "web scraping" '{"country":"id","numResults":20}'
```

The runner saves responses and screenshots under `manual-results/`, continues after failures in all mode, prints a pass/fail summary, and exits nonzero on failure. `npm run test:manual -- <service> ...` builds before running the same script.

## Development

```bash
npm test
npm pack --dry-run
```

Version 6.0.0 includes the breaking camelCase naming migration.

## License

MIT © MrScraper
