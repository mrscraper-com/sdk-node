# MrScraper Node SDK

![MrScraper](./mrscraper.jpeg)

Seven async services matching the [MrScraper CLI](https://github.com/mrscraper-com/cli), with camelCase functions and options for JavaScript and TypeScript.

| CLI command       | SDK function                   | Purpose                                                   |
| ----------------- | ------------------------------ | --------------------------------------------------------- |
| `status`          | `status()`                     | Raw account, subscription, quota, and rate-limit response |
| `scrape-html`     | `scrapeHtml(url, options)`     | Raw page HTML                                             |
| `scrape-markdown` | `scrapeMarkdown(url, options)` | Markdown, optionally with HTML                            |
| `get-screenshot`  | `getScreenshot(url, options)`  | Full-page or top-viewport screenshot                      |
| `scrape-brand`    | `scrapeBrand(url, options)`    | Website brand data as JSON                                |
| `scrape-json`     | `scrapeJson(url, options)`     | Structured data extracted with a prompt                   |
| `web-search`      | `webSearch(query, options)`    | Ranked web search results                                 |

## Installation and authentication

Requires Node.js 18 or newer. Obtain an API token from [the MrScraper app](https://app.mrscraper.com).

```bash
npm install @mrscraper/sdk
export MRSCRAPER_API_TOKEN="YOUR_TOKEN"
```

Each function accepts an optional `token: string` in its options. Credential precedence is an explicit nonempty token, `MRSCRAPER_API_TOKEN`, then `MRSCRAPER_API_KEY`. Credentials are sent in authentication headers.

## Quickstart

Save this as `example.mjs` and run `node example.mjs`:

```js
import { scrapeHtml } from "@mrscraper/sdk";

const result = await scrapeHtml("https://example.com", {
  browserRendering: true,
  timeout: 120,
});
console.log(result.status_code);
console.log(result.data);
```

All functions return promises. Every example uses `example.com` as the target; replace it for your use case. Calls use your account quota.

## Shared page parameters

These options apply to HTML, Markdown, screenshots, and JSON extraction. The page URL is a required `string` and must be an absolute HTTP or HTTPS URL.

| CLI option        | SDK option     | Type               | Default              | Meaning                                                                    |
| ----------------- | -------------- | ------------------ | -------------------- | -------------------------------------------------------------------------- |
| `--timeout`       | `timeout`      | `number` (integer) | `300`                | Page deadline in seconds, 1–300. HTTP transport allows another 30 seconds. |
| `--geo-code`      | `geoCode`      | `string`           | `"us"`               | Country to load the page from; two ASCII letters, sent in lowercase.       |
| `--proxy-country` | `proxyCountry` | `string`           | `"us"`               | Proxy server country; two ASCII letters, sent in lowercase.                |
| `--super`         | `super`        | `boolean`          | `false`              | Use real-device routing.                                                   |
| `--wait-until`    | `waitUntil`    | `WaitUntil`        | `"domcontentloaded"` | Also accepts `"load"`, `"networkidle0"`, or `"networkidle2"`.              |
| `--proxy`         | `proxy`        | `string`           | omitted              | Custom proxy URL.                                                          |
| `--max-retries`   | `maxRetries`   | `number` (integer) | omitted              | Nonnegative retry limit; omission means no limit. Zero is preserved.       |
| `--save-result`   | `saveResult`   | `boolean`          | `false`              | Save the result in the dashboard.                                          |

HTML, Markdown, and screenshots additionally accept these loading controls. JSON extraction does not accept them.

| CLI option            | SDK option        | Type      | Default | Meaning                                          |
| --------------------- | ----------------- | --------- | ------- | ------------------------------------------------ |
| `--block-resources`   | `blockResources`  | `boolean` | `false` | Block images, fonts, and stylesheets.            |
| `--wait-for-selector` | `waitForSelector` | `string`  | omitted | Wait for a CSS selector.                         |
| `--return-cookie`     | `returnCookie`    | `boolean` | `false` | Include browser session cookies in the response. |

Omit optional values or use `undefined` to keep them off the request. Explicit `false` and `0` values are preserved. Use camelCase option names, such as `browserRendering` and `numResults`.

## Service examples

### Status

```js
import { status } from "@mrscraper/sdk";

const result = await status();
console.log(result.data);
```

`status` takes no service parameters; its options only accept authentication (`token`). It uses the CLI's fixed 600-second HTTP deadline. The complete response body is returned in `data` without unwrapping, redaction, summary fields, or calculated values. When the API wraps account details in `data`, those details are in `result.data.data`. Sensitive response headers are removed.

### Scrape HTML

```js
import { scrapeHtml } from "@mrscraper/sdk";

const result = await scrapeHtml("https://example.com", {
  browserRendering: true,
  waitForSelector: ".content",
  waitUntil: "networkidle2",
  timeout: 120,
  geoCode: "us",
  proxyCountry: "us",
  super: false,
  maxRetries: 0,
  saveResult: false,
  blockResources: false,
  returnCookie: false,
});
console.log(result.data);
```

`browserRendering` is a `boolean`, default `false`. This service always sends `html=true`, `markdown=false`, and `screenshot=false`. HTML is returned as text unless the selected controls cause the API to return JSON.

### Scrape Markdown

```js
import { scrapeMarkdown } from "@mrscraper/sdk";

const result = await scrapeMarkdown("https://example.com", {
  html: true,
  browserRendering: false,
});
console.log(result.data);
```

`html` and `browserRendering` are booleans, both default `false`. Enabling HTML also enables browser rendering and returns JSON containing both outputs. Without HTML, the default response is Markdown text. This service always sends `markdown=true` and `screenshot=false`.

### Get screenshot

```js
import { getScreenshot } from "@mrscraper/sdk";
import { writeFile } from "node:fs/promises";

const result = await getScreenshot("https://example.com", {
  screenshot: "top",
  html: false,
  markdown: true,
});
if (typeof result.data === "object" && result.data?.screenshot) {
  await writeFile("page.png", Buffer.from(result.data.screenshot, "base64"));
}
console.log(result.data);
```

| Option       | Type              | Default  | Meaning                                     |
| ------------ | ----------------- | -------- | ------------------------------------------- |
| `screenshot` | `"full" \| "top"` | `"full"` | Capture the whole page or the top viewport. |
| `html`       | `boolean`         | `true`   | Include HTML.                               |
| `markdown`   | `boolean`         | `false`  | Include Markdown.                           |

Browser rendering is always enabled; there is no `browserRendering` option for screenshots. The API's screenshot JSON retains the base64 image and other returned fields. The API can still include HTML when `html: false` is requested.

### Scrape brand

```js
import { scrapeBrand } from "@mrscraper/sdk";

const result = await scrapeBrand("https://example.com");
console.log(result.data);
```

Only the required page URL and optional authentication are accepted. The SDK sends `action=brand-scraping&bundle=none` and uses a fixed 120-second HTTP deadline. Inspect the returned API structure; brand data is typically in `result.data.data.brand`.

### Scrape JSON

```js
import { scrapeJson } from "@mrscraper/sdk";

const result = await scrapeJson("https://example.com", {
  prompt:
    'Extract the page title. Json Schema: {"type":"object","properties":{"title":{"type":"string"}}}',
  browserRendering: true,
  html: false,
  screenshot: false,
  timeout: 180,
});
console.log(result.data);
```

| Option             | Type      | Default                                       | Meaning                                                                                  |
| ------------------ | --------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `prompt`           | `string`  | `"Extract all data as complete as possible."` | Nonempty extraction instruction; append `Json Schema:` and a schema to shape the output. |
| `browserRendering` | `boolean` | `false`                                       | Enable browser rendering.                                                                |
| `html`             | `boolean` | `false`                                       | Include page HTML.                                                                       |
| `screenshot`       | `boolean` | `false`                                       | Include a base64 screenshot.                                                             |

JSON extraction uses the `general` agent. It sends GET until the encoded URL exceeds 8,000 characters, then POST with `url`, `prompt`, and `agent` in the body and page controls in the query. Loading and cookie controls are unavailable.

### Web search

```js
import { webSearch } from "@mrscraper/sdk";

const result = await webSearch("site:example.com documentation", {
  country: "id",
  numResults: 20,
});
console.log(result.data);
```

| Argument or option | Type               | Default  | Meaning                                                        |
| ------------------ | ------------------ | -------- | -------------------------------------------------------------- |
| `query`            | `string`           | required | Query text, trimmed, 1–1,000 characters.                       |
| `country`          | `string`           | `"us"`   | Two-letter country code, sent in lowercase.                    |
| `numResults`       | `number` (integer) | `10`     | Requested result count, 10–100. Fewer results may be returned. |

Search uses a fixed 120-second HTTP deadline and has no `timeout` option. Results preserve the upstream `success`, `message`, and `data` fields. Entries include rank, title, URL, description, and source.

## Response types and errors

Every successful response has this shape:

```ts
interface MrScraperResponse<T = unknown> {
  status_code: number;
  data: T;
  headers: Record<string, string>;
}
```

JSON bodies become JavaScript values, text remains a string, and binary responses remain `Buffer`. Output field names retain the API's spelling. All seven functions support a generic response body type when you know the API shape:

```ts
import { scrapeJson } from "@mrscraper/sdk";

const result = await scrapeJson<{ data: { title: string } }>(
  "https://example.com",
  { prompt: "Extract the page title" },
);
console.log(result.data.data.title);
```

```js
import { scrapeHtml, MrScraperError } from "@mrscraper/sdk";

try {
  await scrapeHtml("https://example.com");
} catch (error) {
  if (error instanceof MrScraperError) {
    console.error(error.status, error.message);
  } else {
    throw error;
  }
}
```

Authentication, HTTP, network, and timeout failures throw `MrScraperError`; `status` is the HTTP status when available. Invalid parameters throw `TypeError` or `RangeError` before sending the request.

## Migration

Replace `account()` with `status()` and read the raw API response body. The status and search transport deadlines are fixed; remove their old `timeout` options. Rename `superMode` to `super`.

The seven-service API replaces `scraper_api` with `scrapeHtml`, `scrapeMarkdown`, and `getScreenshot`. Use camelCase options such as `geoCode`, `maxRetries`, and `browserRendering`. Replace `full_page` with `screenshot: "full"` or `"top"`. Search uses `query`, `country`, and `numResults`. Legacy job, sitemap, rerun, result, and bundle-download methods are outside this interface.

## Development and manual checks

```bash
npm ci
npm test
npm run build
```

The automated suite uses local HTTP responses and checks defaults, serialized parameters, output types, and failures. The following manual calls use the live API and consume quota:

```bash
export MRSCRAPER_API_TOKEN="YOUR_TOKEN"
npm run build
node file.js status
node file.js scrapeHtml https://example.com '{"browserRendering":true}'
node file.js scrapeMarkdown https://example.com '{"html":true}'
node file.js getScreenshot https://example.com '{"screenshot":"top"}'
node file.js scrapeBrand https://example.com
node file.js scrapeJson https://example.com '{"prompt":"Extract the page title"}'
node file.js webSearch 'site:example.com documentation' '{"country":"id","numResults":20}'
```

Manual responses are saved under `manual_results/`; failures exit nonzero.

## License

MIT. See [LICENSE](./LICENSE).
