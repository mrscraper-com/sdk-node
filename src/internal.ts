// Internal format-specific helpers from SDK 4.x. They are not re-exported from
// the package entry point, and the package `exports` map blocks deep imports.
// Public callers use `scraper_api`, `web_search`, and `account` instead.
import { authHeaders, request, requireToken, scrape, setIfPresent } from "./api.js";
import type { MrScraperResponse, ScrapeOptions } from "./api.js";

/** Shared page, browser, proxy, and retry controls. Output is selected by the function. */
export type ScraperOptions = ScrapeOptions;

export interface ScreenshotOptions extends Omit<ScraperOptions, "browser_rendering"> {
  /** Defaults to true (screenshot=full); false captures the viewport. */
  full_page?: boolean;
}

export interface ScraperJsonOptions extends ScraperOptions {
  /** Defaults to "Extract all data as complete as possible." */
  prompt?: string;
}

export interface ScraperMultiplePageOptions extends ScraperOptions {
  /** Defaults to "Extract all entry data as complete as possible." */
  prompt?: string;
  /** Positive integer, defaults to 3. */
  max_pages?: number;
}

export interface ScraperSitemapOptions extends ScraperOptions {
  /** Nonnegative integer, defaults to 2. */
  max_depth?: number;
  /** Positive integer, defaults to 3. */
  max_pages?: number;
  /** Positive integer, defaults to 1000. */
  limit?: number;
  /** Pattern strings are forwarded unchanged; unset patterns are omitted. */
  include_patterns?: string | null;
  exclude_patterns?: string | null;
}

export type BrandBundle = "clean" | "full" | "none";
export type BrandOutput = "html" | "bundle" | "screenshot" | "screenshot_full";

export interface ScrapeBrandOptions extends ScraperOptions {
  /** Defaults to clean. */
  bundle?: BrandBundle;
}

export interface GetBrandOptions {
  token?: string;
  output?: BrandOutput | null;
  /** HTTP timeout in seconds, defaults to 600. */
  timeout?: number;
}

/** Fetch HTML. Only html=true is sent; other output flags are omitted. */
export async function scraper_html<T = unknown>(
  url: string, options: ScraperOptions = {},
): Promise<MrScraperResponse<T>> {
  return scrape<T>(url, options, { html: true });
}

/** Fetch Markdown. Only markdown=true is sent; other output flags are omitted. */
export async function scraper_markdown<T = unknown>(
  url: string, options: ScraperOptions = {},
): Promise<MrScraperResponse<T>> {
  return scrape<T>(url, options, { markdown: true });
}

/** Capture a screenshot using GET. Images are returned as Buffer in data. */
export async function get_screenshot<T = unknown>(
  url: string, options: ScreenshotOptions = {},
): Promise<MrScraperResponse<T>> {
  const fullPage = options.full_page === undefined ? true : options.full_page;
  if (typeof fullPage !== "boolean") throw new TypeError("full_page must be a boolean");
  return scrape<T>(url, {
    ...options,
    timeout: options.timeout ?? 300,
    wait_until: options.wait_until === undefined ? "domcontentloaded" : options.wait_until,
  }, { method: "GET", screenshot: fullPage ? "full" : true });
}

/** Extract structured JSON with the general agent and html=true. */
export async function scraper_json<T = unknown>(
  url: string, options: ScraperJsonOptions = {},
): Promise<MrScraperResponse<T>> {
  return scrape<T>(url, options, {
    html: true, agent: "general", prompt: options.prompt ?? "Extract all data as complete as possible.",
  });
}

/** Extract entries across multiple pages using the listing agent. */
export async function scraper_multiple_page<T = unknown>(
  url: string, options: ScraperMultiplePageOptions = {},
): Promise<MrScraperResponse<T>> {
  return scrape<T>(url, options, {
    agent: "listing", prompt: options.prompt ?? "Extract all entry data as complete as possible.",
    max_pages: options.max_pages ?? 3,
  });
}

/** Discover URLs with the map agent; pattern strings are preserved unchanged. */
export async function scraper_sitemap<T = unknown>(
  url: string, options: ScraperSitemapOptions = {},
): Promise<MrScraperResponse<T>> {
  return scrape<T>(url, options, {
    agent: "map", max_depth: options.max_depth ?? 2, max_pages: options.max_pages ?? 3,
    limit: options.limit ?? 1000, include_patterns: options.include_patterns,
    exclude_patterns: options.exclude_patterns,
  });
}

/** Start a brand-scraping job; use the returned job ID with get_brand. */
export async function scrape_brand<T = unknown>(
  url: string, options: ScrapeBrandOptions = {},
): Promise<MrScraperResponse<T>> {
  return scrape<T>(url, options, { action: "brand-scraping", bundle: options.bundle ?? "clean" });
}

/** Read a brand job or download HTML, a ZIP bundle, or a screenshot. */
export async function get_brand<T = unknown>(
  job_id: string, options: GetBrandOptions = {},
): Promise<MrScraperResponse<T>> {
  const token = requireToken(options.token);
  if (typeof job_id !== "string" || !job_id.trim()) throw new TypeError("job_id must be a non-empty string");
  if (options.output != null && !["html", "bundle", "screenshot", "screenshot_full"].includes(options.output)) {
    throw new TypeError("output must be 'html', 'bundle', 'screenshot', or 'screenshot_full'");
  }
  const timeout = options.timeout ?? 600;
  if (!Number.isFinite(timeout) || timeout <= 0) throw new RangeError("timeout must be greater than 0 seconds");
  const params = new URLSearchParams({ id: job_id });
  setIfPresent(params, "output", options.output);
  return request<T>("GET", `https://api.mrscraper.com/neo/brand?${params}`,
    undefined, authHeaders(token), timeout, token);
}
