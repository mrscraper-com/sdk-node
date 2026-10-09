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

export interface FetchContentOptions {
  /** Overrides MRSCRAPER_API_TOKEN for this call. */
  token?: string;
  html?: boolean;
  markdown?: boolean;
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
  home_page?: boolean;
  screenshot?: boolean;
  bypass_proxy?: boolean;
  cookie_jar?: string | null;
  /** Headers forwarded to the target site, not the API request. */
  headers?: Record<string, string> | string | null;
  max_retries?: number;
  token_cap?: number | null;
  stream?: boolean | null;
  discard_token_secret?: string;
}

export interface GoogleSerpOptions {
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

async function post<T>(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  timeoutSeconds: number,
  token: string,
): Promise<MrScraperResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 401) {
      throw new MrScraperError(
        "Unauthorized or invalid token. Please go to https://app.mrscraper.com to get your token.",
        401,
      );
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      throw new MrScraperError(message.replaceAll(token, "[REDACTED]"), response.status);
    }
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

/** Fetch a page through the MrScraper API. Options mirror Python's fetch_content. */
export async function fetch_content<T = unknown>(
  url: string,
  options: FetchContentOptions = {},
): Promise<MrScraperResponse<T>> {
  const token = requireToken(options.token);
  const timeout = options.timeout ?? 120;
  const maxRetries = options.max_retries ?? 3;
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 300) {
    throw new RangeError("timeout must be between 1 and 300 seconds");
  }
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new RangeError("max_retries must be greater than or equal to 0");
  }
  if (options.token_cap != null && (!Number.isInteger(options.token_cap) || options.token_cap < 0)) {
    throw new RangeError("token_cap must be greater than or equal to 0");
  }
  if (options.screenshot !== undefined && typeof options.screenshot !== "boolean") {
    throw new TypeError("screenshot must be a boolean");
  }
  if (options.super !== undefined && typeof options.super !== "boolean") {
    throw new TypeError("super must be a boolean");
  }

  const params = new URLSearchParams();
  setIfPresent(params, "token", token);
  setIfPresent(params, "timeout", timeout);
  setIfPresent(params, "geoCode", options.geo_code ?? "US");
  setIfPresent(params, "proxyCountry", options.proxy_country);
  setIfPresent(params, "browserRendering", options.screenshot ? true : options.browser_rendering);
  setIfPresent(params, "super", options.super ? true : null);
  setIfPresent(params, "useProxy", options.use_proxy === false ? false : null);
  setIfPresent(params, "proxy", options.proxy);
  setIfPresent(params, "html", options.html ?? true);
  setIfPresent(params, "markdown", options.markdown ?? false);
  setIfPresent(params, "waitForSelector", options.wait_for_selector);
  setIfPresent(params, "warmStart", options.home_page ? true : null);
  setIfPresent(params, "screenshot", options.screenshot ? true : null);
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

  const headers = authHeaders(token);
  if (options.discard_token_secret) {
    headers["x-discard-token-secret"] = options.discard_token_secret;
  }
  const body: Record<string, unknown> = { url, maxRetries };
  if (options.token_cap != null) body.tokenCap = options.token_cap;

  return post<T>(`https://api.mrscraper.com/?${params}`, body, headers, timeout + 30, token);
}

function normalizeSerpInput(input: string): {
  query: string;
  region: string | null;
  language: string | null;
  page: number | null;
} {
  const value = input.trim();
  if (!value) throw new TypeError("A Google search query or URL is required");
  if (!/^https?:\/\//i.test(value)) {
    return { query: value, region: null, language: null, page: null };
  }
  const parsed = new URL(value);
  const query = (parsed.searchParams.get("q") ?? "").trim();
  if (!query) throw new TypeError("Google search URL must contain a q parameter");
  const startValue = (parsed.searchParams.get("start") ?? "0").trim();
  const start = /^[+-]?\d+$/.test(startValue) ? Number(startValue) : 0;
  return {
    query,
    region: parsed.searchParams.get("gl"),
    language: parsed.searchParams.get("hl"),
    page: start > 0 ? Math.floor(start / 10) + 1 : null,
  };
}

/** Fetch Google search results. Accepts query text or a Google search URL. */
export async function google_serp<T = unknown>(
  url: string,
  options: GoogleSerpOptions = {},
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

  return post<T>(
    "https://sync.scraper.mrscraper.com/api/google/serp/v2/sync",
    body,
    authHeaders(token),
    timeout,
    token,
  );
}
