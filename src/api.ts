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

export interface StatusOptions {
  /** API key used to authenticate the request. */
  token?: string;
}

export type WaitUntil =
  "domcontentloaded" | "load" | "networkidle0" | "networkidle2";
export interface PageOptions {
  /** API key used to authenticate the request. */
  token?: string;
  /** Page load timeout in seconds, from 1 to 300. The HTTP request allows 30 additional seconds. */
  timeout?: number;
  /** Two-letter country code to load the page from, sent in lowercase. */
  geoCode?: string;
  /** Two-letter country code of the proxy server, sent in lowercase. */
  proxyCountry?: string;
  /** Whether to route the request through real devices. */
  super?: boolean;
  /** Navigation completion event to wait for: domcontentloaded, load, networkidle0, or networkidle2. */
  waitUntil?: WaitUntil;
  /** Custom proxy URL used to load the page. */
  proxy?: string;
  /** Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit. */
  maxRetries?: number;
  /** Whether to save the result to the dashboard Result tab. */
  saveResult?: boolean;
}
export interface LoadingOptions {
  /** Whether to block images, fonts, and stylesheets while loading the page. */
  blockResources?: boolean;
  /** Wait for the page to contain the specified CSS selector before returning the result. */
  waitForSelector?: string;
  /** Whether to include browser session cookies in the response. */
  returnCookie?: boolean;
}
export interface HtmlOptions extends PageOptions, LoadingOptions {
  /** Whether to enable warm start for more reliable scraping, at the cost of additional latency. */
  warmStart?: boolean;
  /** Whether to render the page in a browser before returning the result. */
  browserRendering?: boolean;
}
export interface MarkdownOptions extends HtmlOptions {
  /** Whether to include the page HTML in the response. */
  html?: boolean;
}
export interface ScreenshotOptions extends PageOptions, LoadingOptions {
  /** Screenshot area to capture: full for the entire page or top for the top viewport. */
  screenshot?: "full" | "top";
  /** Whether to include the page HTML in the response. */
  html?: boolean;
  /** Whether to include the page Markdown in the response. */
  markdown?: boolean;
}
export interface JsonOptions extends PageOptions {
  /** Instructions describing the data to extract. Append Json Schema: and a JSON schema to shape the output. */
  prompt?: string;
  /** Whether to render the page in a browser before returning the result. */
  browserRendering?: boolean;
  /** Whether to include the page HTML in the response. */
  html?: boolean;
  /** Whether to include a base64 screenshot in the response. */
  screenshot?: boolean;
}
export interface BrandOptions {
  /** API key used to authenticate the request. */
  token?: string;
}
export interface WebSearchOptions {
  /** API key used to authenticate the request. */
  token?: string;
  /** Two-letter country code to search from, sent in lowercase. */
  country?: string;
  /** Number of search results to request, as an integer from 10 to 100. Fewer results may be returned. */
  numResults?: number;
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

/** Return the raw account status API response without summarizing, redacting body fields, or adding calculated fields.
 * @param options Service options and authentication.
 */
export async function status<T = unknown>(
  options: StatusOptions = {},
): Promise<MrScraperResponse<T>> {
  const token = requireToken(options.token);
  const response = await request<T>(
    "GET",
    `${(process.env.MRSCRAPER_API_BASE_URL || "https://api.app.mrscraper.com/api/v1").replace(/\/+$/, "")}/subscription-accounts`,
    undefined,
    authHeaders(token),
    600,
    token,
  );
  return {
    ...response,
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
    super: superRouting = false,
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
    super: boolean("super", superRouting),
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
/** Retrieve the raw HTML of a page. Browser rendering is optional.
 * @param url Absolute HTTP or HTTPS URL of the page to process.
 * @param options Service options and authentication.
 */
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
    warmStart: boolean("warmStart", options.warmStart ?? false),
    html: true,
    markdown: false,
    screenshot: false,
  };
  return get<T>(params, options, Number(params.timeout) + 30);
}
/** Retrieve a page as Markdown. Including HTML also enables browser rendering and returns both outputs as JSON.
 * @param url Absolute HTTP or HTTPS URL of the page to process.
 * @param options Service options and authentication.
 */
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
    warmStart: boolean("warmStart", options.warmStart ?? false),
    html,
    markdown: true,
    screenshot: false,
  };
  return get<T>(params, options, Number(params.timeout) + 30);
}
/** Capture a base64 screenshot of the full page or top viewport. Browser rendering is always enabled.
 * @param url Absolute HTTP or HTTPS URL of the page to process.
 * @param options Service options and authentication.
 */
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
/** Extract structured JSON from a page using a natural-language prompt. Append Json Schema: and a JSON schema to shape the output.
 * @param url Absolute HTTP or HTTPS URL of the page to process.
 * @param options Service options and authentication.
 */
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
/** Extract a website's colors, typography, logos, and social links as JSON.
 * @param url Absolute HTTP or HTTPS URL of the page to process.
 * @param options Service options and authentication.
 */
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
/** Search the web and return ranked results with titles, URLs, descriptions, and sources.
 * @param query Search query text, trimmed before sending, containing 1 to 1000 characters.
 * @param options Service options and authentication.
 */
export async function webSearch<T = WebSearchResponse>(
  query: string,
  options: WebSearchOptions = {},
): Promise<MrScraperResponse<T>> {
  const value = text("query", query);
  if ([...value].length > 1000)
    throw new RangeError("query must be 1 to 1000 characters");
  return get<T>(
    {
      action: "websearch",
      query: value,
      country: country("country", options.country ?? "us"),
      numResults: integer("numResults", options.numResults ?? 10, 10, 100),
    },
    options,
    120,
  );
}
