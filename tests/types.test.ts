import {
  scraper_html, scraper_markdown, get_screenshot, scraper_json, scraper_multiple_page,
  scraper_sitemap, scrape_brand, get_brand,
} from "../src/index.js";
import type { ScraperOptions, ScreenshotOptions, BrandBundle, BrandOutput } from "../src/index.js";

const shared: ScraperOptions = { token: "test", browser_rendering: false, wait_until: "networkidle" };
void scraper_html("https://example.com", shared);
void scraper_markdown("https://example.com", shared);
void get_screenshot("https://example.com", { full_page: false, wait_until: null });
void scraper_json<{ price: number }>("https://example.com", { prompt: "Extract prices." });
void scraper_multiple_page("https://example.com", { prompt: "Extract entries.", max_pages: 4 });
void scraper_sitemap("https://example.com", { include_patterns: "/products/*", exclude_patterns: "/blog/*", max_depth: 0 });
const bundle: BrandBundle = "none";
const output: BrandOutput = "screenshot_full";
void scrape_brand("https://example.com", { bundle });
void get_brand("job", { output });
// @ts-expect-error Output flags are chosen by service functions.
void scraper_html("https://example.com", { html: false });
// @ts-expect-error Output flags are chosen by service functions.
void scraper_markdown("https://example.com", { screenshot: true });
// @ts-expect-error Screenshot rendering is always enabled.
const screenshot: ScreenshotOptions = { browser_rendering: false };
void screenshot;
// @ts-expect-error Patterns must be strings.
void scraper_sitemap("https://example.com", { include_patterns: ["/products/*"] });
// @ts-expect-error Brand bundle is restricted.
void scrape_brand("https://example.com", { bundle: "invalid" });
// @ts-expect-error Brand output is restricted.
void get_brand("job", { output: "invalid" });
// @ts-expect-error The general scraper API is internal.
import { scraper_api } from "../src/index.js";
void scraper_api;
