# @mrscraper/sdk

![](./mrscraper.jpeg)

Node.js SDK for [MrScraper](https://mrscraper.com) HTML, Markdown, screenshots, structured extraction, sitemap discovery, brand scraping, Google search results, and account status. Requires Node.js 18 or newer and ES modules.

## Install and authenticate

```bash
npm install @mrscraper/sdk
export MRSCRAPER_API_TOKEN="YOUR_TOKEN"
```

The SDK reads `MRSCRAPER_API_TOKEN` automatically. You can instead pass `token` in any call's options object. All functions are async and return `{ status_code, data, headers }`. JSON responses are parsed, HTML and other text remain strings, and images and ZIP files are returned as Node.js `Buffer` values in `data`.

## Service functions

These functions match the Python SDK's format-specific services. Each function selects its own output and agent; public options do not include `html`, `markdown`, or `screenshot` flags.

| Function | Request and defaults |
|----------|----------------------|
| `scraper_html(url, options)` | POST with `html=true`; Markdown and screenshot flags omitted |
| `scraper_markdown(url, options)` | POST with `markdown=true`; HTML and screenshot flags omitted |
| `get_screenshot(url, options)` | GET with `screenshot=full`, `browserRendering=true`, `waitUntil=domcontentloaded`, and `timeout=300` |
| `scraper_json(url, options)` | POST with `html=true`, `agent=general`, and a prompt |
| `scraper_multiple_page(url, options)` | POST with `agent=listing`, a prompt, and `maxPages=3`; output flags omitted |
| `scraper_sitemap(url, options)` | POST with `agent=map`, `maxDepth=2`, `maxPages=3`, and `limit=1000`; output flags omitted |
| `scrape_brand(url, options)` | POST with `action=brand-scraping` and `bundle=clean`; output flags omitted |
| `get_brand(job_id, options)` | GET `/neo/brand?id=...`; optional `output` downloads an artifact |
| `web_search(queryOrUrl, options)` | Fetch Google search results |
| `account(options)` | Read account identity, subscription, quota, and rate limits |

### Migrating from v3 to v4

Version 4 removes the public `scraper_api` function and `ScraperApiOptions` type. Replace calls with the appropriate service:

```typescript
import { scraper_html, scraper_markdown, get_screenshot } from "@mrscraper/sdk";

const url = "https://example.com";
// Previously: scraper_api(url, { html: true })
const html = await scraper_html(url);
// Previously: scraper_api(url, { html: false, markdown: true })
const markdown = await scraper_markdown(url);
// Previously: scraper_api(url, { screenshot: true })
const screenshot = await get_screenshot(url);
```

Import these functions from `@mrscraper/sdk`. Use `ScraperOptions` for shared page controls and the service option types below for specialized controls. To retrieve more than one format, call its service separately. Screenshot requests now use GET and default to full-page capture; set `full_page: false` for a viewport screenshot. Binary data is preserved as a `Buffer`.

For older versions, `fetch_content` maps to `scraper_html` and `google_serp` maps to `web_search`. Legacy version 1 names such as `fetchHtml` and `googleSerp` are not exported. The response wrapper remains `{ status_code, data, headers }`.

## HTML and Markdown

```typescript
import { scraper_html, scraper_markdown } from "@mrscraper/sdk";

const html = await scraper_html("https://example.com", { super: true });
const markdown = await scraper_markdown("https://example.com", { home_page: true });
console.log(html.data, markdown.data);
```

Scraping requests use `https://api.mrscraper.com/`. For HTML, Markdown, JSON extraction, multiple pages, and sitemap, the JSON body contains `url`, `maxRetries`, optional `tokenCap`, and the service's extraction fields. Other page controls are query parameters. Screenshot and brand creation requests put `url`, `maxRetries`, and optional `tokenCap` in the query; the brand creation JSON body contains only `url`.

### Shared scraping options

| Option | Default | Description |
|--------|---------|-------------|
| `token` | Environment variable | API token override |
| `timeout` | `120` (`300` for screenshots) | Page timeout in seconds, from 1 to 300; HTTP timeout is 30 seconds longer |
| `geo_code`, `proxy_country` | `"US"`, unset | Geolocation and optional proxy country |
| `browser_rendering` | unset | `true` to force a browser, `false` to disable it, unset for automatic fallback; unavailable for screenshots, which always enable rendering |
| `super` | `false` | Enable real device routing |
| `use_proxy`, `proxy` | `true`, unset | Allow a proxy or supply `username:password@host:port` |
| `home_page` | `false` | Visit the site's root first; sends `warmStart=true` |
| `wait_for_selector` | unset | Wait for a CSS selector |
| `wait_until` | unset (`"domcontentloaded"` for screenshots) | Browser navigation wait condition; `null` omits it |
| `block_resources`, `bypass_proxy` | `false`, `false` | Block resources or enable proxy bypass behavior |
| `cookie_jar`, `headers` | unset | Cookie configuration and target request headers; `headers` accepts an object or JSON string |
| `max_retries`, `token_cap` | `3`, unset | Nonnegative integer retry count and optional token budget |
| `stream` | unset | Request a streamed response, buffered into the normal return value |
| `discard_token_secret` | `""` | Value for the `x-discard-token-secret` API header |

Unset optional query parameters are omitted. Explicit `false`, `0`, and empty strings are preserved where the Python client sends them.

## Screenshots

```typescript
import { writeFile } from "node:fs/promises";
import { get_screenshot } from "@mrscraper/sdk";

const result = await get_screenshot("https://example.com", {
  full_page: true, // Default; false sends screenshot=true for the viewport.
  token_cap: 30,
});
if (Buffer.isBuffer(result.data)) await writeFile("page.png", result.data);
else console.log(result.data); // The API may also return JSON metadata.
```

## JSON and multiple-page extraction

```typescript
import { scraper_json, scraper_multiple_page } from "@mrscraper/sdk";

const page = await scraper_json("https://mrscraper.com/pricing", {
  prompt: "Extract all plan names and prices.",
  super: true,
});
const listings = await scraper_multiple_page("https://books.toscrape.com", {
  prompt: "Extract each book title and price.",
  max_pages: 3,
});
console.log(page.data, listings.data);
```

`ScraperJsonOptions.prompt` defaults to `"Extract all data as complete as possible."`. `ScraperMultiplePageOptions.prompt` defaults to `"Extract all entry data as complete as possible."`, and `max_pages` must be a positive integer. These become `prompt` and `maxPages` in the JSON body.

## Sitemap discovery

```typescript
import { scraper_sitemap } from "@mrscraper/sdk";

const result = await scraper_sitemap("https://docs.mrscraper.com", {
  max_depth: 2,
  max_pages: 3,
  limit: 1000,
  include_patterns: String.raw`/products/.*`,
  exclude_patterns: String.raw`/blog/.*`,
});
console.log(result.data);
```

`ScraperSitemapOptions` maps `max_depth`, `max_pages`, `include_patterns`, and `exclude_patterns` to `maxDepth`, `maxPages`, `includePatterns`, and `excludePatterns` in the JSON body. Pattern strings are forwarded unchanged; unset or `null` patterns are omitted. `max_depth` must be a nonnegative integer; `max_pages` and `limit` must be positive integers.

## Brand scraping and downloads

```typescript
import { writeFile } from "node:fs/promises";
import { scrape_brand, get_brand } from "@mrscraper/sdk";

const created = await scrape_brand("https://www.brooksrunning.com", { bundle: "clean" });
console.log(created.data); // Read the job ID from the API response.

const jobId = "JOB_ID_FROM_RESPONSE";
const job = await get_brand(jobId);
console.log(job.data); // Check job status before downloading.

const download = await get_brand(jobId, { output: "bundle" });
if (Buffer.isBuffer(download.data)) await writeFile("brand.zip", download.data);
```

`ScrapeBrandOptions.bundle` accepts `"clean"` (default), `"full"`, or `"none"`. `GetBrandOptions` accepts `token`, `timeout` (default `600` seconds), and optional `output`: `"html"`, `"bundle"`, `"screenshot"`, or `"screenshot_full"`. Omit `output` to read the job. HTML is text; ZIP and image downloads are `Buffer` values. The SDK makes one request per call and does not poll for completion.

## Web search

```typescript
import { web_search } from "@mrscraper/sdk";

const result = await web_search("python web scraping", {
  raw: false,
  region: "us",
  language: "en",
  page: 1,
  format: "json",
});
console.log(result.data);
```

`web_search` sends `POST https://sync.scraper.mrscraper.com/api/google/serp/v2/sync`. The first argument may be query text or a Google search URL. For a URL, the SDK extracts `q`, `gl`, `hl`, and `start`; explicit options override the extracted region, language, and page. `raw: true` is the default and requests HTML regardless of `format`. Set `raw: false` to use `format`.

| Option | Default | Description |
|--------|---------|-------------|
| `url` | Required first argument | Search query or Google search URL |
| `token` | Environment variable | API token override |
| `raw` | `true` | Request HTML when true |
| `format` | `"json"` | `"json"` or `"html"` when `raw` is false |
| `region`, `language` | unset | Country and language |
| `page` | unset | One based result page |
| `render_js` | `false` | Render JavaScript features |
| `timeout` | `600` | HTTP request timeout in seconds |

## Account status

```typescript
import { account } from "@mrscraper/sdk";

const result = await account(); // Optional: { token: "YOUR_TOKEN", timeout: 30 }
console.log(result.data.subscription_status);
console.log(result.data.token_remaining);
console.log(result.data.user.email);
```

`account` sends `GET https://api.app.mrscraper.com/api/v1/subscription-accounts`
with Bearer and `x-api-token` authentication. The timeout defaults to 30 seconds
and must be positive. `data` is an `AccountSummary` with `subscription_status`,
`enterprise`, `token_usage`, `token_limit`, `token_remaining`, `usage_percent`,
`rate_limit`, `rate_ttl`, `auto_renew`, `ends_at`, and `user` (`name`, `email`,
`verified`). Remaining tokens are clamped to zero when usage exceeds the limit.
API keys, billing identifiers, and sensitive response headers are excluded.

## Errors and types

All functions reject with `MrScraperError` for API, authentication, network, and timeout errors. `status` contains the HTTP status for API errors and is `undefined` for network errors. Invalid options throw `TypeError` or `RangeError`.

```typescript
import { scraper_html, MrScraperError } from "@mrscraper/sdk";
import type { ScraperOptions, ScraperSitemapOptions, MrScraperResponse } from "@mrscraper/sdk";

try {
  const result: MrScraperResponse = await scraper_html("https://example.com");
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

`npm test` builds the SDK, checks TypeScript usage (including rejected output flags), and runs response-mock and local HTTP contract tests. It does not call the live API or require a token.

## Manual tests with a real token

Run these commands from a source checkout. Build the SDK and configure your API token:

```bash
npm run build
export MRSCRAPER_API_TOKEN="YOUR_TOKEN"
```

Check account status directly through the built SDK:

```bash
node --input-type=module <<'NODE'
import { account } from "./dist/index.js";

const result = await account();
console.log(result.status_code, result.data);
NODE
```

Retrieve Markdown:

```bash
node --input-type=module <<'NODE'
import { scraper_markdown } from "./dist/index.js";

const result = await scraper_markdown("https://example.com");
console.log(result.status_code, result.data);
NODE
```

Start a brand-scraping job:

```bash
node --input-type=module <<'NODE'
import { scrape_brand } from "./dist/index.js";

const result = await scrape_brand("https://example.com");
console.log(result.status_code, result.data);
NODE
```

Use the job ID from the response with `get_brand` as shown in [Brand scraping and downloads](#brand-scraping-and-downloads). These commands make live API requests, print the HTTP status and response data, and exit with a nonzero status on unhandled errors. They do not depend on the local `file.js` helper. To run the other service examples from a checkout, replace imports from `@mrscraper/sdk` with `./dist/index.js`.

## Publish manually to npm

The removal of `scraper_api` and `ScraperApiOptions` is a breaking change. The first release with these services targets **4.0.0**. Check the registry before preparing the release; the target version must not already be published.

Update `package.json` and `package-lock.json` together, run the tests, and preview the package. Run the version command once; skip it if both files already specify `4.0.0`:

```bash
npm view @mrscraper/sdk versions --json
npm version 4.0.0 --no-git-tag-version
npm ci
npm test
npm publish --dry-run --access public
```

Continue only after the tests and dry run succeed. The package should include `dist/`, `README.md`, `LICENSE`, `mrscraper.jpeg`, and `package.json`. The `files` list in `package.json` excludes the local `file.js` helper from the npm package.

Stage the release files explicitly to keep changes to `file.js` local:

```bash
git add README.md package.json package-lock.json \
  src/api.ts src/index.ts \
  tests/api.test.mjs tests/scraping.test.mjs tests/types.test.ts
git restore --staged -- file.js
git diff --cached --name-only
git diff --cached --check
```

Confirm that `file.js` does not appear in the staged file list, then commit and push the current branch:

```bash
git commit -m "feat!: add format-specific scraping services"
git push -u origin HEAD
```

The uncommitted changes in `file.js` remain on your machine; its previously committed version remains in Git. If the repository uses pull requests, complete its review and merge process before publishing the release.

Log in with an npm account that has publishing access to `@mrscraper/sdk`, publish, and verify that `latest` points to `4.0.0`:

```bash
npm login
npm whoami
npm publish --access public
npm view @mrscraper/sdk version
npm view @mrscraper/sdk dist-tags --json
```

Complete npm's browser login and two-factor authentication prompts. The `prepublishOnly` script cleans and rebuilds `dist` before publishing. A successful publish uses the `latest` tag by default. Each package version can only be published once. For later releases, select a new unpublished version and update the release commands accordingly.

See npm's [scoped package publishing guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) and [semantic versioning guide](https://docs.npmjs.com/about-semantic-versioning/).

## License

MIT — see [LICENSE](./LICENSE).
