import { URL, URLSearchParams } from "node:url";

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class MrScraperError extends Error {
  /** HTTP status code, if the error came from the API. Undefined for network/timeout errors. */
  public readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "MrScraperError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ScraperAgent = "general" | "listing" | "map";

export type SortField =
  | "createdAt"
  | "updatedAt"
  | "id"
  | "type"
  | "url"
  | "status"
  | "error"
  | "tokenUsage"
  | "runtime";

export type SortOrder = "ASC" | "DESC";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function requireToken(explicitToken?: string): string {
  const token = explicitToken ?? process.env.MRSCRAPER_API_TOKEN;
  if (!token) {
    throw new MrScraperError(
      "Missing API token. Pass it as an argument or set the MRSCRAPER_API_TOKEN environment variable. Get your token at https://app.mrscraper.com.",
    );
  }
  return token;
}

async function request<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });

    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    const data = contentType.includes("application/json")
      ? await res.json()
      : await res.text();

    if (res.status === 401) {
      throw new MrScraperError("Unauthorized or invalid API token.", 401);
    }

    if (!res.ok) {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      throw new MrScraperError(message, res.status);
    }

    return data as T;
  } catch (e: unknown) {
    if (e instanceof MrScraperError) throw e;
    throw new MrScraperError((e as Error)?.message ?? String(e));
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// 1. fetchHtml
// ---------------------------------------------------------------------------

export interface FetchHtmlOptions {
  /** The URL to fetch. */
  url: string;
  /** Request timeout in seconds (1–600). Defaults to 120. */
  timeout?: number;
  /** Two-letter ISO country code for geo-targeting. Defaults to "US". */
  geoCode?: string;
  /** Block images/fonts/css to speed up the request. Defaults to false. */
  blockResources?: boolean;
  /** Override the global MRSCRAPER_API_TOKEN for this call. */
  token?: string;
}

/**
 * Fetch the raw HTML (or JSON) of any URL through MrScraper's Fetch endpoint.
 * Throws {@link MrScraperError} on API or network errors.
 */
export async function fetchHtml<T = string>(options: FetchHtmlOptions): Promise<T> {
  const token = requireToken(options.token);
  const timeoutSecs = options.timeout ?? 120;

  const params = new URLSearchParams({
    token,
    timeout: String(timeoutSecs),
    geoCode: options.geoCode ?? "US",
    url: options.url,
    blockResources: String(!!options.blockResources),
  });

  const base = new URL("https://api.mrscraper.com/");
  base.search = params.toString();

  return request<T>(base.toString(), {}, (timeoutSecs + 30) * 1000);
}

// ---------------------------------------------------------------------------
// 2. createAiScraper
// ---------------------------------------------------------------------------

export interface CreateAiScraperOptions {
  /** The starting URL to scrape. */
  url: string;
  /** Natural-language instructions for the AI (general/listing agents). */
  message?: string;
  /** Scraper agent type. Defaults to "general". */
  agent?: ScraperAgent;
  /** Two-letter proxy country code (general/listing agents). */
  proxyCountry?: string | null;
  /** Maximum crawl depth for map agent (0–5). Defaults to 2. */
  maxDepth?: number;
  /** Maximum pages for map agent (1–1000). Defaults to 50. */
  maxPages?: number;
  /** Maximum results for map agent (1–100000). Defaults to 1000. */
  limit?: number;
  /** URL patterns to include (map agent). */
  includePatterns?: string;
  /** URL patterns to exclude (map agent). */
  excludePatterns?: string;
  /** Override the global MRSCRAPER_API_TOKEN for this call. */
  token?: string;
}

/**
 * Create a new AI scraper (general, listing, or map).
 * Throws {@link MrScraperError} on API or network errors.
 */
export async function createAiScraper<T = unknown>(
  options: CreateAiScraperOptions,
): Promise<T> {
  const token = requireToken(options.token);
  const agent = options.agent ?? "general";

  const body =
    agent === "map"
      ? {
          url: options.url,
          agent,
          maxDepth: options.maxDepth ?? 2,
          maxPages: options.maxPages ?? 50,
          limit: options.limit ?? 1000,
          includePatterns: options.includePatterns ?? "",
          excludePatterns: options.excludePatterns ?? "",
        }
      : {
          url: options.url,
          message: options.message ?? "",
          agent,
          proxyCountry: options.proxyCountry ?? null,
        };

  return request<T>(
    "https://api.app.mrscraper.com/api/v1/scrapers-ai",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-token": token,
      },
      body: JSON.stringify(body),
    },
    600_000,
  );
}

// ---------------------------------------------------------------------------
// 3. rerunAiScraper
// ---------------------------------------------------------------------------

export interface RerunAiScraperOptions {
  /** The ID of the AI scraper to rerun. */
  scraperId: string;
  /** New URL to scrape. */
  url: string;
  /** Maximum crawl depth (0–5). Defaults to 2. */
  maxDepth?: number;
  /** Maximum pages (1–1000). Defaults to 50. */
  maxPages?: number;
  /** Maximum results (1–100000). Defaults to 1000. */
  limit?: number;
  /** URL patterns to include. */
  includePatterns?: string;
  /** URL patterns to exclude. */
  excludePatterns?: string;
  /** Override the global MRSCRAPER_API_TOKEN for this call. */
  token?: string;
}

/**
 * Rerun an existing AI scraper on a new URL.
 * Throws {@link MrScraperError} on API or network errors.
 */
export async function rerunAiScraper<T = unknown>(
  options: RerunAiScraperOptions,
): Promise<T> {
  const token = requireToken(options.token);

  return request<T>(
    "https://api.app.mrscraper.com/api/v1/scrapers-ai-rerun",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-token": token,
      },
      body: JSON.stringify({
        scraperId: options.scraperId,
        url: options.url,
        maxDepth: options.maxDepth ?? 2,
        maxPages: options.maxPages ?? 50,
        limit: options.limit ?? 1000,
        includePatterns: options.includePatterns ?? "",
        excludePatterns: options.excludePatterns ?? "",
      }),
    },
    600_000,
  );
}

// ---------------------------------------------------------------------------
// 4. bulkRerunAiScraper
// ---------------------------------------------------------------------------

export interface BulkRerunAiScraperOptions {
  /** The ID of the AI scraper to rerun. */
  scraperId: string;
  /** List of URLs to scrape. */
  urls: string[];
  /** Override the global MRSCRAPER_API_TOKEN for this call. */
  token?: string;
}

/**
 * Rerun an AI scraper on multiple URLs at once.
 * Throws {@link MrScraperError} on API or network errors.
 */
export async function bulkRerunAiScraper<T = unknown>(
  options: BulkRerunAiScraperOptions,
): Promise<T> {
  const token = requireToken(options.token);

  return request<T>(
    "https://api.app.mrscraper.com/api/v1/scrapers-ai-rerun/bulk",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-token": token,
      },
      body: JSON.stringify({ scraperId: options.scraperId, urls: options.urls }),
    },
    600_000,
  );
}

// ---------------------------------------------------------------------------
// 5. rerunManualScraper
// ---------------------------------------------------------------------------

export interface RerunManualScraperOptions {
  /** The ID of the manual scraper to rerun. */
  scraperId: string;
  /** URL to scrape. */
  url: string;
  /** Override the global MRSCRAPER_API_TOKEN for this call. */
  token?: string;
}

/**
 * Rerun a manual (dashboard-configured) scraper on a URL.
 * Throws {@link MrScraperError} on API or network errors.
 */
export async function rerunManualScraper<T = unknown>(
  options: RerunManualScraperOptions,
): Promise<T> {
  const token = requireToken(options.token);

  return request<T>(
    "https://api.app.mrscraper.com/api/v1/scrapers-manual-rerun",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-token": token,
      },
      body: JSON.stringify({ scraperId: options.scraperId, url: options.url }),
    },
    600_000,
  );
}

// ---------------------------------------------------------------------------
// 6. bulkRerunManualScraper
// ---------------------------------------------------------------------------

export interface BulkRerunManualScraperOptions {
  /** The ID of the manual scraper to rerun. */
  scraperId: string;
  /** List of URLs to scrape. */
  urls: string[];
  /** Override the global MRSCRAPER_API_TOKEN for this call. */
  token?: string;
}

/**
 * Rerun a manual scraper on multiple URLs at once.
 * Throws {@link MrScraperError} on API or network errors.
 */
export async function bulkRerunManualScraper<T = unknown>(
  options: BulkRerunManualScraperOptions,
): Promise<T> {
  const token = requireToken(options.token);

  return request<T>(
    "https://api.app.mrscraper.com/api/v1/scrapers-manual-rerun/bulk",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-token": token,
      },
      body: JSON.stringify({ scraperId: options.scraperId, urls: options.urls }),
    },
    600_000,
  );
}

// ---------------------------------------------------------------------------
// 7. getAllResults
// ---------------------------------------------------------------------------

export interface GetAllResultsOptions {
  /** Field to sort by. Defaults to "updatedAt". */
  sortField?: SortField;
  /** Sort direction. Defaults to "DESC". */
  sortOrder?: SortOrder;
  /** Number of results per page (1–500). Defaults to 10. */
  pageSize?: number;
  /** Page number (1-based). Defaults to 1. */
  page?: number;
  /** Full-text search query. */
  search?: string;
  /** Column to use for date range filtering. */
  dateRangeColumn?: string;
  /** Start of date range (ISO 8601). */
  startAt?: string;
  /** End of date range (ISO 8601). */
  endAt?: string;
  /** Override the global MRSCRAPER_API_TOKEN for this call. */
  token?: string;
}

/**
 * List scraping results with sorting, pagination, search, and date filters.
 * Throws {@link MrScraperError} on API or network errors.
 */
export async function getAllResults<T = unknown>(
  options: GetAllResultsOptions = {},
): Promise<T> {
  const token = requireToken(options.token);

  const params = new URLSearchParams({
    sortField: options.sortField ?? "updatedAt",
    sortOrder: options.sortOrder ?? "DESC",
    pageSize: String(options.pageSize ?? 10),
    page: String(options.page ?? 1),
  });

  if (options.search) params.set("search", options.search);
  if (options.dateRangeColumn) params.set("dateRangeColumn", options.dateRangeColumn);
  if (options.startAt) params.set("startAt", options.startAt);
  if (options.endAt) params.set("endAt", options.endAt);

  const url = `https://api.app.mrscraper.com/api/v1/results?${params.toString()}`;

  return request<T>(
    url,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-token": token,
      },
    },
    600_000,
  );
}

// ---------------------------------------------------------------------------
// 8. getResultById
// ---------------------------------------------------------------------------

export interface GetResultByIdOptions {
  /** The ID of the result to fetch. */
  resultId: string;
  /** Override the global MRSCRAPER_API_TOKEN for this call. */
  token?: string;
}

/**
 * Fetch a single scraping result by its ID.
 * Throws {@link MrScraperError} on API or network errors.
 */
export async function getResultById<T = unknown>(
  options: GetResultByIdOptions,
): Promise<T> {
  const token = requireToken(options.token);

  const url = `https://api.app.mrscraper.com/api/v1/results/${encodeURIComponent(options.resultId)}`;

  return request<T>(
    url,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-token": token,
      },
    },
    600_000,
  );
}

// ---------------------------------------------------------------------------
// 9. googleSerpSync
// ---------------------------------------------------------------------------

export interface GoogleSerpSyncOptions {
  /** Full Google SERP URL (for example a `https://www.google.com/search?...` URL). */
  url: string;
  /**
   * When true, the API returns a raw payload (for example unparsed HTML).
   * Defaults to false.
   */
  raw?: boolean;
  /** Override the global MRSCRAPER_API_TOKEN for this call. */
  token?: string;
  /** Request timeout in milliseconds. Defaults to 300000 (5 minutes). */
  timeoutMs?: number;
}

/**
 * Run a synchronous Google SERP scrape (`/api/google/serp/sync`).
 * Uses Bearer authentication on the sync scraper host.
 * Throws {@link MrScraperError} on API or network errors.
 */
export async function googleSerpSync<T = unknown>(
  options: GoogleSerpSyncOptions,
): Promise<T> {
  const token = requireToken(options.token);
  const timeoutMs = options.timeoutMs ?? 300_000;

  return request<T>(
    "https://sync.scraper.mrscraper.com/api/google/serp/sync",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: options.url,
        raw: options.raw ?? false,
      }),
    },
    timeoutMs,
  );
}
