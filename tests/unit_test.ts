import "dotenv/config";
import { fetchHtml, createAiScraper, getResultById, MrScraperError } from "@mrscraper/sdk";

try {
  const html = await fetchHtml({
    url: "https://www.cireba.com/property-detail/south-sound/residential-properties-for-sale-in-cayman-islands/breezy-pines-top-floor-unit-2-bed-2-bath",
    token: process.env.MRSCRAPER_API_TOKEN,
  });
  console.log(html);

  const scraper = await createAiScraper({
    url: "https://www.cireba.com/property-detail/south-sound/residential-properties-for-sale-in-cayman-islands/breezy-pines-top-floor-unit-2-bed-2-bath",
    message: "Extract all data as complete as possible",
    agent: "general",
    token: process.env.MRSCRAPER_API_TOKEN,
  });
  console.log(scraper);

  const result = await getResultById({
    resultId: scraper.data.id,
    token: process.env.MRSCRAPER_API_TOKEN,
  });
  console.log(result);
} catch (err) {
  if (err instanceof MrScraperError) {
    console.error(`MrScraper error ${err.status ?? "network"}: ${err.message}`);
  } else {
    throw err;
  }
}
