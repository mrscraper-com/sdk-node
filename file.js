import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  status,
  scrapeHtml,
  scrapeMarkdown,
  getScreenshot,
  scrapeBrand,
  scrapeJson,
  webSearch,
  MrScraperError,
} from "./dist/index.js";

const services = {
  status,
  scrapeHtml,
  scrapeMarkdown,
  getScreenshot,
  scrapeBrand,
  scrapeJson,
  webSearch,
};

const help = `Build: npm run build. Set MRSCRAPER_API_TOKEN or MRSCRAPER_API_KEY.
Usage: node file.js [all] [url] [query]
       node file.js status [options-json]
       node file.js <service> [url-or-query] [options-json]
Services: ${Object.keys(services).join(", ")}
Examples:
  node file.js scrapeHtml https://example.com
  node file.js scrapeHtml https://example.com '{"screenshot":"top","maxAge":3600000,"geoCode":"gb"}'
  node file.js scrapeMarkdown https://example.com '{"browserRendering":false,"blockResources":true}'
  node file.js getScreenshot https://example.com '{"waitForSelector":"body","timeout":120}'
  node file.js getScreenshot https://example.com '{"screenshot":"top"}'
  node file.js getScreenshot https://example.com '{"screenshot":"1920x1080-75"}'
  node file.js scrapeBrand https://example.com
  node file.js scrapeJson https://example.com '{"prompt":"Extract titles and prices","html":false}'
  node file.js webSearch "web scraping" '{"country":"id","numResults":20}'
Options use the camelCase names documented in the README, such as browserRendering,
timeout, warmStart, blockResources, waitForSelector, geoCode, maxAge,
maxRetries, and screenshot. Results are always saved to the dashboard.
All mode attempts all seven services, continues after failures, and reports a summary.
These are live calls and spend quota. Responses and screenshots are saved under manual-results/.`;

function preview(data) {
  const value =
    typeof data === "string"
      ? data
      : (JSON.stringify(data, null, 2) ?? String(data));
  return value.length > 2000
    ? `${value.slice(0, 2000)}\n... (truncated)`
    : value;
}

async function save(label, bytes, extension) {
  const output = resolve(
    "manual-results",
    `${label}-${Date.now()}.${extension}`,
  );
  await mkdir(resolve("manual-results"), { recursive: true });
  await writeFile(output, bytes);
  return output;
}

async function run(label, request) {
  const started = Date.now();
  console.log(`\n${label}: running...`);
  try {
    const result = await request();
    console.log(`${label}: HTTP ${result.status_code}`);
    await save(label, JSON.stringify(result, null, 2), "json");
    if (result.data?.success === false) {
      throw new MrScraperError(
        result.data.message || "Service reported an unsuccessful response",
        result.status_code,
      );
    }
    if (Buffer.isBuffer(result.data)) {
      const contentType = (result.headers["content-type"] ?? "")
        .split(";", 1)[0]
        .trim()
        .toLowerCase();
      const extension =
        {
          "image/png": "png",
          "image/jpeg": "jpg",
          "image/webp": "webp",
          "image/gif": "gif",
          "application/zip": "zip",
          "application/x-zip-compressed": "zip",
        }[contentType] ?? "bin";
      const output = await save(label, result.data, extension);
      console.log(`Saved ${result.data.length} bytes to ${output}`);
    } else if (
      typeof result.data?.screenshot === "string" &&
      !/^https?:\/\//i.test(result.data.screenshot)
    ) {
      // getScreenshot returns screenshots as base64 inside its JSON response.
      const bytes = Buffer.from(
        result.data.screenshot.replace(/^data:[^,]*,/, ""),
        "base64",
      );
      const extension =
        bytes[0] === 0xff && bytes[1] === 0xd8
          ? "jpg"
          : bytes.subarray(0, 4).toString("latin1") === "\x89PNG"
            ? "png"
            : "bin";
      const output = await save(label, bytes, extension);
      console.log(`Saved ${bytes.length}-byte screenshot to ${output}`);
      console.log(
        preview({ ...result.data, screenshot: `[base64, saved to ${output}]` }),
      );
    } else {
      console.log(preview(result.data));
    }
    console.log(
      `${label}: PASS (${((Date.now() - started) / 1000).toFixed(2)}s)`,
    );
    return true;
  } catch (error) {
    if (error instanceof MrScraperError) {
      console.error(
        `${label}: FAIL (${error.status === undefined ? "network" : `HTTP ${error.status}`}) ${error.message}`,
      );
    } else {
      console.error(
        `${label}: FAIL`,
        error instanceof Error ? error.message : error,
      );
    }
    process.exitCode = 1;
    return false;
  }
}

async function main() {
  const [command = "all", ...args] = process.argv.slice(2);
  if (["--help", "-h", "help"].includes(command)) {
    console.log(help);
    return;
  }

  // Preserve the original `node file.js <url> <query>` invocation.
  const legacy = /^https?:\/\//i.test(command);
  const all = command === "all" || command === "smoke" || legacy;
  if (!all && !Object.hasOwn(services, command)) {
    throw new Error(
      `Unknown service: ${command}. Run node file.js --help for usage.`,
    );
  }
  const inputs = legacy ? [command, ...args] : args;
  if (inputs.length > (command === "status" ? 1 : 2)) {
    throw new Error("Too many arguments. Run node file.js --help for usage.");
  }

  const optionsJson = all ? undefined : inputs[command === "status" ? 0 : 1];
  let options = {};
  if (optionsJson !== undefined) {
    try {
      options = JSON.parse(optionsJson);
    } catch {
      throw new Error("Options must be valid JSON, e.g. '{\"geoCode\":\"gb\"}'.");
    }
    if (
      options === null ||
      typeof options !== "object" ||
      Array.isArray(options)
    ) {
      throw new Error("Options must be a JSON object.");
    }
  }
  if (
    !process.env.MRSCRAPER_API_TOKEN?.trim() &&
    !process.env.MRSCRAPER_API_KEY?.trim() &&
    !(typeof options.token === "string" && options.token.trim())
  ) {
    throw new Error("Set MRSCRAPER_API_TOKEN before running the manual test.");
  }

  const results = [];
  if (all) {
    const [
      pageUrl = "https://example.com",
      searchQuery = "python web scraping",
    ] = inputs;
    results.push(await run("status", () => status()));
    for (const name of [
      "scrapeHtml",
      "scrapeMarkdown",
      "getScreenshot",
      "scrapeBrand",
      "scrapeJson",
    ]) {
      results.push(await run(name, () => services[name](pageUrl)));
    }
    results.push(await run("webSearch", () => webSearch(searchQuery)));
  } else if (command === "status") {
    results.push(await run(command, () => status(options)));
  } else {
    const target =
      inputs[0] ??
      (command === "webSearch" ? "python web scraping" : "https://example.com");
    results.push(await run(command, () => services[command](target, options)));
  }
  const passed = results.filter(Boolean).length;
  console.log(
    `\nSummary: ${passed}/${results.length} passed, ${results.length - passed} failed.`,
  );
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
