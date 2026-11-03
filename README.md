# @mrscraper/sdk

![](./mrscraper.jpeg)

Node.js SDK for [MrScraper](https://mrscraper.com) page scraping, Web Search, and account status. Requires Node.js 18 or newer and ES modules.

## Install and authenticate

```bash
npm install @mrscraper/sdk
export MRSCRAPER_API_TOKEN="YOUR_TOKEN"
```

The SDK reads `MRSCRAPER_API_TOKEN` automatically. You can instead pass `token` in any call's options object. All functions are async and return `{ status_code, data, headers }`. JSON responses are parsed, HTML and other text remain strings, and binary responses are returned as Node.js `Buffer` values in `data`.

## Public functions

| Function | Purpose |
|----------|---------|
| `scraper_api(url, options?)` | Fetch a public web page as rendered HTML, Markdown, screenshot, or a combination |
| `web_search(query, options?)` | Search the web for real-time results: website URLs, titles, descriptions, and related questions |
| `account(options?)` | Read account identity, subscription, quota, and rate limits |

The package also exports `MrScraperError` and the TypeScript types `ScraperApiOptions`, `ScraperApiData`, `WebSearchOptions`, `WebSearchResponse`, `WebSearchResult`, `AccountOptions`, `AccountSummary`, and `MrScraperResponse`.

### Migrating from 4.x to 5.0

Version 5.0.0 returns to three public functions. The format-specific functions from 4.x (`scraper_html`, `scraper_markdown`, `get_screenshot`, `scraper_json`, `scraper_multiple_page`, `scraper_sitemap`, `scrape_brand`, and `get_brand`) and their option types are no longer exported. Use `scraper_api` with output flags instead:

| 4.x call | 5.0 replacement |
|----------|-----------------|
| `scraper_html(url, options)` | `scraper_api(url, options)` |
| `scraper_markdown(url, options)` | `scraper_api(url, { ...options, html: false, markdown: true })` |
| `get_screenshot(url, { full_page: false })` | `scraper_api(url, { html: false, screenshot: true })` |
| `web_search(query, { region: "us" })` | `web_search(query, { country: "us" })` |
| `ScraperOptions` type | `ScraperApiOptions` |

Other changes:

- `scraper_api` sends a `GET` request with the target URL, page options, `maxRetries`, and `tokenCap` in the query string. Multiple outputs can be requested in one call.
- A screenshot from `scraper_api` is a base64-encoded image (JPEG) in `data.screenshot`, not a `Buffer`.
- `web_search` now calls the MrScraper API with `action: "websearch"`. Its first argument is the search query, and it accepts `country` and `num_results` (10 to 100). The `raw`, `format`, `region`, `language`, `page`, and `render_js` options and search URL input are removed. Results are returned as JSON.
- `account` is unchanged.

## Scraper API

Fetch a public web page as rendered HTML, Markdown, screenshot, or a combination. Common controls support JavaScript rendering, geolocation, proxies, cookies, custom target headers, and waiting for page content.

```typescript
import { writeFile } from "node:fs/promises";
import { scraper_api } from "@mrscraper/sdk";

const html = await scraper_api("https://books.toscrape.com/");
console.log(html.data); // HTML string

const combined = await scraper_api("https://books.toscrape.com/", {
  html: true,
  markdown: true,
  screenshot: true,
  proxy_country: "us",
});
if (typeof combined.data !== "string") {
  console.log(combined.data.markdown);
  if (combined.data.screenshot) {
    await writeFile("page.jpg", Buffer.from(combined.data.screenshot, "base64"));
  }
}
```

Requesting only HTML (the default) returns the page as a string. Requesting Markdown or a screenshot returns an object with an entry for each requested output, such as `{ html, markdown, screenshot }`, where `screenshot` is a base64-encoded JPEG image. At least one of `html`, `markdown`, or `screenshot` must be `true`.

The SDK sends a `GET` request to `https://api.mrscraper.com` with the API token in the `x-api-token` header and every option, including the target `url`, in the query string:

```bash
curl --get 'https://api.mrscraper.com' \
--header 'x-api-token: {MRSCRAPER_API_TOKEN}' \
--data-urlencode 'token={MRSCRAPER_API_TOKEN}' \
--data-urlencode 'url=https://books.toscrape.com/' \
--data-urlencode 'html=true' \
--data-urlencode 'markdown=false' \
--data-urlencode 'timeout=120' \
--data-urlencode 'geoCode=US' \
--data-urlencode 'maxRetries=3'
```

| Option | Default | Description |
|--------|---------|-------------|
| `token` | Environment variable | API token override |
| `html`, `markdown`, `screenshot` | `true`, `false`, `false` | Outputs to return; combine as needed. `screenshot: true` enables browser rendering. |
| `timeout` | `120` | Page timeout in seconds, from 1 to 300; the HTTP timeout is 30 seconds longer |
| `geo_code`, `proxy_country` | `"US"`, unset | Geolocation country code and optional proxy country |
| `browser_rendering` | unset | `true` to force a browser, `false` to disable it, unset for automatic selection |
| `super` | `false` | Enable real device routing |
| `use_proxy`, `proxy` | `true`, unset | Allow a proxy or supply `username:password@host:port` |
| `home_page` | `false` | Visit the site's root before the target page (sent as `warmStart`) |
| `wait_for_selector`, `wait_until` | unset | Wait for a CSS selector or a page lifecycle event such as `"domcontentloaded"` |
| `block_resources`, `bypass_proxy` | `false`, `false` | Block images, CSS, and fonts, or enable proxy bypass behavior |
| `cookie_jar`, `headers` | unset | Cookie configuration string and target request headers; `headers` accepts an object or JSON string |
| `max_retries`, `token_cap` | `3`, unset | Nonnegative integer retry count and optional token budget |
| `stream` | unset | Request a streamed response, buffered into the normal return value |
| `discard_token_secret` | `""` | Value for the `x-discard-token-secret` request header |

Unset options use the service defaults. Explicit `false`, `0`, and empty strings are preserved where supported.

## Web Search

Searches the web to retrieve real-time results, including relevant website URLs, titles, descriptions, and related questions based on a given query.

```typescript
import { web_search } from "@mrscraper/sdk";

const result = await web_search("e-menessaptieka.lv linkedin", {
  country: "us",
  num_results: 10,
});
for (const item of result.data.data) {
  console.log(item.rank, item.title, item.url);
}
```

The SDK sends this request:

```bash
curl --location 'https://api.mrscraper.com' \
--header 'x-api-token: {MRSCRAPER_API_TOKEN}' \
--header 'Content-Type: application/json' \
--data '{
    "action": "websearch",
    "query": "e-menessaptieka.lv linkedin",
    "country": "us",
    "numResults": 10
}'
```

`result.data` is a `WebSearchResponse` with `success`, `message`, and `data`. Each item in `data` is a `WebSearchResult` with `rank`, `title`, `url`, `description`, and `source`.

| Option | Default | Description |
|--------|---------|-------------|
| `query` | Required first argument | The search query; must not be empty |
| `token` | Environment variable | API token override |
| `country` | unset | Country code for localized results, such as `"us"`; omitted to use the service default |
| `num_results` | `10` | Number of results, an integer from 10 to 100 (sent as `numResults`) |
| `timeout` | `600` | HTTP request timeout in seconds |

## Account status

Account returns an overview of the account associated with your API token, including user identity, subscription status, token usage, remaining quota, and rate limits. Use it to monitor consumption and check available tokens before running scraping or search jobs.

```typescript
import { account } from "@mrscraper/sdk";

const result = await account(); // Optional: { token: "YOUR_TOKEN", timeout: 30 }
console.log(result.data.subscription_status);
console.log(result.data.token_remaining);
console.log(result.data.user.email);
```

`account` checks the account associated with the configured API token. The timeout defaults to 30 seconds
and must be positive. `data` is an `AccountSummary` with `subscription_status`,
`enterprise`, `token_usage`, `token_limit`, `token_remaining`, `usage_percent`,
`rate_limit`, `rate_ttl`, `auto_renew`, `ends_at`, and `user` (`name`, `email`,
`verified`). Remaining tokens are clamped to zero when usage exceeds the limit.
API keys, billing identifiers, and sensitive response headers are excluded.

## Errors and types

All functions reject with `MrScraperError` for API, authentication, network, and timeout errors. `status` contains the HTTP status for API errors and is `undefined` for network errors. Invalid options throw `TypeError` or `RangeError` before any request is sent.

```typescript
import { scraper_api, MrScraperError } from "@mrscraper/sdk";
import type { MrScraperResponse, ScraperApiData } from "@mrscraper/sdk";

try {
  const result: MrScraperResponse<ScraperApiData> = await scraper_api("https://example.com");
  console.log(result.data);
} catch (error) {
  if (error instanceof MrScraperError) {
    console.error(error.status, error.message);
  } else {
    throw error;
  }
}
```

## Develop

```bash
npm ci
npm test
npm run build
```

`npm test` builds the SDK, checks TypeScript usage, and runs response-mock and local HTTP contract tests. It does not call the live API or require a token.

## Manual tests with a real token

Run these commands from a source checkout. Build the SDK and configure your API token:

```bash
npm run build
export MRSCRAPER_API_TOKEN="YOUR_TOKEN"
```

The `file.js` helper calls the three public functions against the live API:

```bash
node file.js --help
node file.js                      # account, scraper_api (HTML), and web_search
node file.js account
node file.js scraper_api "https://books.toscrape.com/"
node file.js scraper_api "https://books.toscrape.com/" '{"markdown":true,"screenshot":true}'
node file.js web_search "e-menessaptieka.lv linkedin" '{"country":"us","num_results":10}'
```

Screenshots are saved under `manual-results/`; other responses are previewed. You can also call the built SDK directly:

```bash
node --input-type=module <<'NODE'
import { account } from "./dist/index.js";

const result = await account();
console.log(result.status_code, result.data);
NODE
```

These commands make live API requests, print the HTTP status and response data, and exit with a nonzero status on errors. To run the other examples from a checkout, replace imports from `@mrscraper/sdk` with `./dist/index.js`.

## Publish manually to npm

This checkout prepares version **5.0.0**, a major release that removes the 4.x
format-specific functions. Publishing remains manual. Validate and preview the package:

```bash
npm ci
npm test
npm pack --dry-run
npm publish --dry-run --access public
```

The package includes `dist/`, `README.md`, `LICENSE`, `mrscraper.jpeg`, and
`package.json`. The `files` list excludes the local `file.js` helper. Commit
and push the release files, then publish with your npm account:

```bash
npm login
npm whoami
npm publish --access public
npm view @mrscraper/sdk version
npm view @mrscraper/sdk dist-tags --json
```

Complete npm's browser login and two-factor authentication prompts. The
`prepublishOnly` script rebuilds `dist` before publishing. Each version can be
published only once. For later releases, update `package.json` and
`package-lock.json` together with a new version before validating and publishing.

## License

MIT — see [LICENSE](./LICENSE).
