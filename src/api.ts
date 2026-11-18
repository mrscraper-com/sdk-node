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

export type WaitUntil =
  "domcontentloaded" | "load" | "networkidle0" | "networkidle2";
export interface PageOptions {
  token?: string;
  timeout?: number;
  geoCode?: string;
  proxyCountry?: string;
  superMode?: boolean;
  waitUntil?: WaitUntil;
  proxy?: string;
  maxRetries?: number;
  saveResult?: boolean;
}
export interface LoadingOptions {
  blockResources?: boolean;
  waitForSelector?: string;
  returnCookie?: boolean;
}
export interface HtmlOptions extends PageOptions, LoadingOptions {
  browserRendering?: boolean;
}
export interface MarkdownOptions extends HtmlOptions {
  html?: boolean;
}
export interface ScreenshotOptions extends PageOptions, LoadingOptions {
  screenshot?: "full" | "top";
  html?: boolean;
  markdown?: boolean;
}
export interface JsonOptions extends PageOptions {
  prompt?: string;
  browserRendering?: boolean;
  html?: boolean;
  screenshot?: boolean;
}
export interface BrandOptions {
  token?: string;
}
export interface WebSearchOptions {
  token?: string;
  country?: string;
  numResults?: number;
  /** Local HTTP deadline in seconds. Defaults to 120. */
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
export type PageData =
  | string
  | {
      html?: string;
      markdown?: string;
      screenshot?: string;
      [key: string]: unknown;
    };
export const DEFAULT_JSON_PROMPT = "Extract all data as complete as possible.";
// The helpers below are exported for the SDK's internal modules only; the
// package entry point (index.ts) does not re-export them.

export function requireToken(explicitToken?: string): string {
  const token =
    explicitToken ||
    process.env.MRSCRAPER_API_TOKEN ||
    process.env.MRSCRAPER_API_KEY ||
    "";
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
      throw new MrScraperError(
        message.replaceAll(token, "[REDACTED]"),
        response.status,
      );
    }
    const contentType = (response.headers.get("content-type") ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    const isText =
      !contentType ||
      contentType.startsWith("text/") ||
      [
        "application/xml",
        "application/xhtml+xml",
        "application/javascript",
      ].includes(contentType);
    const data =
      contentType === "application/json" || contentType.endsWith("+json")
        ? await response.json()
        : isText
          ? await response.text()
          : Buffer.from(await response.arrayBuffer());
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
    `${(process.env.MRSCRAPER_API_BASE_URL || "https://api.app.mrscraper.com/api/v1").replace(/\/+$/, "")}/subscription-accounts`,
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
    throw new MrScraperError(
      "Account response must contain an object",
      response.status_code,
    );
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
      usage_percent:
        tokenLimit > 0
          ? Number(((tokenUsage / tokenLimit) * 100).toFixed(2))
          : 0,
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
    headers: Object.fromEntries(
      Object.entries(response.headers).filter(
        ([key]) =>
          ![
            "authorization",
            "proxy-authorization",
            "set-cookie",
            "set-cookie2",
            "x-api-token",
          ].includes(key.toLowerCase()),
      ),
    ),
  };
}

function integer(
  name: string,
  value: number,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new RangeError(`${name} must be an integer from ${min} to ${max}`);
  return value;
}
function text(name: string, value: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function pageUrl(value: string): string {
  let parsed: URL | undefined;
  try {
    parsed = new URL(value);
  } catch {
    /* Consistent error below. */
  }
  if (!parsed || !["http:", "https:"].includes(parsed.protocol))
    throw new TypeError("url must be an absolute HTTP or HTTPS URL");
  return value;
}
function country(name: string, value: string): string {
  if (typeof value !== "string" || !/^[a-z]{2}$/i.test(value))
    throw new TypeError(`${name} must be a two-letter country code`);
  return value.toLowerCase();
}
function boolean(name: string, value: boolean): boolean {
  if (typeof value !== "boolean")
    throw new TypeError(`${name} must be a boolean`);
  return value;
}
function pageParams(
  url: string,
  options: PageOptions,
): Record<string, string | number | boolean> {
  const {
    timeout = 300,
    geoCode = "us",
    proxyCountry = "us",
    superMode = false,
    waitUntil = "domcontentloaded",
    proxy,
    maxRetries,
    saveResult = false,
  } = options;
  if (
    !["domcontentloaded", "load", "networkidle0", "networkidle2"].includes(
      waitUntil,
    )
  )
    throw new TypeError("Invalid waitUntil event");
  const params: Record<string, string | number | boolean> = {
    url: pageUrl(url),
    timeout: integer("timeout", timeout, 1, 300),
    geoCode: country("geoCode", geoCode),
    proxyCountry: country("proxyCountry", proxyCountry),
    super: boolean("superMode", superMode),
    waitUntil,
    saveResult: boolean("saveResult", saveResult),
  };
  if (proxy !== undefined) params.proxy = text("proxy", proxy);
  if (maxRetries !== undefined)
    params.maxRetries = integer("maxRetries", maxRetries, 0);
  return params;
}
function loadingParams(
  options: LoadingOptions,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {
    blockResources: boolean("blockResources", options.blockResources ?? false),
    returnCookie: boolean("returnCookie", options.returnCookie ?? false),
  };
  if (options.waitForSelector !== undefined)
    params.waitForSelector = text("waitForSelector", options.waitForSelector);
  return params;
}
function endpoint(params: Record<string, string | number | boolean>): string {
  const result = new URL(
    process.env.MRSCRAPER_FETCH_BASE_URL || "https://api.mrscraper.com",
  );
  for (const [key, value] of Object.entries(params))
    result.searchParams.set(key, String(value));
  return result.toString();
}
async function get<T>(
  params: Record<string, string | number | boolean>,
  options: BrandOptions,
  timeout: number,
): Promise<MrScraperResponse<T>> {
  const token = requireToken(options.token);
  return request<T>(
    "GET",
    endpoint(params),
    undefined,
    authHeaders(token),
    timeout,
    token,
  );
}
/** Retrieve raw HTML using the CLI's page and loading defaults. */
export async function scrapeHtml<T = PageData>(
  url: string,
  options: HtmlOptions = {},
): Promise<MrScraperResponse<T>> {
  const params: Record<string, string | number | boolean> = {
    ...pageParams(url, options),
    ...loadingParams(options),
    browserRendering: boolean(
      "browserRendering",
      options.browserRendering ?? false,
    ),
    html: true,
    markdown: false,
    screenshot: false,
  };
  return get<T>(params, options, Number(params.timeout) + 30);
}
/** Retrieve Markdown. html=true also returns HTML and forces browser rendering. */
export async function scrapeMarkdown<T = PageData>(
  url: string,
  options: MarkdownOptions = {},
): Promise<MrScraperResponse<T>> {
  const html = boolean("html", options.html ?? false);
  const browserRendering = boolean(
    "browserRendering",
    options.browserRendering ?? false,
  );
  const params: Record<string, string | number | boolean> = {
    ...pageParams(url, options),
    ...loadingParams(options),
    browserRendering: html || browserRendering,
    html,
    markdown: true,
    screenshot: false,
  };
  return get<T>(params, options, Number(params.timeout) + 30);
}
/** Capture a base64 full-page or top-viewport screenshot with browser rendering enabled. */
export async function getScreenshot<T = PageData>(
  url: string,
  options: ScreenshotOptions = {},
): Promise<MrScraperResponse<T>> {
  const screenshot = options.screenshot ?? "full";
  if (!["full", "top"].includes(screenshot))
    throw new TypeError("screenshot must be full or top");
  const params: Record<string, string | number | boolean> = {
    ...pageParams(url, options),
    ...loadingParams(options),
    browserRendering: true,
    screenshot,
    html: boolean("html", options.html ?? true),
    markdown: boolean("markdown", options.markdown ?? false),
  };
  return get<T>(params, options, Number(params.timeout) + 30);
}
/** Extract JSON with agent=general; prompts over the 8 KB URL limit use POST. */
export async function scrapeJson<T = unknown>(
  url: string,
  options: JsonOptions = {},
): Promise<MrScraperResponse<T>> {
  const prompt = options.prompt ?? DEFAULT_JSON_PROMPT;
  text("prompt", prompt);
  const params: Record<string, string | number | boolean> = {
    ...pageParams(url, options),
    browserRendering: boolean(
      "browserRendering",
      options.browserRendering ?? false,
    ),
    html: boolean("html", options.html ?? false),
    screenshot: boolean("screenshot", options.screenshot ?? false),
    agent: "general",
    prompt,
  };
  const token = requireToken(options.token);
  const timeout = Number(params.timeout) + 30;
  const getUrl = endpoint(params);
  if (getUrl.length <= 8000)
    return request<T>(
      "GET",
      getUrl,
      undefined,
      authHeaders(token),
      timeout,
      token,
    );
  const { url: target, prompt: instruction, agent, ...query } = params;
  return request<T>(
    "POST",
    endpoint(query),
    { url: target, prompt: instruction, agent },
    authHeaders(token),
    timeout,
    token,
  );
}
/** Extract a website's brand as JSON (bundle=none). */
export async function scrapeBrand<T = unknown>(
  url: string,
  options: BrandOptions = {},
): Promise<MrScraperResponse<T>> {
  return get<T>(
    { action: "brand-scraping", url: pageUrl(url), bundle: "none" },
    options,
    120,
  );
}
/** Search the web for ranked titles, URLs, descriptions, and sources. */
export async function webSearch<T = WebSearchResponse>(
  query: string,
  options: WebSearchOptions = {},
): Promise<MrScraperResponse<T>> {
  const value = text("query", query);
  if ([...value].length > 1000)
    throw new RangeError("query must be 1 to 1000 characters");
  const timeout = options.timeout ?? 120;
  if (!Number.isFinite(timeout) || timeout <= 0)
    throw new RangeError("timeout must be greater than 0 seconds");
  return get<T>(
    {
      action: "websearch",
      query: value,
      country: country("country", options.country ?? "us"),
      numResults: integer("numResults", options.numResults ?? 10, 10, 100),
    },
    options,
    timeout,
  );
}
