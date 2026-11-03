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

/** Options for `scraper_api`. At least one of html, markdown, or screenshot must be true. */
export interface ScraperApiOptions {
  /** Overrides MRSCRAPER_API_TOKEN for this call. */
  token?: string;
  /** Return the page HTML. Defaults to true. */
  html?: boolean;
  /** Return the page as Markdown. Defaults to false. */
  markdown?: boolean;
  /** Capture a screenshot. Defaults to false; true also enables browser rendering. */
  screenshot?: boolean;
  /** Page timeout in seconds, from 1 to 300. Defaults to 120. */
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

/**
 * `scraper_api` data: an HTML string when only HTML is requested, otherwise an
 * object with an entry for each requested output (the screenshot is base64).
 */
export type ScraperApiData = string | {
  html?: string;
  markdown?: string;
  screenshot?: string;
  [key: string]: unknown;
};

export interface WebSearchOptions {
  /** Overrides MRSCRAPER_API_TOKEN for this call. */
  token?: string;
  /** Country code for localized results, such as "us". Omitted when unset. */
  country?: string | null;
  /** Number of results, an integer from 10 to 100. Defaults to 10. */
  num_results?: number;
  /** HTTP request timeout in seconds. Defaults to 600. */
  timeout?: number;
}

export interface WebSearchResult {
  rank: number;
  title: string;
  url: string;
  description: string;
  source: string;
}

export interface WebSearchResponse {
  success: boolean;
  message: string;
  data: WebSearchResult[];
}

const API_URL = "https://api.mrscraper.com";
const MIN_SEARCH_RESULTS = 10;
const MAX_SEARCH_RESULTS = 100;

// The helpers below are exported for the SDK's internal modules only; the
// package entry point (index.ts) does not re-export them.

export function requireToken(explicitToken?: string): string {
  const token = explicitToken || process.env.MRSCRAPER_API_TOKEN || "";
  if (!token.trim()) {
    throw new MrScraperError(
      "API token is not set. Pass token in the options or set MRSCRAPER_API_TOKEN. Get your token at https://app.mrscraper.com.",
    );
  }
  return token;
}

export function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    accept: "application/json",
    Authorization: `Bearer ${token}`,
    "x-api-token": token,
  };
}

export function setIfPresent(params: URLSearchParams, key: string, value: unknown): void {
  if (value !== null && value !== undefined) {
    params.set(key, typeof value === "boolean" ? String(value) : String(value));
  }
}

export async function request<T>(
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

/**
 * Return account identity, subscription, quota, and rate limits for the API
 * token. API tokens, billing identifiers, and sensitive headers are excluded.
 */
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

/** Shared page, browser, proxy, and retry controls without output flags. */
export type ScrapeOptions = Omit<ScraperApiOptions, "html" | "markdown" | "screenshot">;

/** Output, method, and agent selection made by the SDK rather than by caller options. */
export interface ScrapeRequest {
  method?: "GET" | "POST";
  html?: boolean;
  markdown?: boolean;
  screenshot?: true | "full";
  agent?: "general" | "listing" | "map";
  prompt?: string;
  max_pages?: number;
  max_depth?: number;
  limit?: number;
  include_patterns?: string | null;
  exclude_patterns?: string | null;
  action?: "brand-scraping";
  bundle?: "clean" | "full" | "none";
}

function validateInteger(name: string, value: number | undefined, minimum: number): void {
  if (value !== undefined && (!Number.isInteger(value) || value < minimum)) {
    throw new RangeError(`${name} must be an integer greater than or equal to ${minimum}`);
  }
}

/**
 * Build and send a scraping request for `scraper_api` and the internal
 * format-specific helpers. GET and brand requests carry the URL and retry
 * controls in the query; other POSTs carry them in the JSON body.
 */
export async function scrape<T>(
  url: string,
  options: ScrapeOptions,
  selected: ScrapeRequest,
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
  return request<T>(method, `${API_URL}/?${params}`,
    method === "GET" ? undefined : body, headers, timeout + 30, token);
}

/**
 * Fetch a public web page as rendered HTML, Markdown, screenshot, or a combination.
 *
 * Sends a GET request; the target URL, page options, and retry controls are all
 * query parameters. HTML alone returns a string; any combination with Markdown
 * or a screenshot returns an object such as `{ html, markdown, screenshot }`,
 * where the screenshot is base64. At least one output must be true.
 */
export async function scraper_api<T = ScraperApiData>(
  url: string,
  options: ScraperApiOptions = {},
): Promise<MrScraperResponse<T>> {
  const { html = true, markdown = false, screenshot = false, ...rest } = options;
  for (const [name, value] of [["html", html], ["markdown", markdown], ["screenshot", screenshot]] as const) {
    if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean`);
  }
  if (!html && !markdown && !screenshot) {
    throw new TypeError("At least one of html, markdown, or screenshot must be true");
  }
  return scrape<T>(url, rest, {
    method: "GET",
    html,
    markdown,
    screenshot: screenshot ? true : undefined,
  });
}

/**
 * Search the web for real-time results: website URLs, titles, and descriptions.
 *
 * Sends `{ action: "websearch", query, country, numResults }` as a JSON POST
 * to the MrScraper API. `country` is omitted when unset.
 */
export async function web_search<T = WebSearchResponse>(
  query: string,
  options: WebSearchOptions = {},
): Promise<MrScraperResponse<T>> {
  const token = requireToken(options.token);
  if (typeof query !== "string" || !query.trim()) {
    throw new TypeError("A search query is required");
  }
  const country = options.country;
  if (country != null && (typeof country !== "string" || !country.trim())) {
    throw new TypeError("country must be a non-empty string");
  }
  const numResults = options.num_results ?? MIN_SEARCH_RESULTS;
  if (!Number.isInteger(numResults) || numResults < MIN_SEARCH_RESULTS || numResults > MAX_SEARCH_RESULTS) {
    throw new RangeError(
      `num_results must be an integer from ${MIN_SEARCH_RESULTS} to ${MAX_SEARCH_RESULTS}`,
    );
  }
  const timeout = options.timeout ?? 600;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new RangeError("timeout must be greater than 0 seconds");
  }
  const body: Record<string, unknown> = { action: "websearch", query: query.trim() };
  if (country != null) body.country = country.trim();
  body.numResults = numResults;
  return request<T>("POST", API_URL, body, authHeaders(token), timeout, token);
}
