import { account, scraper_api, web_search, MrScraperError } from "./dist/index.js";

if (!process.env.MRSCRAPER_API_TOKEN) {
  console.error("Set MRSCRAPER_API_TOKEN before running the manual test.");
  process.exit(1);
}

const [pageUrl = "https://example.com", searchQuery = "python web scraping"] =
  process.argv.slice(2);
const accountOnly = pageUrl === "account";

function preview(data) {
  const value = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return value.length > 2000 ? `${value.slice(0, 2000)}\n... (truncated)` : value;
}

async function run(label, request) {
  try {
    const result = await request();
    console.log(`${label}: HTTP ${result.status_code}`);
    console.log(preview(result.data));
  } catch (error) {
    if (error instanceof MrScraperError) {
      console.error(`${label}: ${error.status ?? "network"} ${error.message}`);
    } else {
      console.error(`${label}:`, error);
    }
    process.exitCode = 1;
  }
}

await run("account", () => account());

if (!accountOnly) {
  await run("scraper_api", () => scraper_api(pageUrl));
  await run("web_search", () => web_search(searchQuery, { raw: false }));
}
