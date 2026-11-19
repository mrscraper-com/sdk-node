import {
  status,
  scrapeHtml,
  scrapeMarkdown,
  getScreenshot,
  scrapeBrand,
  scrapeJson,
  webSearch,
} from "../src/index.js";
import type {
  MrScraperResponse,
  PageData,
  WebSearchResponse,
} from "../src/index.js";
const a: Promise<MrScraperResponse<unknown>> = status();
const h: Promise<MrScraperResponse<PageData>> = scrapeHtml(
  "https://example.com",
  { super: true, maxRetries: 0, returnCookie: true },
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

// @ts-expect-error status has no service timeout option
void status({ timeout: 30 });
// @ts-expect-error search transport deadline is fixed
void webSearch("test", { timeout: 120 });
// @ts-expect-error use the CLI's super name
void scrapeHtml("https://example.com", { superMode: true });
