import {
  account,
  scrapeHtml,
  scrapeMarkdown,
  getScreenshot,
  scrapeBrand,
  scrapeJson,
  webSearch,
} from "../src/index.js";
import type {
  MrScraperResponse,
  AccountSummary,
  PageData,
  WebSearchResponse,
} from "../src/index.js";
const a: Promise<MrScraperResponse<AccountSummary>> = account();
const h: Promise<MrScraperResponse<PageData>> = scrapeHtml(
  "https://example.com",
  { superMode: true, maxRetries: 0, returnCookie: true },
);
const w: Promise<MrScraperResponse<WebSearchResponse>> = webSearch("test", {
  country: "us",
  numResults: 20,
});
void [a, h, w];
void scrapeMarkdown("https://example.com", { html: true });
void getScreenshot("https://example.com", { screenshot: "top" });
void scrapeBrand("https://example.com");
void scrapeJson<{ title: string }>("https://example.com", {
  prompt: "Extract title",
});
// @ts-expect-error JSON does not expose loading controls
void scrapeJson("https://example.com", { blockResources: true });
// @ts-expect-error screenshots use full or top
void getScreenshot("https://example.com", { screenshot: true });
// @ts-expect-error camelCase options
void webSearch("test", { num_results: 10 });
// @ts-expect-error brand accepts only authentication
void scrapeBrand("https://example.com", { saveResult: true });
