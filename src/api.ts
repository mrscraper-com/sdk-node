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

/** Page controls shared by HTML, Markdown, screenshots, and JSON extraction. */
export interface PageOptions {
  /** API key used to authenticate the request. */
  token?: string;
  /** Maximum seconds to wait for the scrape, from 1 to 330. The HTTP request allows 30 additional seconds. */
  timeout?: number;
  /** CSS selector or text to wait for on the page before returning the result, up to 500 characters. */
  waitForSelector?: string;
  /** Two-letter country code to load the page from, sent in lowercase. */
  geoCode?: string;
  /** Return a cached result of the same request when it is newer than the selected age. A cached result costs the same tokens as the original scrape. */
  maxAge?: number;
  /** Maximum number of retries, as a nonnegative integer. Omit this parameter for no limit. */
  maxRetries?: number;
}
/** Loading controls accepted by HTML, Markdown, and JSON extraction. */
export interface LoadingOptions {
  /** Whether to load the page in a browser: true always does and false never does. Omit it to load the page without a browser first and switch to a browser automatically if the request is blocked. */
  browserRendering?: boolean;
  /** Whether to open the site's home page first to warm the session before loading the target URL. */
  warmStart?: boolean;
  /** Whether to block images, fonts, and stylesheets while loading the page. */
  blockResources?: boolean;
}
/** Screenshot area: full, top, or a WIDTHxHEIGHT viewport with an optional -ZOOM percent. */
export type ScreenshotArea =
  | "full"
  | "top"
  | `${number}x${number}`
  | `${number}x${number}-${number}`;
/** Scrape HTML screenshot: false for none, or a screenshot area. */
export type ScreenshotCapture = false | ScreenshotArea;
export interface HtmlOptions extends PageOptions, LoadingOptions {
  /** Scraper action that routes the request or simply flags it, useful for separating analytics per domain. */
  action?: string;
  /** Screenshot to capture with the HTML: false for none, full for the entire page, top for the first viewport, or a WIDTHxHEIGHT viewport from 100 to 3840 pixels with an optional -ZOOM percent from 25 to 300, such as 1280x800 or 1920x1080-75. Setting a screenshot also sends browserRendering=true. */
  screenshot?: ScreenshotCapture;
}
export interface MarkdownOptions extends PageOptions, LoadingOptions {
  /** Scraper action that routes the request or simply flags it, useful for separating analytics per domain. */
  action?: string;
}
export interface ScreenshotOptions extends PageOptions {
  /** Screenshot area to capture: full for the entire scroll height, top for the first viewport, or a WIDTHxHEIGHT viewport from 100 to 3840 pixels with an optional -ZOOM percent from 25 to 300, such as 1280x800 or 1920x1080-75. */
  screenshot?: ScreenshotArea;
}
export interface JsonOptions extends PageOptions, LoadingOptions {
  /** Instructions describing the data to extract. Append Json Schema: and a JSON schema to shape the output. */
  prompt?: string;
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

type Params = Record<string, string | number | boolean>;
type Fields = Record<string, string | number | boolean | undefined>;

const MAX_TIMEOUT_SECONDS = 330;
const MAX_SELECTOR_LENGTH = 500;
// Seven days, the oldest cached result the Scraper API serves.
const MAX_CACHE_AGE_MS = 604800000;
const SCREENSHOT_VIEWPORT = /^(\d{3,4})x(\d{3,4})(?:-(\d{2,3}))?$/;

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
function optionalText(name: string, value: string | undefined) {
  return value === undefined ? undefined : text(name, value);
}
function selector(value: string | undefined): string | undefined {
  const result = optionalText("waitForSelector", value);
  if (result !== undefined && [...result].length > MAX_SELECTOR_LENGTH)
    throw new RangeError(
      `waitForSelector must be at most ${MAX_SELECTOR_LENGTH} characters`,
    );
  return result;
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
/** Whether a value is full, top, or a WIDTHxHEIGHT viewport with an optional -ZOOM. */
function isScreenshotArea(value: unknown): value is ScreenshotArea {
  if (value === "full" || value === "top") return true;
  const match =
    typeof value === "string" ? SCREENSHOT_VIEWPORT.exec(value) : null;
  if (!match) return false;
  const width = Number(match[1]);
  const height = Number(match[2]);
  const zoom = match[3] === undefined ? 100 : Number(match[3]);
  return (
    width >= 100 &&
    width <= 3840 &&
    height >= 100 &&
    height <= 3840 &&
    zoom >= 25 &&
    zoom <= 300
  );
}
const SCREENSHOT_AREA_HINT =
  "WIDTHxHEIGHT from 100 to 3840 pixels with an optional -ZOOM from 25 to 300, such as 1280x800 or 1920x1080-75";
/** Scrape HTML screenshot: false, full, top, or a custom viewport. */
function screenshotCapture(value: ScreenshotCapture): ScreenshotCapture {
  if (value === false || isScreenshotArea(value)) return value;
  throw new TypeError(
    `screenshot must be false, full, top, or ${SCREENSHOT_AREA_HINT}`,
  );
}
/** Get screenshot area: full, top, or a custom viewport. */
function screenshotArea(value: ScreenshotArea): ScreenshotArea {
  if (isScreenshotArea(value)) return value;
  throw new TypeError(`screenshot must be full, top, or ${SCREENSHOT_AREA_HINT}`);
}
/** Drop omitted fields; explicit false and 0 are sent. */
function compact(fields: Fields): Params {
  const params: Params = {};
  for (const [key, value] of Object.entries(fields))
    if (value !== undefined) params[key] = value;
  return params;
}
interface PageFields {
  url: string;
  timeout: number;
  waitForSelector?: string;
  geoCode?: string;
  maxAge: number;
  maxRetries?: number;
}
interface LoadingFields {
  browserRendering?: boolean;
  warmStart?: boolean;
  blockResources?: boolean;
}
function pageFields(url: string, options: PageOptions): PageFields {
  const {
    timeout = 300,
    waitForSelector,
    geoCode,
    maxAge = 0,
    maxRetries,
  } = options;
  return {
    url: pageUrl(url),
    timeout: integer("timeout", timeout, 1, MAX_TIMEOUT_SECONDS),
    waitForSelector: selector(waitForSelector),
    geoCode: geoCode === undefined ? undefined : country("geoCode", geoCode),
    maxAge: integer("maxAge", maxAge, 0, MAX_CACHE_AGE_MS),
    maxRetries:
      maxRetries === undefined
        ? undefined
        : integer("maxRetries", maxRetries, 0),
  };
}
function loadingFields(options: LoadingOptions): LoadingFields {
  return {
    browserRendering:
      options.browserRendering === undefined
        ? undefined
        : boolean("browserRendering", options.browserRendering),
    warmStart: boolean("warmStart", options.warmStart ?? false),
    blockResources: boolean("blockResources", options.blockResources ?? false),
  };
}
/** Shared page and loading fields in the documented request order. */
function sharedFields(
  page: PageFields,
  loading: LoadingFields = {},
  action?: string,
): Fields {
  return {
    browserRendering: loading.browserRendering,
    timeout: page.timeout,
    warmStart: loading.warmStart,
    blockResources: loading.blockResources,
    waitForSelector: page.waitForSelector,
    action,
    geoCode: page.geoCode,
    // Results are always saved to the dashboard; saveResult is not an option.
    saveResult: true,
    maxAge: page.maxAge,
    maxRetries: page.maxRetries,
  };
}
function endpoint(params: Params): string {
  const result = new URL(
    process.env.MRSCRAPER_FETCH_BASE_URL || "https://api.mrscraper.com",
  );
  for (const [key, value] of Object.entries(params))
    result.searchParams.set(key, String(value));
  return result.toString();
}
async function get<T>(
  params: Params,
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
  const page = pageFields(url, options);
  const loading = loadingFields(options);
  const screenshot = screenshotCapture(options.screenshot ?? false);
  // A screenshot needs a rendered page, so it always sends browserRendering=true.
  if (screenshot !== false) loading.browserRendering = true;
  const params = compact({
    url: page.url,
    html: true,
    markdown: false,
    ...sharedFields(page, loading, optionalText("action", options.action)),
    screenshot,
  });
  return get<T>(params, options, page.timeout + 30);
}
/** Retrieve a page as clean Markdown. Browser rendering is optional.
 * @param url Absolute HTTP or HTTPS URL of the page to process.
 * @param options Service options and authentication.
 */
export async function scrapeMarkdown<T = PageData>(
  url: string,
  options: MarkdownOptions = {},
): Promise<MrScraperResponse<T>> {
  const page = pageFields(url, options);
  const params = compact({
    url: page.url,
    markdown: true,
    html: false,
    screenshot: false,
    ...sharedFields(
      page,
      loadingFields(options),
      optionalText("action", options.action),
    ),
  });
  return get<T>(params, options, page.timeout + 30);
}
/** Capture a base64 PNG screenshot of the full page, the first viewport, or a custom viewport. Browser rendering is always enabled.
 * @param url Absolute HTTP or HTTPS URL of the page to process.
 * @param options Service options and authentication.
 */
export async function getScreenshot<T = PageData>(
  url: string,
  options: ScreenshotOptions = {},
): Promise<MrScraperResponse<T>> {
  const page = pageFields(url, options);
  const params = compact({
    url: page.url,
    screenshot: screenshotArea(
      options.screenshot === undefined ? "full" : options.screenshot,
    ),
    html: false,
    markdown: false,
    ...sharedFields(page, { browserRendering: true }),
  });
  return get<T>(params, options, page.timeout + 30);
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
  const html = boolean("html", options.html ?? true);
  const screenshot = boolean("screenshot", options.screenshot ?? false);
  const page = pageFields(url, options);
  const params = compact({
    url: page.url,
    prompt,
    agent: "general",
    html,
    ...sharedFields(page, loadingFields(options)),
    screenshot,
  });
  const token = requireToken(options.token);
  const timeout = page.timeout + 30;
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
    compact({
      action: "websearch",
      query: value,
      country:
        options.country === undefined
          ? undefined
          : country("country", options.country),
      numResults: integer("numResults", options.numResults ?? 10, 10, 100),
    }),
    options,
    120,
  );
}
