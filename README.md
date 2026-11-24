# MrScraper Node SDK

![MrScraper](./mrscraper.jpeg)

An async JavaScript and TypeScript SDK for the seven MrScraper services.

## Overview

Seven services share the same descriptions, parameter meanings, and defaults across the CLI, SDKs, and integrations. Names, types, authentication, and code examples follow each surface's conventions. See the [API Reference](https://docs.mrscraper.com/docs/api/overview).

| Service                             | Public name      | Description                                                                                                                     |
| ----------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [Status](#status)                   | `status`         | Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields.             |
| [Scrape HTML](#scrape-html)         | `scrapeHtml`     | Retrieve the raw HTML of a page. Browser rendering is optional.                                                                 |
| [Scrape Markdown](#scrape-markdown) | `scrapeMarkdown` | Retrieve a page as clean Markdown. Browser rendering is optional.                                                               |
| [Get screenshot](#get-screenshot)   | `getScreenshot`  | Capture a base64 PNG screenshot of the full page. Browser rendering is always enabled.                                          |
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
  waitForSelector: "body",
  timeout: 120,
  maxRetries: 0,
});
console.log(result.data);
```

Examples use `example.com` as the sample target. Replace it for your use case. Live scraping and search calls consume account quota.

Response examples show selected keys and types observed in live API responses. Values are placeholders; page content, base64 images, and arrays are abbreviated. Actual responses may contain additional fields.

## Shared parameters

### Page controls

HTML, Markdown, screenshots, and JSON extraction share `url`, `timeout`, `waitForSelector`, `geoCode`, `maxAge`, and `maxRetries` (using the naming style shown below). Defaults are a 300-second timeout (up to 330) and a `maxAge` of 0 milliseconds, which always scrapes fresh; `maxAge` accepts up to 604800000 (7 days). `geoCode` and `maxRetries` are omitted unless set, so the API loads the page from the United States with no retry limit. Results are always saved to the dashboard (`saveResult=true`), and `tokenCap` is never sent. Exact types, defaults, and standard descriptions appear in each service table.

### Loading controls

HTML, Markdown, and JSON extraction also accept `browserRendering`, `warmStart`, and `blockResources`; HTML and Markdown also accept `action`. `browserRendering` is omitted unless set: the API loads the page without a browser first and switches to one if the request is blocked, while `true` always renders and `false` never does. Screenshots always render in a browser: Get screenshot sends `browserRendering=true`, and so does Scrape HTML whenever a screenshot is set.

### Fixed request fields

Each service adds its documented fixed fields automatically, so they are not service parameters: `html=true` and `markdown=false` for HTML (plus `browserRendering=true` when a screenshot is set), `markdown=true`, `html=false`, and `screenshot=false` for Markdown, `screenshot=full`, `html=false`, `markdown=false`, and `browserRendering=true` for screenshots, `action=brand-scraping` and `bundle=none` for brand, `agent=general` for JSON extraction, and `action=websearch` for search. HTML, Markdown, screenshots, and JSON extraction also always send `saveResult=true`.

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

The API body contains message and data. Account details remain nested in data, including subscriptionItem and scraperAllowance. The response envelope therefore exposes account details at data.data. Sensitive response headers are removed.

**Success response**

```json
{
  "status_code": 200,
  "data": {
    "message": "Example response",
    "data": {
      "id": "ACCOUNT_ID",
      "tokenLimit": 100000,
      "tokenUsage": 2500,
      "stripeStatus": "active",
      "user": {
        "name": "Example user",
        "email": "user@example.com",
        "isVerified": true
      },
      "subscriptionItem": {
        "name": "Example plan",
        "tokenLimit": 100000
      },
      "scraperAllowance": {
        "remaining": 97500,
        "plans": [
          {
            "remaining": 97500
          }
        ]
      }
    }
  },
  "headers": {
    "content-type": "application/json; charset=utf-8"
  }
}
```

### Scrape HTML

#### Description

Retrieve the raw HTML of a page. Browser rendering is optional.

#### Parameters

| Parameter          | HTTP field         | Type              | Default  | Description                                                                                                                                                                                                                                                                                           |
| ------------------ | ------------------ | ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`              | `url`              | string            | Required | Absolute HTTP or HTTPS URL of the page to process.                                                                                                                                                                                                                                                    |
| `browserRendering` | `browserRendering` | boolean           | Omitted  | Whether to load the page in a browser: true always does and false never does. Omit it to load the page without a browser first and switch to a browser automatically if the request is blocked.                                                                                                       |
| `timeout`          | `timeout`          | number (integer)  | `300`    | Maximum seconds to wait for the scrape, from 1 to 330. The HTTP request allows 30 additional seconds.                                                                                                                                                                                                 |
| `warmStart`        | `warmStart`        | boolean           | `false`  | Whether to open the site's home page first to warm the session before loading the target URL.                                                                                                                                                                                                         |
| `blockResources`   | `blockResources`   | boolean           | `false`  | Whether to block images, fonts, and stylesheets while loading the page.                                                                                                                                                                                                                               |
| `waitForSelector`  | `waitForSelector`  | string            | Omitted  | CSS selector or text to wait for on the page before returning the result, up to 500 characters.                                                                                                                                                                                                       |
| `action`           | `action`           | string            | Omitted  | Scraper action that routes the request or simply flags it, useful for separating analytics per domain.                                                                                                                                                                                                |
| `geoCode`          | `geoCode`          | string            | Omitted  | Two-letter country code to load the page from, sent in lowercase.                                                                                                                                                                                                                                     |
| `maxAge`           | `maxAge`           | number (integer)  | `0`      | Return a cached result of the same request when it is newer than the selected age. A cached result costs the same tokens as the original scrape.                                                                                                                                                      |
| `maxRetries`       | `maxRetries`       | number (integer)  | Omitted  | Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit.                                                                                                                                                                                                                |
| `screenshot`       | `screenshot`       | `false` or string | `false`  | Screenshot to capture with the HTML: false for none, full for the entire page, top for the first viewport, or a WIDTHxHEIGHT viewport from 100 to 3840 pixels with an optional -ZOOM percent from 25 to 300, such as 1280x800 or 1920x1080-75. Setting a screenshot also sends browserRendering=true. |

The request uses `html=true`, `markdown=false`, and `saveResult=true`. The screenshot is optional; setting one also sends `browserRendering=true`, because a screenshot needs a rendered page, and the response becomes JSON with `html` and `screenshot`.

#### Example

```js
import { scrapeHtml } from "@mrscraper/sdk";

const result = await scrapeHtml("https://example.com", {
  browserRendering: true,
  warmStart: true,
  waitForSelector: "body",
  timeout: 120,
  maxRetries: 0,
});
console.log(result.data);
```

#### Response

The response body is HTML text. With a screenshot, the API returns JSON containing html and a base64 screenshot.

**Default HTML text**

```json
{
  "status_code": 200,
  "data": "<html><body>Example page content...</body></html>",
  "headers": {
    "content-type": "text/html; charset=utf-8"
  }
}
```

**With a screenshot**

```json
{
  "status_code": 200,
  "data": {
    "html": "<html>...</html>",
    "screenshot": "BASE64_IMAGE_DATA"
  },
  "headers": {
    "content-type": "application/json; charset=utf-8"
  }
}
```

### Scrape Markdown

#### Description

Retrieve a page as clean Markdown. Browser rendering is optional.

#### Parameters

| Parameter          | HTTP field         | Type             | Default  | Description                                                                                                                                                                                     |
| ------------------ | ------------------ | ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`              | `url`              | string           | Required | Absolute HTTP or HTTPS URL of the page to process.                                                                                                                                              |
| `browserRendering` | `browserRendering` | boolean          | Omitted  | Whether to load the page in a browser: true always does and false never does. Omit it to load the page without a browser first and switch to a browser automatically if the request is blocked. |
| `timeout`          | `timeout`          | number (integer) | `300`    | Maximum seconds to wait for the scrape, from 1 to 330. The HTTP request allows 30 additional seconds.                                                                                           |
| `warmStart`        | `warmStart`        | boolean          | `false`  | Whether to open the site's home page first to warm the session before loading the target URL.                                                                                                   |
| `blockResources`   | `blockResources`   | boolean          | `false`  | Whether to block images, fonts, and stylesheets while loading the page.                                                                                                                         |
| `waitForSelector`  | `waitForSelector`  | string           | Omitted  | CSS selector or text to wait for on the page before returning the result, up to 500 characters.                                                                                                 |
| `action`           | `action`           | string           | Omitted  | Scraper action that routes the request or simply flags it, useful for separating analytics per domain.                                                                                          |
| `geoCode`          | `geoCode`          | string           | Omitted  | Two-letter country code to load the page from, sent in lowercase.                                                                                                                               |
| `maxAge`           | `maxAge`           | number (integer) | `0`      | Return a cached result of the same request when it is newer than the selected age. A cached result costs the same tokens as the original scrape.                                                |
| `maxRetries`       | `maxRetries`       | number (integer) | Omitted  | Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit.                                                                                                          |

The request uses `markdown=true`, `html=false`, `screenshot=false`, and `saveResult=true`.

#### Example

```js
import { scrapeMarkdown } from "@mrscraper/sdk";

const result = await scrapeMarkdown("https://example.com", {
  warmStart: true,
  maxAge: 86400000,
});
console.log(result.data);
```

#### Response

The response body is Markdown text.

**Default Markdown text**

```json
{
  "status_code": 200,
  "data": "# Example page\n\nExample Markdown content...",
  "headers": {
    "content-type": "text/markdown; charset=utf-8"
  }
}
```

### Get screenshot

#### Description

Capture a base64 PNG screenshot of the full page. Browser rendering is always enabled.

#### Parameters

| Parameter         | HTTP field        | Type             | Default  | Description                                                                                                                                      |
| ----------------- | ----------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `url`             | `url`             | string           | Required | Absolute HTTP or HTTPS URL of the page to process.                                                                                               |
| `timeout`         | `timeout`         | number (integer) | `300`    | Maximum seconds to wait for the scrape, from 1 to 330. The HTTP request allows 30 additional seconds.                                            |
| `waitForSelector` | `waitForSelector` | string           | Omitted  | CSS selector or text to wait for on the page before returning the result, up to 500 characters.                                                  |
| `geoCode`         | `geoCode`         | string           | Omitted  | Two-letter country code to load the page from, sent in lowercase.                                                                                |
| `maxAge`          | `maxAge`          | number (integer) | `0`      | Return a cached result of the same request when it is newer than the selected age. A cached result costs the same tokens as the original scrape. |
| `maxRetries`      | `maxRetries`      | number (integer) | Omitted  | Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit.                                                           |

The request uses `screenshot=full`, `browserRendering=true`, `html=false`, `markdown=false`, and `saveResult=true`; these are not service parameters. The API still includes the page HTML in the response.

#### Example

```js
import { getScreenshot } from "@mrscraper/sdk";

const result = await getScreenshot("https://example.com", {
  waitForSelector: "body",
  timeout: 120,
});
console.log(result.data);
```

#### Response

The response body is JSON containing a base64 PNG screenshot of the full page and the page HTML, which the API includes even though html=false is sent.

**Success response**

```json
{
  "status_code": 200,
  "data": {
    "html": "<html>...</html>",
    "screenshot": "BASE64_PNG_DATA"
  },
  "headers": {
    "content-type": "application/json; charset=utf-8"
  }
}
```

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

The API body contains message and a data object with job_id, status, url, final_url, brand, and error. Brand details are available at data.data.brand in the response envelope.

**Success response**

```json
{
  "status_code": 200,
  "data": {
    "data": {
      "job_id": "JOB_ID",
      "status": "succeeded",
      "url": "https://example.com",
      "final_url": "https://example.com",
      "brand": {
        "name": "Example brand",
        "colors": {
          "background": "#ffffff",
          "text": "#222222"
        },
        "typography": {
          "body": {
            "font_family": "Example font"
          }
        }
      },
      "error": null,
      "bundle_url": null
    },
    "message": "Example response"
  },
  "headers": {
    "content-type": "application/json"
  }
}
```

### Scrape JSON

#### Description

Extract structured JSON from a page using a natural-language prompt. Append Json Schema: and a JSON schema to shape the output.

#### Parameters

| Parameter          | HTTP field         | Type             | Default                                       | Description                                                                                                                                                                                     |
| ------------------ | ------------------ | ---------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`              | `url`              | string           | Required                                      | Absolute HTTP or HTTPS URL of the page to process.                                                                                                                                              |
| `prompt`           | `prompt`           | string           | `"Extract all data as complete as possible."` | Instructions describing the data to extract. Append Json Schema: and a JSON schema to shape the output.                                                                                         |
| `html`             | `html`             | boolean          | `true`                                        | Whether to include the page HTML in the response.                                                                                                                                               |
| `browserRendering` | `browserRendering` | boolean          | Omitted                                       | Whether to load the page in a browser: true always does and false never does. Omit it to load the page without a browser first and switch to a browser automatically if the request is blocked. |
| `timeout`          | `timeout`          | number (integer) | `300`                                         | Maximum seconds to wait for the scrape, from 1 to 330. The HTTP request allows 30 additional seconds.                                                                                           |
| `warmStart`        | `warmStart`        | boolean          | `false`                                       | Whether to open the site's home page first to warm the session before loading the target URL.                                                                                                   |
| `blockResources`   | `blockResources`   | boolean          | `false`                                       | Whether to block images, fonts, and stylesheets while loading the page.                                                                                                                         |
| `waitForSelector`  | `waitForSelector`  | string           | Omitted                                       | CSS selector or text to wait for on the page before returning the result, up to 500 characters.                                                                                                 |
| `geoCode`          | `geoCode`          | string           | Omitted                                       | Two-letter country code to load the page from, sent in lowercase.                                                                                                                               |
| `maxAge`           | `maxAge`           | number (integer) | `0`                                           | Return a cached result of the same request when it is newer than the selected age. A cached result costs the same tokens as the original scrape.                                                |
| `maxRetries`       | `maxRetries`       | number (integer) | Omitted                                       | Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit.                                                                                                          |
| `screenshot`       | `screenshot`       | boolean          | `false`                                       | Whether to include a base64 screenshot in the response.                                                                                                                                         |

The request uses `agent=general`, `saveResult=true`, and GET. If the encoded URL exceeds 8,000 characters, it switches to POST with `url`, `prompt`, and `agent` in the body; page controls remain in the query.

#### Example

```js
import { scrapeJson } from "@mrscraper/sdk";

const result = await scrapeJson("https://example.com", {
  prompt:
    'Extract the first 2 items with title and price. Json Schema: {"type":"array","items":{"type":"object","properties":{"title":{"type":"string"},"price":{"type":"string"}},"required":["title","price"]}}',
  browserRendering: true,
});
console.log(result.data);
```

#### Response

Extraction results are in the API body's data field and follow the requested schema. Response metadata includes thread_id, token_usage, status, error, runtime, and cookies. html contains the page HTML unless disabled; markdown and screenshot can be empty strings.

**Success response**

```json
{
  "status_code": 200,
  "data": {
    "success": true,
    "data": [
      {
        "title": "Example item",
        "price": "10.00"
      }
    ],
    "thread_id": "THREAD_ID",
    "token_usage": 1,
    "html": "<html>...</html>",
    "markdown": "",
    "screenshot": "",
    "status": "Results ready",
    "error": "",
    "runtime": 1.23,
    "cookies": []
  },
  "headers": {
    "content-type": "application/json"
  }
}
```

### Web search

#### Description

Search the web and return ranked results with titles, URLs, descriptions, and sources.

#### Parameters

| Parameter    | HTTP field   | Type             | Default  | Description                                                                                       |
| ------------ | ------------ | ---------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `query`      | `query`      | string           | Required | Search query text, trimmed before sending, containing 1 to 1000 characters.                       |
| `country`    | `country`    | string           | Omitted  | Two-letter country code to search from, sent in lowercase.                                        |
| `numResults` | `numResults` | number (integer) | `10`     | Number of search results to request, as an integer from 10 to 100. Fewer results may be returned. |

The HTTP deadline is fixed at 120 seconds. It is not a service parameter.

The request uses `action=websearch`. `country` is omitted unless set, so the API searches from the United States.

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

The API body contains success, message, a data array, and tokenUsage. Each result includes rank, title, url, description, and source.

**Success response**

```json
{
  "status_code": 200,
  "data": {
    "success": true,
    "message": "Example response",
    "data": [
      {
        "rank": 1,
        "title": "Example result",
        "url": "https://example.com",
        "description": "Example result description.",
        "source": "example.com"
      }
    ],
    "tokenUsage": 1
  },
  "headers": {
    "content-type": "application/json; charset=utf-8"
  }
}
```

## Response format

Successful services use an envelope containing `status_code`, `data`, and `headers`. The `data` field contains the API response body; its field names are not converted to the SDK's naming style. Status preserves the complete body without adding summary fields.

```json
{
  "status_code": 200,
  "data": "<html><body>Example page content...</body></html>",
  "headers": {
    "content-type": "text/html; charset=utf-8"
  }
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

Functions return promises and use camelCase options. Omit optional controls or use `undefined`; explicit `false` and `0` are preserved. TypeScript exports include `PageOptions`, `LoadingOptions`, `HtmlOptions`, `MarkdownOptions`, `ScreenshotOptions`, `JsonOptions`, `WebSearchOptions`, `StatusOptions`, and `MrScraperResponse<T>`.

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

Check environment credentials when authentication fails. Use camelCase option names rather than snake_case. Page timeouts are integers from 1 to 330; status and search do not expose timeout options.

## Migration

Version 6.1.0 matches the Scraper API reference. Removed options: `super`, `waitUntil`, `proxyCountry`, `proxy`, `returnCookie`, `saveResult`, `tokenCap`, `html` for `scrapeMarkdown`, and `screenshot`, `html`, and `markdown` for `getScreenshot`; screenshots always capture the full page. Results are always saved to the dashboard (`saveResult=true`), and `tokenCap` is never sent. New options: `maxAge`, `action` for HTML and Markdown, and `screenshot` for `scrapeHtml`; `scrapeJson` now accepts `warmStart`, `blockResources`, and `waitForSelector`. Changed defaults: `html: true` for `scrapeJson`, `browserRendering` omitted (automatic), `geoCode` and `country` omitted, and page timeouts up to 330 seconds. Earlier releases replaced `account()` with `status()` and the combined scraper call with the six scraping and search functions.

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
