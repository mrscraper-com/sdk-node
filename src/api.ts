/** An API, authentication, network, or timeout failure. */
export class MrScraperError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "MrScraperError";
    this.status = status;
  }
}

export interface MrScraperResponse<T = unknown> {
  status_code: number;
  data: T;
  headers: Record<string, string>;
}

export interface AccountOptions {
  /** Overrides MRSCRAPER_API_TOKEN for this call. */
  token?: string;
  /** HTTP request timeout in seconds. Defaults to 30. */
  timeout?: number;
}

export interface AccountSummary {
  subscription_status: string | null;
  enterprise: boolean;
  token_usage: number;
  token_limit: number;
  token_remaining: number;
  usage_percent: number;
  rate_limit: number;
  rate_ttl: number;
  auto_renew: boolean;
  ends_at: string | null;
  user: {
    name: string | null;
    email: string | null;
    verified: boolean;
  };
}

/** Shared page, browser, proxy, and retry controls. Output is selected by the function. */
export interface ScraperOptions {
  /** Overrides MRSCRAPER_API_TOKEN for this call. */
  token?: string;
  /** Page timeout in seconds, from 1 to 300. */
  timeout?: number;
  geo_code?: string;
  proxy_country?: string | null;
  block_resources?: boolean | null;
  browser_rendering?: boolean | null;
  super?: boolean;
  use_proxy?: boolean;
  proxy?: string | null;
  wait_for_selector?: string | null;
  wait_until?: string | null;
  home_page?: boolean;
  bypass_proxy?: boolean;
  cookie_jar?: string | null;
  /** Headers forwarded to the target site, not the API request. */
  headers?: Record<string, string> | string | null;
  max_retries?: number;
  token_cap?: number | null;
  stream?: boolean | null;
  discard_token_secret?: string;
}

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

export interface WebSearchOptions {
  /** Overrides MRSCRAPER_API_TOKEN for this call. */
  token?: string;
  /** Compatibility flag: true requests HTML even when format is "json". */
  raw?: boolean;
  region?: string | null;
  language?: string | null;
  page?: number | null;
  format?: "json" | "html";
  render_js?: boolean;
  /** HTTP request timeout in seconds. */
  timeout?: number;
}

function requireToken(explicitToken?: string): string {
  const token = explicitToken || process.env.MRSCRAPER_API_TOKEN || "";
  if (!token.trim()) {
    throw new MrScraperError(
      "API token is not set. Pass token in the options or set MRSCRAPER_API_TOKEN. Get your token at https://app.mrscraper.com.",
    );
  }
  return token;
}

function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
    "x-api-token": token,
  };
}

function setIfPresent(params: URLSearchParams, key: string, value: unknown): void {
  if (value !== null && value !== undefined) {
    params.set(key, typeof value === "boolean" ? String(value) : String(value));
  }
}

async function request<T>(
  method: "GET" | "POST",
  url: string,
  body: Record<string, unknown> | undefined,
  headers: Record<string, string>,
  timeoutSeconds: number,
  token: string,
): Promise<MrScraperResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 401) {
      throw new MrScraperError(
        "Unauthorized or invalid token. Please go to https://app.mrscraper.com to get your token.",
        401,
      );
    }
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = await response.text();
        if (body) message = body;
      } catch {
        // The HTTP status remains useful even when an error body cannot be read.
      }
      throw new MrScraperError(message.replaceAll(token, "[REDACTED]"), response.status);
    }
    const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
    const isText = !contentType || contentType.startsWith("text/") ||
      ["application/xml", "application/xhtml+xml", "application/javascript"].includes(contentType);
    const data = contentType === "application/json" || contentType.endsWith("+json")
      ? await response.json()
      : isText ? await response.text() : Buffer.from(await response.arrayBuffer());
    return {
      status_code: response.status,
      data: data as T,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    if (error instanceof MrScraperError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new MrScraperError(message.replaceAll(token, "[REDACTED]"));
  } finally {
    clearTimeout(timer);
  }
}

/** Check account identity, subscription, quota, and rate limits. */
export async function account(
  options: AccountOptions = {},
): Promise<MrScraperResponse<AccountSummary>> {
  const token = requireToken(options.token);
  const timeout = options.timeout ?? 30;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new RangeError("timeout must be greater than 0 seconds");
  }
  const response = await request<unknown>(
    "GET",
    "https://api.app.mrscraper.com/api/v1/subscription-accounts",
    undefined,
    authHeaders(token),
    timeout,
    token,
  );
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const body = response.data;
  const details = isRecord(body) && "data" in body ? body.data : body;
  if (!isRecord(details)) {
    throw new MrScraperError("Account response must contain an object", response.status_code);
  }
  const numberOrZero = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const stringOrNull = (value: unknown): string | null =>
    typeof value === "string" ? value : null;
  const tokenLimit = numberOrZero(details.tokenLimit);
  const tokenUsage = numberOrZero(details.tokenUsage);
  const user = isRecord(details.user) ? details.user : {};
  return {
    ...response,
    // The raw account includes API tokens and billing identifiers.
    data: {
      subscription_status: stringOrNull(details.stripeStatus),
      enterprise: Boolean(details.isEnterprise),
      token_usage: tokenUsage,
      token_limit: tokenLimit,
      token_remaining: Math.max(0, tokenLimit - tokenUsage),
      usage_percent: tokenLimit > 0 ? Number(((tokenUsage / tokenLimit) * 100).toFixed(2)) : 0,
      rate_limit: numberOrZero(details.rateLimit),
      rate_ttl: numberOrZero(details.rateTtl),
      auto_renew: Boolean(details.isAutoRenew),
      ends_at: stringOrNull(details.endsAt),
      user: {
        name: stringOrNull(user.name),
        email: stringOrNull(user.email),
        verified: Boolean(user.isVerified),
      },
    },
    headers: Object.fromEntries(Object.entries(response.headers).filter(([key]) =>
      !["authorization", "proxy-authorization", "set-cookie", "set-cookie2", "x-api-token"].includes(key.toLowerCase()),
    )),
  };
}

interface ScraperRequest {
  method?: "GET" | "POST";
  html?: true;
  markdown?: true;
  screenshot?: true | "full";
  agent?: "general" | "listing" | "map";
  prompt?: string;
  max_pages?: number;
  max_depth?: number;
  limit?: number;
  include_patterns?: string | null;
  exclude_patterns?: string | null;
  action?: "brand-scraping";
  bundle?: BrandBundle;
}

function validateInteger(name: string, value: number | undefined, minimum: number): void {
  if (value !== undefined && (!Number.isInteger(value) || value < minimum)) {
    throw new RangeError(`${name} must be an integer greater than or equal to ${minimum}`);
  }
}

// Kept private: public functions select their output and agent independently of user options.
async function scraper_api<T>(
  url: string,
  options: ScraperOptions,
  selected: ScraperRequest,
): Promise<MrScraperResponse<T>> {
  const token = requireToken(options.token);
  const timeout = options.timeout ?? 120;
  const maxRetries = options.max_retries ?? 3;
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 300) {
    throw new RangeError("timeout must be between 1 and 300 seconds");
  }
  validateInteger("max_retries", maxRetries, 0);
  if (options.token_cap != null) validateInteger("token_cap", options.token_cap, 0);
  validateInteger("max_pages", selected.max_pages, 1);
  validateInteger("max_depth", selected.max_depth, 0);
  validateInteger("limit", selected.limit, 1);
  if (selected.bundle !== undefined && !["clean", "full", "none"].includes(selected.bundle)) {
    throw new TypeError("bundle must be 'clean', 'full', or 'none'");
  }
  if (options.super !== undefined && typeof options.super !== "boolean") {
    throw new TypeError("super must be a boolean");
  }
  for (const [name, pattern] of [["include_patterns", selected.include_patterns], ["exclude_patterns", selected.exclude_patterns]]) {
    if (pattern != null && typeof pattern !== "string") throw new TypeError(`${name} must be a string`);
  }

  const method = selected.method ?? "POST";
  const queryRetries = method === "GET" || selected.action === "brand-scraping";
  const params = new URLSearchParams();
  setIfPresent(params, "token", token);
  setIfPresent(params, "timeout", timeout);
  setIfPresent(params, "geoCode", options.geo_code ?? "US");
  setIfPresent(params, "proxyCountry", options.proxy_country);
  setIfPresent(params, "browserRendering", selected.screenshot ? true : options.browser_rendering);
  setIfPresent(params, "super", options.super ? true : null);
  setIfPresent(params, "useProxy", options.use_proxy === false ? false : null);
  setIfPresent(params, "proxy", options.proxy);
  setIfPresent(params, "html", selected.html);
  setIfPresent(params, "markdown", selected.markdown);
  setIfPresent(params, "waitForSelector", options.wait_for_selector);
  setIfPresent(params, "waitUntil", options.wait_until);
  setIfPresent(params, "warmStart", options.home_page ? true : null);
  setIfPresent(params, "screenshot", selected.screenshot);
  setIfPresent(params, "blockResources", options.block_resources ? true : null);
  setIfPresent(params, "bypassProxy", options.bypass_proxy ? true : null);
  setIfPresent(params, "cookieJar", options.cookie_jar);
  setIfPresent(
    params,
    "headers",
    typeof options.headers === "object" && options.headers !== null
      ? JSON.stringify(options.headers)
      : options.headers,
  );
  setIfPresent(params, "stream", options.stream);
  if (queryRetries) {
    setIfPresent(params, "url", url);
    setIfPresent(params, "maxRetries", maxRetries);
    setIfPresent(params, "tokenCap", options.token_cap);
  }
  setIfPresent(params, "action", selected.action);
  setIfPresent(params, "bundle", selected.bundle);

  const headers = authHeaders(token);
  if (options.discard_token_secret) headers["x-discard-token-secret"] = options.discard_token_secret;
  const body: Record<string, unknown> = { url };
  if (!queryRetries) {
    body.maxRetries = maxRetries;
    if (options.token_cap != null) body.tokenCap = options.token_cap;
  }
  const fields = {
    prompt: selected.prompt,
    agent: selected.agent,
    maxPages: selected.max_pages,
    maxDepth: selected.max_depth,
    limit: selected.limit,
    includePatterns: selected.include_patterns,
    excludePatterns: selected.exclude_patterns,
  };
  for (const [name, value] of Object.entries(fields)) {
    if (value != null) body[name] = value;
  }
  return request<T>(method, `https://api.mrscraper.com/?${params}`,
    method === "GET" ? undefined : body, headers, timeout + 30, token);
}

/** Fetch HTML. Only html=true is sent; other output flags are omitted. */
export async function scraper_html<T = unknown>(
  url: string, options: ScraperOptions = {},
): Promise<MrScraperResponse<T>> {
  return scraper_api<T>(url, options, { html: true });
}

/** Fetch Markdown. Only markdown=true is sent; other output flags are omitted. */
export async function scraper_markdown<T = unknown>(
  url: string, options: ScraperOptions = {},
): Promise<MrScraperResponse<T>> {
  return scraper_api<T>(url, options, { markdown: true });
}

/** Capture a screenshot using GET. Images are returned as Buffer in data. */
export async function get_screenshot<T = unknown>(
  url: string, options: ScreenshotOptions = {},
): Promise<MrScraperResponse<T>> {
  const fullPage = options.full_page === undefined ? true : options.full_page;
  if (typeof fullPage !== "boolean") throw new TypeError("full_page must be a boolean");
  return scraper_api<T>(url, {
    ...options,
    timeout: options.timeout ?? 300,
    wait_until: options.wait_until === undefined ? "domcontentloaded" : options.wait_until,
  }, { method: "GET", screenshot: fullPage ? "full" : true });
}

/** Extract structured JSON with the general agent and html=true. */
export async function scraper_json<T = unknown>(
  url: string, options: ScraperJsonOptions = {},
): Promise<MrScraperResponse<T>> {
  return scraper_api<T>(url, options, {
    html: true, agent: "general", prompt: options.prompt ?? "Extract all data as complete as possible.",
  });
}

/** Extract entries across multiple pages using the listing agent. */
export async function scraper_multiple_page<T = unknown>(
  url: string, options: ScraperMultiplePageOptions = {},
): Promise<MrScraperResponse<T>> {
  return scraper_api<T>(url, options, {
    agent: "listing", prompt: options.prompt ?? "Extract all entry data as complete as possible.",
    max_pages: options.max_pages ?? 3,
  });
}

/** Discover URLs with the map agent; pattern strings are preserved unchanged. */
export async function scraper_sitemap<T = unknown>(
  url: string, options: ScraperSitemapOptions = {},
): Promise<MrScraperResponse<T>> {
  return scraper_api<T>(url, options, {
    agent: "map", max_depth: options.max_depth ?? 2, max_pages: options.max_pages ?? 3,
    limit: options.limit ?? 1000, include_patterns: options.include_patterns,
    exclude_patterns: options.exclude_patterns,
  });
}

/** Start a brand-scraping job; use the returned job ID with get_brand. */
export async function scrape_brand<T = unknown>(
  url: string, options: ScrapeBrandOptions = {},
): Promise<MrScraperResponse<T>> {
  return scraper_api<T>(url, options, { action: "brand-scraping", bundle: options.bundle ?? "clean" });
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

function normalizeSerpInput(input: string): {
  query: string;
  region: string | null;
  language: string | null;
  page: number | null;
} {
  const value = input.trim();
  if (!value) throw new TypeError("A search query is required");
  if (!/^https?:\/\//i.test(value)) {
    return { query: value, region: null, language: null, page: null };
  }
  const parsed = new URL(value);
  const query = (parsed.searchParams.get("q") ?? "").trim();
  if (!query) throw new TypeError("Search URL must contain a q parameter");
  const startValue = (parsed.searchParams.get("start") ?? "0").trim();
  const start = /^[+-]?\d+$/.test(startValue) ? Number(startValue) : 0;
  return {
    query,
    region: parsed.searchParams.get("gl"),
    language: parsed.searchParams.get("hl"),
    page: start > 0 ? Math.floor(start / 10) + 1 : null,
  };
}

/** Search the web to retrieve real-time search results, including relevant website URLs, titles, descriptions, and related questions based on a given query. */
export async function web_search<T = unknown>(
  url: string,
  options: WebSearchOptions = {},
): Promise<MrScraperResponse<T>> {
  const token = requireToken(options.token);
  const format = options.format ?? "json";
  if (format !== "json" && format !== "html") {
    throw new TypeError("format must be 'json' or 'html'");
  }
  if (options.page != null && (!Number.isInteger(options.page) || options.page < 1)) {
    throw new RangeError("page must be a positive integer");
  }
  const timeout = options.timeout ?? 600;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new RangeError("timeout must be greater than 0 seconds");
  }
  const normalized = normalizeSerpInput(url);
  const body: Record<string, unknown> = {
    query: normalized.query,
    format: (options.raw ?? true) ? "html" : format,
    renderJs: Boolean(options.render_js ?? false),
  };
  const region = options.region || normalized.region;
  const language = options.language || normalized.language;
  const page = options.page || normalized.page;
  if (region != null) body.region = region;
  if (language != null) body.language = language;
  if (page != null) body.page = page;

  return request<T>(
    "POST",
    "https://sync.scraper.mrscraper.com/api/google/serp/v2/sync",
    body,
    authHeaders(token),
    timeout,
    token,
  );
}
