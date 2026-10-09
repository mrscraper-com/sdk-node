# @mrscraper/sdk

![](./mrscraper.jpeg)

Node.js SDK for [MrScraper](https://mrscraper.com) content fetching and Google search results. Requires Node.js 18 or newer and ES modules.

## Install and authenticate

```bash
npm install @mrscraper/sdk
export MRSCRAPER_API_TOKEN="YOUR_TOKEN"
```

The SDK reads `MRSCRAPER_API_TOKEN` automatically. You can instead pass `token` in either call's options object. Both functions are async and return `{ status_code, data, headers }`. JSON responses are parsed; other responses are returned as text in `data`.

**Version 2 migration:** This release removes `fetchHtml`, `googleSerp`, and all AI scraper, manual scraper, and results methods. Use `fetch_content(url, options)` and `google_serp(queryOrUrl, options)`. Both functions now return a response wrapper instead of only the API payload.

## Fetch content

```typescript
import { fetch_content } from "@mrscraper/sdk";

const result = await fetch_content("https://example.com", {
  html: true,
  markdown: true,
  screenshot: true,
  super: true,
});
console.log(result.status_code, result.data);
```

`fetch_content` sends `POST https://api.mrscraper.com/`. The JSON body contains `url`, `maxRetries`, and optional `tokenCap`. Page settings and the token are URL query parameters. Setting `screenshot: true` also sends `browserRendering=true`, even if `browser_rendering` is false.

| Option | Default | Description |
|--------|---------|-------------|
| `url` | Required first argument | Page URL |
| `token` | Environment variable | API token override |
| `html`, `markdown` | `true`, `false` | Request HTML, Markdown, or both |
| `timeout` | `120` | Page timeout in seconds, from 1 to 300; HTTP timeout is 30 seconds longer |
| `geo_code`, `proxy_country` | `"US"`, unset | Geolocation and optional proxy country |
| `browser_rendering` | unset | `true` to force a browser, `false` to disable it, unset for automatic fallback |
| `screenshot` | `false` | Capture a screenshot and force browser rendering |
| `super` | `false` | Enable real device routing |
| `use_proxy`, `proxy` | `true`, unset | Allow a proxy or supply `username:password@host:port` |
| `home_page` | `false` | Visit the site's root first; sends `warmStart=true` |
| `wait_for_selector` | unset | Wait for a CSS selector |
| `block_resources`, `bypass_proxy` | `false`, `false` | Block resources or enable proxy bypass behavior |
| `cookie_jar`, `headers` | unset | Cookie configuration and target request headers; `headers` accepts an object or JSON string |
| `max_retries`, `token_cap` | `3`, unset | Retry count and optional token budget |
| `stream` | unset | Request a streamed response, buffered into the normal return value |
| `discard_token_secret` | `""` | Value for the `x-discard-token-secret` API header |

Unset optional query parameters are omitted. Explicit `false`, `0`, and empty strings are preserved where the Python client sends them.

## Google SERP

```typescript
import { google_serp } from "@mrscraper/sdk";

const result = await google_serp("python web scraping", {
  raw: false,
  region: "us",
  language: "en",
  page: 1,
  format: "json",
});
console.log(result.data);
```

`google_serp` sends `POST https://sync.scraper.mrscraper.com/api/google/serp/v2/sync`. The first argument may be query text or a Google search URL. For a URL, the SDK extracts `q`, `gl`, `hl`, and `start`; explicit options override the extracted region, language, and page. `raw: true` is the default and requests HTML regardless of `format`. Set `raw: false` to use `format`.

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

## Errors and types

Both functions reject with `MrScraperError` for API, authentication, network, and timeout errors. `status` contains the HTTP status for API errors and is `undefined` for network errors. Invalid options throw `TypeError` or `RangeError`.

```typescript
import { fetch_content, MrScraperError } from "@mrscraper/sdk";
import type { FetchContentOptions, GoogleSerpOptions, MrScraperResponse } from "@mrscraper/sdk";

try {
  const result: MrScraperResponse = await fetch_content("https://example.com");
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

`npm test` uses mocked HTTP responses and does not require an API token.

## License

MIT — see [LICENSE](./LICENSE).
