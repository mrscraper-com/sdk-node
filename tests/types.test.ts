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
  ScreenshotCapture,
  WebSearchResponse,
} from "../src/index.js";
const a: Promise<MrScraperResponse<unknown>> = status();
const h: Promise<MrScraperResponse<PageData>> = scrapeHtml(
  "https://example.com",
  {
    browserRendering: false,
    timeout: 330,
    warmStart: true,
    blockResources: true,
    waitForSelector: "body",
    action: "analytics",
    geoCode: "gb",
    saveResult: false,
    maxAge: 86400000,
    tokenCap: 50,
    maxRetries: 0,
    screenshot: "1920x1080-75",
  },
);
const w: Promise<MrScraperResponse<WebSearchResponse>> = webSearch("test", {
  country: "us",
  numResults: 20,
});
void [a, h, w];
const captures: ScreenshotCapture[] = [false, "full", "top", "1280x800"];
void captures;
void scrapeMarkdown("https://example.com", { action: "analytics", maxAge: 0 });
void getScreenshot("https://example.com", {
  waitForSelector: "#results",
  geoCode: "de",
  tokenCap: 10,
});
void scrapeBrand("https://example.com");
void scrapeBrand("https://example.com", {
  timeout: 120,
  warmStart: true,
  geoCode: "gb",
});
void scrapeJson<{ title: string }>("https://example.com", {
  prompt: "Extract title",
  html: false,
  screenshot: true,
  warmStart: true,
  blockResources: true,
  waitForSelector: "body",
});
// @ts-expect-error Scrape HTML screenshots are false or a capture string
void scrapeHtml("https://example.com", { screenshot: true });
// @ts-expect-error Scrape JSON screenshots are a boolean
void scrapeJson("https://example.com", { screenshot: "full" });
// @ts-expect-error Get screenshot always captures the full page
void getScreenshot("https://example.com", { screenshot: "top" });
// @ts-expect-error Get screenshot always renders in a browser
void getScreenshot("https://example.com", { browserRendering: false });
// @ts-expect-error Get screenshot has no warm start
void getScreenshot("https://example.com", { warmStart: true });
// @ts-expect-error Markdown has no HTML option
void scrapeMarkdown("https://example.com", { html: true });
// @ts-expect-error JSON extraction has no action
void scrapeJson("https://example.com", { action: "analytics" });
// @ts-expect-error super is not a documented Scraper API field
void scrapeHtml("https://example.com", { super: true });
// @ts-expect-error waitUntil is not a documented Scraper API field
void scrapeHtml("https://example.com", { waitUntil: "load" });
// @ts-expect-error proxyCountry is not a documented Scraper API field
void scrapeHtml("https://example.com", { proxyCountry: "us" });
// @ts-expect-error proxy is not a documented Scraper API field
void scrapeMarkdown("https://example.com", { proxy: "http://proxy" });
// @ts-expect-error returnCookie is not a documented Scraper API field
void scrapeHtml("https://example.com", { returnCookie: true });
// @ts-expect-error camelCase options
void webSearch("test", { num_results: 10 });
// @ts-expect-error brand does not save results
void scrapeBrand("https://example.com", { saveResult: true });
// @ts-expect-error brand has no cache age
void scrapeBrand("https://example.com", { maxAge: 0 });
// @ts-expect-error brand sends bundle=none
void scrapeBrand("https://example.com", { bundle: "full" });
// @ts-expect-error brand warmStart is strictly boolean
void scrapeBrand("https://example.com", { warmStart: "true" });

// @ts-expect-error status has no service timeout option
void status({ timeout: 30 });
// @ts-expect-error search transport deadline is fixed
void webSearch("test", { timeout: 120 });
// @ts-expect-error use the CLI's camelCase field names
void scrapeHtml("https://example.com", { superMode: true });

void scrapeHtml("https://example.com", { warmStart: true });
void scrapeMarkdown("https://example.com", { warmStart: false });
// @ts-expect-error warmStart is strictly boolean
void scrapeHtml("https://example.com", { warmStart: "true" });
// @ts-expect-error maxAge is a number of milliseconds
void scrapeHtml("https://example.com", { maxAge: "1d" });
