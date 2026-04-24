import "dotenv/config";
import { googleSerp, MrScraperError } from "../dist/index.js";

if (!process.env.MRSCRAPER_API_TOKEN) {
  console.error("Set MRSCRAPER_API_TOKEN (see README Authentication).");
  process.exit(1);
}

try {
  const data = await googleSerp({
    url: "https://www.google.com/search?q=iphone+17",
    raw: true,
    token: process.env.MRSCRAPER_API_TOKEN,
  });
  console.log(typeof data === "string" ? data.slice(0, 2000) : JSON.stringify(data, null, 2).slice(0, 8000));
} catch (err) {
  if (err instanceof MrScraperError) {
    console.error(`MrScraper error ${err.status ?? "network"}: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
