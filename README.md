---
name: MrScraper Node SDK
description: Run AI-powered, unblockable web scraping, data extraction with natural language using MrScraper Node SDK
tags: [scraping, data-extraction, web-crawling, stealth-browser, web-automation]
homepage: https://mrscraper.com/
support_email: support@mrscraper.com
---

# @mrscraper-com/sdk
![](./mrscraper.jpeg)

Official Node.js SDK for the [MrScraper](https://mrscraper.com) API.

Scrape any data from any websites.
Unblock pages, create and scale AI scrapers, manual scrapers, and retrieve results synchronously and asynchronously.
It is stealth, reliable, and scalable.
Every action is mirrored on our platform https://app.mrscraper.com

[![npm version](https://img.shields.io/npm/v/@mrscraper-com/sdk)](https://www.npmjs.com/package/@mrscraper-com/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## Table of Contents

- [Installation](#installation)
- [Requirements](#requirements)
- [Authentication](#authentication)
- [Quick Start](#quick-start)
- [Error Handling](#error-handling)
- [API Reference](#api-reference)
  - [fetchHtml](#fetchhtml)
  - [createAiScraper](#createaiscraper)
  - [rerunAiScraper](#rerunaiscraper)
  - [bulkRerunAiScraper](#bulkrerunaiscraper)
  - [rerunManualScraper](#rerunmanualscraper)
  - [bulkRerunManualScraper](#bulkrerunmanualscraper)
  - [getAllResults](#getallresults)
  - [getResultById](#getresultbyid)
- [TypeScript](#typescript)
- [License](#license)

---

## Installation

```bash
npm install @mrscraper-com/sdk
```

## Requirements

- Node.js >= 18

## Authentication

Get your API token from your [MrScraper dashboard](https://app.mrscraper.com) and set it as an environment variable:

```bash
export MRSCRAPER_API_TOKEN=your_token_here
```

Every function also accepts an optional `token` parameter to override the environment variable on a per-call basis.

---

## Quick Start

```typescript
import { fetchHtml, createAiScraper, getResultById, MrScraperError } from "@mrscraper-com/sdk";

try {
  // 1. Fetch raw HTML of a page
  const html = await fetchHtml({ url: "https://example.com" });
  console.log(html);

  // 2. Create an AI scraper and get its result
  const scraper = await createAiScraper({
    url: "https://example.com/products",
    message: "Extract all product names and prices",
    agent: "listing",
  });
  console.log(scraper);
} catch (err) {
  if (err instanceof MrScraperError) {
    console.error(`[${err.status ?? "network"}] ${err.message}`);
  } else {
    throw err;
  }
}
```

---

## Error Handling

All functions throw a `MrScraperError` on failure — whether the error comes from the API (4xx/5xx), a network issue, or a timeout. You never need to check a return value; just wrap calls in `try/catch`.

```typescript
import { MrScraperError } from "@mrscraper-com/sdk";

try {
  const html = await fetchHtml({ url: "https://example.com" });
} catch (err) {
  if (err instanceof MrScraperError) {
    console.error(err.message); // Human-readable error message
    console.error(err.status);  // HTTP status code, or undefined for network errors
  }
}
```

**`MrScraperError` properties:**

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable description of the error |
| `status` | `number \| undefined` | HTTP status code (e.g. `401`, `429`, `500`). `undefined` for network/timeout errors |
| `name` | `string` | Always `"MrScraperError"` |

---

## API Reference

### `fetchHtml`

Fetches the raw HTML (or JSON) of any URL through MrScraper's Fetch endpoint.

```typescript
const html = await fetchHtml({
  url: "https://example.com",         // required
  timeout: 120,                       // optional – seconds (1–600), default: 120
  geoCode: "US",                      // optional – 2-letter country code, default: "US"
  blockResources: false,              // optional – block images/CSS/fonts, default: false
  token: "your_token",                // optional – overrides MRSCRAPER_API_TOKEN
});
```

**Options:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | `string` | Yes | — | The URL to fetch |
| `timeout` | `number` | No | `120` | Request timeout in seconds (1–600) |
| `geoCode` | `string` | No | `"US"` | Two-letter ISO country code for geo-targeting |
| `blockResources` | `boolean` | No | `false` | Block images, fonts, and CSS to speed up the request |
| `token` | `string` | No | — | Overrides the `MRSCRAPER_API_TOKEN` environment variable |

**Returns:** `Promise<string>` — the raw HTML (or JSON string) of the page.

---

### `createAiScraper`

Creates a new AI scraper. Supports three agent types:

- **`general`** — extracts structured data based on your natural-language `message`
- **`listing`** — optimised for list/collection pages (products, jobs, articles, etc.)
- **`map`** — crawls a site to discover and map all URLs

```typescript
// General / listing agent
const scraper = await createAiScraper({
  url: "https://example.com/products",
  message: "Extract all product names and prices",
  agent: "listing",           // "general" | "listing" | "map", default: "general"
  proxyCountry: "US",         // optional
});

// Map agent
const scraper = await createAiScraper({
  url: "https://example.com",
  agent: "map",
  maxDepth: 2,                // optional – default: 2
  maxPages: 50,               // optional – default: 50
  limit: 1000,                // optional – default: 1000
  includePatterns: "/blog",   // optional
  excludePatterns: "/admin",  // optional
});
```

**Options:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | `string` | Yes | — | Starting URL to scrape |
| `message` | `string` | No | `""` | Natural-language instructions (general/listing agents) |
| `agent` | `"general" \| "listing" \| "map"` | No | `"general"` | Agent type |
| `proxyCountry` | `string \| null` | No | — | Two-letter proxy country code (general/listing) |
| `maxDepth` | `number` | No | `2` | Max crawl depth, 0–5 (map agent) |
| `maxPages` | `number` | No | `50` | Max pages to crawl, 1–1000 (map agent) |
| `limit` | `number` | No | `1000` | Max results to return, 1–100000 (map agent) |
| `includePatterns` | `string` | No | `""` | URL patterns to include (map agent) |
| `excludePatterns` | `string` | No | `""` | URL patterns to exclude (map agent) |
| `token` | `string` | No | — | Overrides the `MRSCRAPER_API_TOKEN` environment variable |

**Returns:** `Promise<unknown>` — the API response object.

---

### `rerunAiScraper`

Reruns an existing AI scraper on a new URL.

```typescript
const result = await rerunAiScraper({
  scraperId: "your-scraper-id",         // required
  url: "https://example.com/new-page",  // required
  maxDepth: 2,                          // optional
  maxPages: 50,                         // optional
  limit: 1000,                          // optional
  includePatterns: "",                  // optional
  excludePatterns: "",                  // optional
});
```

**Options:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `scraperId` | `string` | Yes | — | ID of the AI scraper to rerun |
| `url` | `string` | Yes | — | New URL to scrape |
| `maxDepth` | `number` | No | `2` | Max crawl depth (0–5) |
| `maxPages` | `number` | No | `50` | Max pages (1–1000) |
| `limit` | `number` | No | `1000` | Max results (1–100000) |
| `includePatterns` | `string` | No | `""` | URL patterns to include |
| `excludePatterns` | `string` | No | `""` | URL patterns to exclude |
| `token` | `string` | No | — | Overrides the `MRSCRAPER_API_TOKEN` environment variable |

**Returns:** `Promise<unknown>` — the API response object.

---

### `bulkRerunAiScraper`

Reruns an AI scraper on multiple URLs at once.

```typescript
const result = await bulkRerunAiScraper({
  scraperId: "your-scraper-id",
  urls: [
    "https://example.com/page1",
    "https://example.com/page2",
  ],
});
```

**Options:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scraperId` | `string` | Yes | ID of the AI scraper to rerun |
| `urls` | `string[]` | Yes | List of URLs to scrape |
| `token` | `string` | No | Overrides the `MRSCRAPER_API_TOKEN` environment variable |

**Returns:** `Promise<unknown>` — the API response object.

---

### `rerunManualScraper`

Reruns a manual (dashboard-configured) scraper on a URL.

```typescript
const result = await rerunManualScraper({
  scraperId: "your-scraper-id",
  url: "https://example.com/target",
});
```

**Options:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scraperId` | `string` | Yes | ID of the manual scraper to rerun |
| `url` | `string` | Yes | URL to scrape |
| `token` | `string` | No | Overrides the `MRSCRAPER_API_TOKEN` environment variable |

**Returns:** `Promise<unknown>` — the API response object.

---

### `bulkRerunManualScraper`

Reruns a manual scraper on multiple URLs at once.

```typescript
const result = await bulkRerunManualScraper({
  scraperId: "your-scraper-id",
  urls: [
    "https://example.com/a",
    "https://example.com/b",
  ],
});
```

**Options:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scraperId` | `string` | Yes | ID of the manual scraper to rerun |
| `urls` | `string[]` | Yes | List of URLs to scrape |
| `token` | `string` | No | Overrides the `MRSCRAPER_API_TOKEN` environment variable |

**Returns:** `Promise<unknown>` — the API response object.

---

### `getAllResults`

Lists scraping results with sorting, pagination, search, and date range filters. All options are optional.

```typescript
const results = await getAllResults({
  sortField: "updatedAt",                   // default
  sortOrder: "DESC",                        // default
  pageSize: 10,                             // default
  page: 1,                                  // default
  search: "example.com",                    // optional
  dateRangeColumn: "createdAt",             // optional
  startAt: "2024-01-01T00:00:00Z",          // optional – ISO 8601
  endAt: "2024-12-31T23:59:59Z",            // optional – ISO 8601
});
```

**Options:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sortField` | `SortField` | `"updatedAt"` | Field to sort by |
| `sortOrder` | `"ASC" \| "DESC"` | `"DESC"` | Sort direction |
| `pageSize` | `number` | `10` | Results per page (1–500) |
| `page` | `number` | `1` | Page number (1-based) |
| `search` | `string` | — | Full-text search query |
| `dateRangeColumn` | `string` | — | Column to filter by date range |
| `startAt` | `string` | — | Start of date range (ISO 8601) |
| `endAt` | `string` | — | End of date range (ISO 8601) |
| `token` | `string` | — | Overrides the `MRSCRAPER_API_TOKEN` environment variable |

**`SortField` values:** `"createdAt"` `"updatedAt"` `"id"` `"type"` `"url"` `"status"` `"error"` `"tokenUsage"` `"runtime"`

**Returns:** `Promise<unknown>` — paginated list of results.

---

### `getResultById`

Fetches a single scraping result by its ID.

```typescript
const result = await getResultById({ resultId: "your-result-id" });
console.log(result);
```

**Options:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resultId` | `string` | Yes | ID of the result to fetch |
| `token` | `string` | No | Overrides the `MRSCRAPER_API_TOKEN` environment variable |

**Returns:** `Promise<unknown>` — the result object.

---

## TypeScript

All option interfaces and shared types are exported for use in your own code:

```typescript
import type {
  FetchHtmlOptions,
  CreateAiScraperOptions,
  RerunAiScraperOptions,
  BulkRerunAiScraperOptions,
  RerunManualScraperOptions,
  BulkRerunManualScraperOptions,
  GetAllResultsOptions,
  GetResultByIdOptions,
  ScraperAgent,
  SortField,
  SortOrder,
} from "@mrscraper-com/sdk";
```

---

## License

MIT — see [LICENSE](./LICENSE)
