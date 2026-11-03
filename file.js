/*
Manual test commands — run these in your terminal:

  npm run build
  export MRSCRAPER_API_TOKEN="YOUR_TOKEN"

  # Show help, or check account status.
  node file.js --help
  node file.js account

  # Run account status, HTML retrieval, and search together.
  node file.js smoke "http://cireba.com/cayman-islands-real-estate-listings/" "CIREBA Cayman Islands real estate"

  # Retrieve HTML (default), Markdown, a screenshot, or a combination.
  node file.js scraper_api "http://cireba.com/cayman-islands-real-estate-listings/"
  node file.js scraper_api "http://cireba.com/cayman-islands-real-estate-listings/" '{"html":false,"markdown":true}'

  # Combine outputs; the base64 screenshot is saved under manual-results/.
  node file.js scraper_api "https://books.toscrape.com/" '{"html":true,"markdown":true,"screenshot":true}'

  # Search the web.
  node file.js web_search "CIREBA Cayman Islands real estate"
  node file.js web_search "e-menessaptieka.lv linkedin" '{"country":"us","num_results":10}'
*/

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { account, scraper_api, web_search, MrScraperError } from "./dist/index.js";

const services = { account, scraper_api, web_search };

const help = `Build and authenticate first:
  npm run build
  export MRSCRAPER_API_TOKEN="YOUR_TOKEN"

Usage:
  node file.js [smoke] [url] [search-query]
  node file.js account [options-json]
  node file.js scraper_api [url] [options-json]
  node file.js web_search [query] [options-json]

Services:
  ${Object.keys(services).join(", ")}

Examples:
  node file.js account
  node file.js scraper_api "https://example.com"
  node file.js scraper_api "https://example.com" '{"html":false,"markdown":true}'
  node file.js scraper_api "https://books.toscrape.com/" '{"markdown":true,"screenshot":true}'
  node file.js scraper_api "https://example.com" '{"super":true}'
  node file.js web_search "python web scraping"
  node file.js web_search "e-menessaptieka.lv linkedin" '{"country":"us","num_results":10}'

With no service, run account, HTML, and search. Page URLs default to
https://example.com; search defaults to "python web scraping".
Screenshots and other binary responses are saved in manual-results/; text and
JSON are previewed. These commands make live API requests. Use --help to show
this message.`;

function preview(data) {
  const value = typeof data === "string" ? data : JSON.stringify(data, null, 2) ?? String(data);
  return value.length > 2000 ? `${value.slice(0, 2000)}\n... (truncated)` : value;
}

async function save(label, bytes, extension) {
  const output = resolve("manual-results", `${label}-${Date.now()}.${extension}`);
  await mkdir(resolve("manual-results"), { recursive: true });
  await writeFile(output, bytes);
  return output;
}

async function run(label, request) {
  try {
    const result = await request();
    console.log(`\n${label}: HTTP ${result.status_code}`);
    if (Buffer.isBuffer(result.data)) {
      const contentType = (result.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
      const extension = {
        "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
        "image/gif": "gif", "application/zip": "zip", "application/x-zip-compressed": "zip",
      }[contentType] ?? "bin";
      const output = await save(label, result.data, extension);
      console.log(`Saved ${result.data.length} bytes to ${output}`);
    } else if (typeof result.data?.screenshot === "string" && !/^https?:\/\//i.test(result.data.screenshot)) {
      // scraper_api returns screenshots as base64 inside its JSON response.
      const bytes = Buffer.from(result.data.screenshot.replace(/^data:[^,]*,/, ""), "base64");
      const extension = bytes[0] === 0xff && bytes[1] === 0xd8 ? "jpg"
        : bytes.subarray(0, 4).toString("latin1") === "\x89PNG" ? "png" : "bin";
      const output = await save(label, bytes, extension);
      console.log(`Saved ${bytes.length}-byte screenshot to ${output}`);
      console.log(preview({ ...result.data, screenshot: `[base64, saved to ${output}]` }));
    } else {
      console.log(preview(result.data));
    }
  } catch (error) {
    if (error instanceof MrScraperError) {
      console.error(`${label}: ${error.status ?? "network"} ${error.message}`);
    } else {
      console.error(`${label}:`, error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  }
}

async function main() {
  const [command = "smoke", ...args] = process.argv.slice(2);
  if (["--help", "-h", "help"].includes(command)) {
    console.log(help);
    return;
  }

  // Preserve the original `node file.js <url> <query>` invocation.
  const legacy = /^https?:\/\//i.test(command);
  const smoke = command === "smoke" || legacy;
  if (!smoke && !Object.hasOwn(services, command)) {
    throw new Error(`Unknown service: ${command}. Run node file.js --help for usage.`);
  }
  const inputs = legacy ? [command, ...args] : args;
  if (inputs.length > (command === "account" ? 1 : 2)) {
    throw new Error("Too many arguments. Run node file.js --help for usage.");
  }

  const optionsJson = smoke ? undefined : inputs[command === "account" ? 0 : 1];
  let options = {};
  if (optionsJson !== undefined) {
    try {
      options = JSON.parse(optionsJson);
    } catch {
      throw new Error('Options must be valid JSON, e.g. \'{"super":true}\'.');
    }
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
      throw new Error("Options must be a JSON object.");
    }
  }
  if (!process.env.MRSCRAPER_API_TOKEN?.trim() &&
      !(typeof options.token === "string" && options.token.trim())) {
    throw new Error("Set MRSCRAPER_API_TOKEN before running the manual test.");
  }

  if (smoke) {
    const [pageUrl = "https://example.com", searchQuery = "python web scraping"] = inputs;
    await run("account", () => account());
    await run("scraper_api", () => scraper_api(pageUrl));
    await run("web_search", () => web_search(searchQuery));
  } else if (command === "account") {
    await run(command, () => account(options));
  } else {
    const target = inputs[0] ?? (command === "web_search" ? "python web scraping" : "https://example.com");
    await run(command, () => services[command](target, options));
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
