# MrScraper Node SDK

![MrScraper](./mrscraper.jpeg)

An async JavaScript and TypeScript SDK for the seven MrScraper services.

## Overview

Seven services share the same descriptions, parameter meanings, and defaults across the CLI, SDKs, and integrations. Names, types, authentication, and code examples follow each surface's conventions. The standard reference is maintained in [docs/service-reference.json](docs/service-reference.json).

| Service                             | Public name      | Description                                                                                                                     |
| ----------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [Status](#status)                   | `status`         | Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields.             |
| [Scrape HTML](#scrape-html)         | `scrapeHtml`     | Retrieve the raw HTML of a page. Browser rendering is optional.                                                                 |
| [Scrape Markdown](#scrape-markdown) | `scrapeMarkdown` | Retrieve a page as Markdown. Including HTML also enables browser rendering and returns both outputs as JSON.                    |
| [Get screenshot](#get-screenshot)   | `getScreenshot`  | Capture a base64 screenshot of the full page or top viewport. Browser rendering is always enabled.                              |
| [Scrape brand](#scrape-brand)       | `scrapeBrand`    | Extract a website's colors, typography, logos, and social links as JSON.                                                        |
| [Scrape JSON](#scrape-json)         | `scrapeJson`     | Extract structured JSON from a page using a natural-language prompt. Append Json Schema: and a JSON schema to shape the output. |
| [Web search](#web-search)           | `webSearch`      | Search the web and return ranked results with titles, URLs, descriptions, and sources.                                          |

## Installation

Requires Node.js 18 or newer. Examples use ES modules; save executable examples as `.mjs` files or set `"type": "module"` in your package.

```bash
npm install @mrscraper/sdk
```

## Authentication

Obtain an API key from [the MrScraper app](https://app.mrscraper.com/api-tokens). API key used to authenticate the request.

```bash
export MRSCRAPER_API_TOKEN="YOUR_TOKEN"
```

Each function accepts an optional `token: string` in its options. Precedence is a nonempty explicit token, `MRSCRAPER_API_TOKEN`, then `MRSCRAPER_API_KEY`. Credentials are sent in headers, never in the request URL.

## Quickstart

```js
import { scrapeHtml } from "@mrscraper/sdk";

const result = await scrapeHtml("https://example.com", {
  browserRendering: true,
  warmStart: true,
  waitForSelector: ".content",
  timeout: 120,
  maxRetries: 0,
});
console.log(result.data);
```

Examples use `example.com` as the sample target. Replace it for your use case. Live scraping and search calls consume account quota.

## Shared parameters

### Page controls

HTML, Markdown, screenshots, and JSON extraction share `url`, `timeout`, `geoCode`, `proxyCountry`, `super`, `waitUntil`, `proxy`, `maxRetries`, and `saveResult` (using the naming style shown below). Page defaults are 300 seconds, US geolocation/proxy country, real-device routing off, and dashboard saving off. Omitted retry limits mean no limit. Exact types, defaults, and standard descriptions appear in each service table.

### Loading controls

HTML, Markdown, and screenshots additionally accept `blockResources`, `waitForSelector`, and `returnCookie`. JSON extraction does not accept these controls. Browser rendering is optional for HTML, Markdown, and JSON; screenshots always enable it. Markdown with HTML also enables browser rendering.

## Service reference

### Status

#### Description

Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields.

#### Parameters

This service takes no service parameters. Authentication is configured separately.

The HTTP deadline is fixed at 600 seconds. It is not a service parameter.

#### Example

```js
import { status } from "@mrscraper/sdk";

const result = await status();
console.log(result.data);
```

#### Response

The complete account API response body is preserved inside data. If the API wraps account details in data, those details are available at data.data. Sensitive response headers are removed.

### Scrape HTML

#### Description

Retrieve the raw HTML of a page. Browser rendering is optional.

#### Parameters

| Parameter          | HTTP field         | Type                                                               | Default              | Description                                                                                     |
| ------------------ | ------------------ | ------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------- |
| `url`              | `url`              | string                                                             | Required             | Absolute HTTP or HTTPS URL of the page to process.                                              |
| `timeout`          | `timeout`          | number (integer)                                                   | `300`                | Page load timeout in seconds, from 1 to 300. The HTTP request allows 30 additional seconds.     |
| `geoCode`          | `geoCode`          | string                                                             | `"us"`               | Two-letter country code to load the page from, sent in lowercase.                               |
| `proxyCountry`     | `proxyCountry`     | string                                                             | `"us"`               | Two-letter country code of the proxy server, sent in lowercase.                                 |
| `super`            | `super`            | boolean                                                            | `false`              | Whether to route the request through real devices.                                              |
| `waitUntil`        | `waitUntil`        | string: `domcontentloaded`, `load`, `networkidle0`, `networkidle2` | `"domcontentloaded"` | Navigation completion event to wait for: domcontentloaded, load, networkidle0, or networkidle2. |
| `proxy`            | `proxy`            | string                                                             | Omitted              | Custom proxy URL used to load the page.                                                         |
| `maxRetries`       | `maxRetries`       | number (integer)                                                   | Omitted              | Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit.          |
| `saveResult`       | `saveResult`       | boolean                                                            | `false`              | Whether to save the result to the dashboard Result tab.                                         |
| `blockResources`   | `blockResources`   | boolean                                                            | `false`              | Whether to block images, fonts, and stylesheets while loading the page.                         |
| `waitForSelector`  | `waitForSelector`  | string                                                             | Omitted              | Wait for the page to contain the specified CSS selector before returning the result.            |
| `returnCookie`     | `returnCookie`     | boolean                                                            | `false`              | Whether to include browser session cookies in the response.                                     |
| `browserRendering` | `browserRendering` | boolean                                                            | `false`              | Whether to render the page in a browser before returning the result.                            |
| `warmStart`        | `warmStart`        | boolean                                                            | `false`              | Whether to enable warm start for more reliable scraping, at the cost of additional latency.     |

#### Example

```js
import { scrapeHtml } from "@mrscraper/sdk";

const result = await scrapeHtml("https://example.com", {
  browserRendering: true,
  warmStart: true,
  waitForSelector: ".content",
  timeout: 120,
  maxRetries: 0,
});
console.log(result.data);
```

#### Response

The default response body is HTML text. Additional controls can cause the API to return JSON; the returned structure is preserved.

### Scrape Markdown

#### Description

Retrieve a page as Markdown. Including HTML also enables browser rendering and returns both outputs as JSON.

#### Parameters

| Parameter          | HTTP field         | Type                                                               | Default              | Description                                                                                     |
| ------------------ | ------------------ | ------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------- |
| `url`              | `url`              | string                                                             | Required             | Absolute HTTP or HTTPS URL of the page to process.                                              |
| `timeout`          | `timeout`          | number (integer)                                                   | `300`                | Page load timeout in seconds, from 1 to 300. The HTTP request allows 30 additional seconds.     |
| `geoCode`          | `geoCode`          | string                                                             | `"us"`               | Two-letter country code to load the page from, sent in lowercase.                               |
| `proxyCountry`     | `proxyCountry`     | string                                                             | `"us"`               | Two-letter country code of the proxy server, sent in lowercase.                                 |
| `super`            | `super`            | boolean                                                            | `false`              | Whether to route the request through real devices.                                              |
| `waitUntil`        | `waitUntil`        | string: `domcontentloaded`, `load`, `networkidle0`, `networkidle2` | `"domcontentloaded"` | Navigation completion event to wait for: domcontentloaded, load, networkidle0, or networkidle2. |
| `proxy`            | `proxy`            | string                                                             | Omitted              | Custom proxy URL used to load the page.                                                         |
| `maxRetries`       | `maxRetries`       | number (integer)                                                   | Omitted              | Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit.          |
| `saveResult`       | `saveResult`       | boolean                                                            | `false`              | Whether to save the result to the dashboard Result tab.                                         |
| `blockResources`   | `blockResources`   | boolean                                                            | `false`              | Whether to block images, fonts, and stylesheets while loading the page.                         |
| `waitForSelector`  | `waitForSelector`  | string                                                             | Omitted              | Wait for the page to contain the specified CSS selector before returning the result.            |
| `returnCookie`     | `returnCookie`     | boolean                                                            | `false`              | Whether to include browser session cookies in the response.                                     |
| `browserRendering` | `browserRendering` | boolean                                                            | `false`              | Whether to render the page in a browser before returning the result.                            |
| `warmStart`        | `warmStart`        | boolean                                                            | `false`              | Whether to enable warm start for more reliable scraping, at the cost of additional latency.     |
| `html`             | `html`             | boolean                                                            | `false`              | Whether to include the page HTML in the response.                                               |

#### Example

```js
import { scrapeMarkdown } from "@mrscraper/sdk";

const result = await scrapeMarkdown("https://example.com", {
  html: true,
  warmStart: true,
});
console.log(result.data);
```

#### Response

The default response body is Markdown text. Enabling HTML returns JSON containing both HTML and Markdown.

### Get screenshot

#### Description

Capture a base64 screenshot of the full page or top viewport. Browser rendering is always enabled.

#### Parameters

| Parameter         | HTTP field        | Type                                                               | Default              | Description                                                                                     |
| ----------------- | ----------------- | ------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------- |
| `url`             | `url`             | string                                                             | Required             | Absolute HTTP or HTTPS URL of the page to process.                                              |
| `timeout`         | `timeout`         | number (integer)                                                   | `300`                | Page load timeout in seconds, from 1 to 300. The HTTP request allows 30 additional seconds.     |
| `geoCode`         | `geoCode`         | string                                                             | `"us"`               | Two-letter country code to load the page from, sent in lowercase.                               |
| `proxyCountry`    | `proxyCountry`    | string                                                             | `"us"`               | Two-letter country code of the proxy server, sent in lowercase.                                 |
| `super`           | `super`           | boolean                                                            | `false`              | Whether to route the request through real devices.                                              |
| `waitUntil`       | `waitUntil`       | string: `domcontentloaded`, `load`, `networkidle0`, `networkidle2` | `"domcontentloaded"` | Navigation completion event to wait for: domcontentloaded, load, networkidle0, or networkidle2. |
| `proxy`           | `proxy`           | string                                                             | Omitted              | Custom proxy URL used to load the page.                                                         |
| `maxRetries`      | `maxRetries`      | number (integer)                                                   | Omitted              | Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit.          |
| `saveResult`      | `saveResult`      | boolean                                                            | `false`              | Whether to save the result to the dashboard Result tab.                                         |
| `blockResources`  | `blockResources`  | boolean                                                            | `false`              | Whether to block images, fonts, and stylesheets while loading the page.                         |
| `waitForSelector` | `waitForSelector` | string                                                             | Omitted              | Wait for the page to contain the specified CSS selector before returning the result.            |
| `returnCookie`    | `returnCookie`    | boolean                                                            | `false`              | Whether to include browser session cookies in the response.                                     |
| `screenshot`      | `screenshot`      | string: `full`, `top`                                              | `"full"`             | Screenshot area to capture: full for the entire page or top for the top viewport.               |
| `html`            | `html`            | boolean                                                            | `true`               | Whether to include the page HTML in the response.                                               |
| `markdown`        | `markdown`        | boolean                                                            | `false`              | Whether to include the page Markdown in the response.                                           |

#### Example

```js
import { getScreenshot } from "@mrscraper/sdk";

const result = await getScreenshot("https://example.com", {
  screenshot: "top",
  html: false,
  markdown: true,
});
console.log(result.data);
```

#### Response

The response body contains a base64 screenshot and requested page outputs. The API can still include HTML when HTML output is disabled.

### Scrape brand

#### Description

Extract a website's colors, typography, logos, and social links as JSON.

#### Parameters

| Parameter | HTTP field | Type   | Default  | Description                                        |
| --------- | ---------- | ------ | -------- | -------------------------------------------------- |
| `url`     | `url`      | string | Required | Absolute HTTP or HTTPS URL of the page to process. |

The HTTP deadline is fixed at 120 seconds. It is not a service parameter.

The request uses `action=brand-scraping` and `bundle=none`; page controls are not accepted.

#### Example

```js
import { scrapeBrand } from "@mrscraper/sdk";

const result = await scrapeBrand("https://example.com");
console.log(result.data);
```

#### Response

The response body preserves the API brand result. Brand data is typically available at data.data.brand in the response envelope.

### Scrape JSON

#### Description

Extract structured JSON from a page using a natural-language prompt. Append Json Schema: and a JSON schema to shape the output.

#### Parameters

| Parameter          | HTTP field         | Type                                                               | Default                                       | Description                                                                                             |
| ------------------ | ------------------ | ------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `url`              | `url`              | string                                                             | Required                                      | Absolute HTTP or HTTPS URL of the page to process.                                                      |
| `timeout`          | `timeout`          | number (integer)                                                   | `300`                                         | Page load timeout in seconds, from 1 to 300. The HTTP request allows 30 additional seconds.             |
| `geoCode`          | `geoCode`          | string                                                             | `"us"`                                        | Two-letter country code to load the page from, sent in lowercase.                                       |
| `proxyCountry`     | `proxyCountry`     | string                                                             | `"us"`                                        | Two-letter country code of the proxy server, sent in lowercase.                                         |
| `super`            | `super`            | boolean                                                            | `false`                                       | Whether to route the request through real devices.                                                      |
| `waitUntil`        | `waitUntil`        | string: `domcontentloaded`, `load`, `networkidle0`, `networkidle2` | `"domcontentloaded"`                          | Navigation completion event to wait for: domcontentloaded, load, networkidle0, or networkidle2.         |
| `proxy`            | `proxy`            | string                                                             | Omitted                                       | Custom proxy URL used to load the page.                                                                 |
| `maxRetries`       | `maxRetries`       | number (integer)                                                   | Omitted                                       | Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit.                  |
| `saveResult`       | `saveResult`       | boolean                                                            | `false`                                       | Whether to save the result to the dashboard Result tab.                                                 |
| `prompt`           | `prompt`           | string                                                             | `"Extract all data as complete as possible."` | Instructions describing the data to extract. Append Json Schema: and a JSON schema to shape the output. |
| `browserRendering` | `browserRendering` | boolean                                                            | `false`                                       | Whether to render the page in a browser before returning the result.                                    |
| `html`             | `html`             | boolean                                                            | `false`                                       | Whether to include the page HTML in the response.                                                       |
| `screenshot`       | `screenshot`       | boolean                                                            | `false`                                       | Whether to include a base64 screenshot in the response.                                                 |

The request uses `agent=general` and GET. If the encoded URL exceeds 8,000 characters, it switches to POST with `url`, `prompt`, and `agent` in the body; page controls remain in the query.

#### Example

```js
import { scrapeJson } from "@mrscraper/sdk";

const result = await scrapeJson("https://example.com", {
  prompt:
    'Extract the page title. Json Schema: {"type":"object","properties":{"title":{"type":"string"}}}',
  browserRendering: true,
});
console.log(result.data);
```

#### Response

The response body contains the extraction result in the API's original structure. Optional HTML and screenshot outputs may add fields.

### Web search

#### Description

Search the web and return ranked results with titles, URLs, descriptions, and sources.

#### Parameters

| Parameter    | HTTP field   | Type             | Default  | Description                                                                                       |
| ------------ | ------------ | ---------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `query`      | `query`      | string           | Required | Search query text, trimmed before sending, containing 1 to 1000 characters.                       |
| `country`    | `country`    | string           | `"us"`   | Two-letter country code to search from, sent in lowercase.                                        |
| `numResults` | `numResults` | number (integer) | `10`     | Number of search results to request, as an integer from 10 to 100. Fewer results may be returned. |

The HTTP deadline is fixed at 120 seconds. It is not a service parameter.

#### Example

```js
import { webSearch } from "@mrscraper/sdk";

const result = await webSearch("site:example.com documentation", {
  country: "id",
  numResults: 20,
});
console.log(result.data);
```

#### Response

The response body contains success, message, and a data array. Each result includes rank, title, url, description, and source.

## Response format

Successful services use an envelope containing `status_code`, `data`, and `headers`. The `data` field contains the API response body; its field names are not converted to the SDK's naming style. Status preserves the complete body without adding summary fields.

```json
{
  "status_code": 200,
  "data": "<html><body>Example</body></html>",
  "headers": { "content-type": "text/html" }
}
```

Responses are `MrScraperResponse<T>` objects. JSON becomes JavaScript values, text remains `string`, and binary remains `Buffer`. Sensitive response headers are removed for status.

## Error handling

Authentication, HTTP, network, and timeout failures throw `MrScraperError`. Its `status` property is the HTTP status when available. Invalid arguments throw `TypeError` or `RangeError` before the request.

```js
import { scrapeHtml, MrScraperError } from "@mrscraper/sdk";

try {
  await scrapeHtml("https://example.com");
} catch (error) {
  if (error instanceof MrScraperError)
    console.error(error.status, error.message);
  else throw error;
}
```

## Integration features

### Configuration

Functions return promises and use camelCase options. Omit optional controls or use `undefined`; explicit `false` and `0` are preserved. TypeScript exports include `PageOptions`, `HtmlOptions`, `MarkdownOptions`, `ScreenshotOptions`, `JsonOptions`, `WebSearchOptions`, `StatusOptions`, and `MrScraperResponse<T>`.

### Advanced usage

Supply a generic response body type when you know the returned API shape:

```ts
import { scrapeJson } from "@mrscraper/sdk";
const result = await scrapeJson<{ data: { title: string } }>(
  "https://example.com",
  { prompt: "Extract the page title" },
);
console.log(result.data.data.title);
```

Save screenshot JSON as an image when the API returns a base64 screenshot:

```js
import { getScreenshot } from "@mrscraper/sdk";
import { writeFile } from "node:fs/promises";
const result = await getScreenshot("https://example.com");
if (
  typeof result.data === "object" &&
  typeof result.data?.screenshot === "string"
) {
  await writeFile("page.png", Buffer.from(result.data.screenshot, "base64"));
}
```

### Troubleshooting

Check environment credentials when authentication fails. Use camelCase option names and `super`, rather than old snake_case options or `superMode`. Page timeouts are integers from 1 to 300; status and search do not expose timeout options.

## Migration

Replace `account()` with `status()` and read the raw API body. Remove status/search timeout options and rename `superMode` to `super`. Replace combined scraper calls with `scrapeHtml`, `scrapeMarkdown`, or `getScreenshot`; use camelCase options. Replace `full_page` with `screenshot: "full"` or `"top"`. Search uses `query`, `country`, and `numResults`.

## Development and testing

### Automated checks

The automated suite checks service behavior without production API calls.

```bash
npm ci
npm test
npm run build
```

### Manual checks

The following commands call the live API using your credentials and consume quota.

```bash
npm run build
node file.js status
node file.js scrapeHtml https://example.com
node file.js webSearch "site:example.com documentation"
```

## License

MIT. See [LICENSE](./LICENSE).
