import { account, scraper_api, web_search } from "../src/index.js";
import type {
  AccountSummary, MrScraperResponse, ScraperApiData, ScraperApiOptions,
  WebSearchOptions, WebSearchResponse,
} from "../src/index.js";

const options: ScraperApiOptions = {
  token: "test", html: true, markdown: true, screenshot: true,
  browser_rendering: false, wait_until: "networkidle", headers: { "accept-language": "en-US" },
};
const page: Promise<MrScraperResponse<ScraperApiData>> = scraper_api("https://example.com", options);
void page;
void scraper_api<string>("https://example.com");

const search: WebSearchOptions = { country: "us", num_results: 10, timeout: 60 };
const results: Promise<MrScraperResponse<WebSearchResponse>> = web_search("query", search);
void results.then((result) => result.data.data.map((item) => [item.rank, item.title, item.url, item.description, item.source]));

const summary: Promise<MrScraperResponse<AccountSummary>> = account({ timeout: 30 });
void summary;

// @ts-expect-error Output flags are booleans.
void scraper_api("https://example.com", { screenshot: "full" });
// @ts-expect-error The previous search options were removed.
void web_search("query", { region: "us" });
// @ts-expect-error num_results is a number.
void web_search("query", { num_results: "10" });

// @ts-expect-error Format-specific helpers are internal.
import { scraper_html } from "../src/index.js";
void scraper_html;
// @ts-expect-error Format-specific helpers are internal.
import { get_brand } from "../src/index.js";
void get_brand;
// @ts-expect-error Internal option types are not exported.
import type { ScraperOptions } from "../src/index.js";
