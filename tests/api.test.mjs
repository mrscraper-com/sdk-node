import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import * as sdk from "../dist/index.js";
let calls = [];
let server;
let base;
before(async () => {
  server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const url = new URL(req.url, base);
    calls.push({ url, method: req.method, headers: req.headers, body });
    res.setHeader("content-type", "application/json");
    res.setHeader("set-cookie", "secret-cookie");
    res.end(
      JSON.stringify({
        data: {
          tokenLimit: 100,
          tokenUsage: 20,
          user: { name: "User" },
          apiToken: "secret",
        },
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  process.env.MRSCRAPER_FETCH_BASE_URL = base;
  process.env.MRSCRAPER_API_BASE_URL = base + "/api/v1";
  process.env.MRSCRAPER_API_TOKEN = "test-token";
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  delete process.env.MRSCRAPER_FETCH_BASE_URL;
  delete process.env.MRSCRAPER_API_BASE_URL;
  delete process.env.MRSCRAPER_API_TOKEN;
});
const URL_TARGET = "https://example.com/page?a=1&b=two";
const names = [
  "status",
  "scrapeHtml",
  "scrapeMarkdown",
  "getScreenshot",
  "scrapeBrand",
  "scrapeJson",
  "webSearch",
];
test("exports exactly seven services plus the error type", () =>
  assert.deepEqual(
    Object.keys(sdk).sort(),
    [...names, "MrScraperError"].sort(),
  ));
const SHARED_DEFAULTS = { timeout: "300", saveResult: "true", maxAge: "0" };
const LOADING_DEFAULTS = { warmStart: "false", blockResources: "false" };
// Expected default queries, in the documented request order.
const DEFAULT_QUERIES = {
  scrapeHtml: {
    url: URL_TARGET,
    html: "true",
    markdown: "false",
    timeout: "300",
    warmStart: "false",
    blockResources: "false",
    saveResult: "true",
    maxAge: "0",
    screenshot: "false",
  },
  scrapeMarkdown: {
    url: URL_TARGET,
    markdown: "true",
    html: "false",
    screenshot: "false",
    timeout: "300",
    warmStart: "false",
    blockResources: "false",
    saveResult: "true",
    maxAge: "0",
  },
  getScreenshot: {
    url: URL_TARGET,
    screenshot: "full",
    html: "false",
    markdown: "false",
    browserRendering: "true",
    timeout: "300",
    saveResult: "true",
    maxAge: "0",
  },
  scrapeJson: {
    url: URL_TARGET,
    prompt: "Extract all data as complete as possible.",
    agent: "general",
    html: "true",
    timeout: "300",
    warmStart: "false",
    blockResources: "false",
    saveResult: "true",
    maxAge: "0",
    screenshot: "false",
  },
};
for (const name of names)
  test(`wire contract: ${name}`, async () => {
    calls = [];
    const result = await sdk[name](
      ...(name === "status"
        ? []
        : [name === "webSearch" ? "  web scraping  " : URL_TARGET]),
    );
    const req = calls[0];
    const p = Object.fromEntries(req.url.searchParams);
    assert.equal(req.method, "GET");
    assert.equal(req.body, "");
    assert.equal(req.headers.authorization, "Bearer test-token");
    assert.equal(req.headers["x-api-token"], "test-token");
    assert.ok(!("token" in p));
    assert.equal(result.status_code, 200);
    if (name === "status") {
      assert.equal(req.url.pathname, "/api/v1/subscription-accounts");
      assert.deepEqual(result.data, {
        data: {
          tokenLimit: 100,
          tokenUsage: 20,
          user: { name: "User" },
          apiToken: "secret",
        },
      });
      assert.ok(!("set-cookie" in result.headers));
      return;
    }
    if (name === "scrapeBrand") {
      assert.deepEqual(p, {
        action: "brand-scraping",
        url: URL_TARGET,
        bundle: "none",
      });
      assert.deepEqual(Object.keys(p), ["action", "url", "bundle"]);
      return;
    }
    if (name === "webSearch") {
      assert.deepEqual(p, {
        action: "websearch",
        query: "web scraping",
        numResults: "10",
      });
      return;
    }
    assert.deepEqual(p, DEFAULT_QUERIES[name]);
    assert.deepEqual(Object.keys(p), Object.keys(DEFAULT_QUERIES[name]));
  });
test("undocumented options never reach the wire", async () => {
  calls = [];
  const legacy = {
    super: true,
    superMode: true,
    waitUntil: "load",
    proxyCountry: "SG",
    proxy: "http://proxy.example",
    returnCookie: true,
    record: true,
    bundle: "full",
    saveResult: false,
    tokenCap: 5,
  };
  await sdk.scrapeHtml(URL_TARGET, legacy);
  await sdk.scrapeMarkdown(URL_TARGET, { ...legacy, html: true, screenshot: "top" });
  await sdk.getScreenshot(URL_TARGET, {
    ...legacy,
    screenshot: "top",
    html: false,
    markdown: true,
    browserRendering: false,
    warmStart: true,
    blockResources: true,
    action: "custom",
  });
  await sdk.scrapeJson(URL_TARGET, { ...legacy, action: "custom", markdown: true });
  assert.deepEqual(
    calls.map((call) => Object.fromEntries(call.url.searchParams)),
    [
      DEFAULT_QUERIES.scrapeHtml,
      DEFAULT_QUERIES.scrapeMarkdown,
      DEFAULT_QUERIES.getScreenshot,
      DEFAULT_QUERIES.scrapeJson,
    ],
  );
});
test("forwards explicit controls in order and preserves false and zero", async () => {
  calls = [];
  const options = {
    browserRendering: false,
    timeout: 330,
    warmStart: true,
    blockResources: true,
    waitForSelector: " .ready ",
    geoCode: "ID",
    maxAge: 604800000,
    maxRetries: 0,
  };
  await sdk.scrapeHtml(URL_TARGET, {
    ...options,
    action: " analytics ",
    screenshot: "1920x1080-75",
  });
  await sdk.scrapeMarkdown(URL_TARGET, {
    ...options,
    browserRendering: true,
    action: "analytics",
  });
  await sdk.getScreenshot(URL_TARGET, options);
  await sdk.scrapeJson(URL_TARGET, {
    ...options,
    prompt: "Extract prices",
    html: false,
    screenshot: true,
  });
  const loading = { warmStart: "true", blockResources: "true" };
  const shared = {
    timeout: "330",
    waitForSelector: ".ready",
    geoCode: "id",
    saveResult: "true",
    maxAge: "604800000",
    maxRetries: "0",
  };
  const [html, markdown, screenshot, json] = calls.map((call) =>
    Object.fromEntries(call.url.searchParams),
  );
  // A screenshot needs a rendered page, so it overrides browserRendering: false.
  assert.deepEqual(html, {
    url: URL_TARGET,
    html: "true",
    markdown: "false",
    browserRendering: "true",
    ...loading,
    action: "analytics",
    ...shared,
    screenshot: "1920x1080-75",
  });
  assert.deepEqual(Object.keys(html), [
    "url",
    "html",
    "markdown",
    "browserRendering",
    "timeout",
    "warmStart",
    "blockResources",
    "waitForSelector",
    "action",
    "geoCode",
    "saveResult",
    "maxAge",
    "maxRetries",
    "screenshot",
  ]);
  assert.deepEqual(markdown, {
    url: URL_TARGET,
    markdown: "true",
    html: "false",
    screenshot: "false",
    browserRendering: "true",
    ...loading,
    action: "analytics",
    ...shared,
  });
  assert.deepEqual(screenshot, {
    url: URL_TARGET,
    screenshot: "full",
    html: "false",
    markdown: "false",
    browserRendering: "true",
    ...shared,
  });
  assert.deepEqual(Object.keys(markdown).slice(0, 4), [
    "url",
    "markdown",
    "html",
    "screenshot",
  ]);
  assert.deepEqual(Object.keys(screenshot).slice(0, 5), [
    "url",
    "screenshot",
    "html",
    "markdown",
    "browserRendering",
  ]);
  assert.deepEqual(json, {
    url: URL_TARGET,
    prompt: "Extract prices",
    agent: "general",
    html: "false",
    browserRendering: "false",
    ...loading,
    ...shared,
    screenshot: "true",
  });
});
test("browser rendering is omitted unless set and preserves false", async () => {
  for (const name of ["scrapeHtml", "scrapeMarkdown", "scrapeJson"]) {
    for (const browserRendering of [undefined, true, false]) {
      calls = [];
      await sdk[name](URL_TARGET, { browserRendering });
      assert.equal(
        calls[0].url.searchParams.get("browserRendering"),
        browserRendering === undefined ? null : String(browserRendering),
      );
    }
  }
});
test("Scrape HTML sends every documented screenshot capture", async () => {
  calls = [];
  const captures = [
    false,
    "full",
    "top",
    "100x100",
    "1280x800",
    "3840x3840",
    "1280x800-25",
    "1920x1080-300",
  ];
  for (const screenshot of captures)
    await sdk.scrapeHtml(URL_TARGET, { screenshot });
  assert.deepEqual(
    calls.map((call) => call.url.searchParams.get("screenshot")),
    captures.map(String),
  );
});
test("a Scrape HTML screenshot always sends browserRendering=true", async () => {
  for (const screenshot of [false, "full", "top", "1280x800-75"]) {
    for (const browserRendering of [undefined, true, false]) {
      calls = [];
      await sdk.scrapeHtml(URL_TARGET, { screenshot, browserRendering });
      assert.equal(
        calls[0].url.searchParams.get("browserRendering"),
        screenshot === false
          ? browserRendering === undefined
            ? null
            : String(browserRendering)
          : "true",
        `${screenshot} with browserRendering ${browserRendering}`,
      );
    }
  }
});
test("Scrape Brand sends only action, url, and bundle", async () => {
  calls = [];
  await sdk.scrapeBrand(URL_TARGET, {
    timeout: 120,
    warmStart: true,
    geoCode: "GB",
    saveResult: false,
    maxAge: 0,
    bundle: "full",
  });
  const p = Object.fromEntries(calls[0].url.searchParams);
  assert.deepEqual(p, {
    action: "brand-scraping",
    url: URL_TARGET,
    bundle: "none",
  });
  assert.deepEqual(Object.keys(p), ["action", "url", "bundle"]);
});
test("HTTP deadlines: page timeout plus 30 seconds, fixed for brand and search", async () => {
  const delays = [];
  const original = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...rest) => {
    delays.push(ms);
    return original(fn, ms, ...rest);
  };
  try {
    await sdk.scrapeHtml(URL_TARGET, { timeout: 60 });
    assert.ok(delays.includes(90_000), "page 60 + 30 seconds");
    delays.length = 0;
    await sdk.scrapeBrand(URL_TARGET);
    assert.ok(delays.includes(120_000), "brand stays at 120 seconds");
    delays.length = 0;
    await sdk.scrapeBrand(URL_TARGET, { timeout: 60 });
    assert.ok(delays.includes(120_000), "brand ignores a timeout option");
    assert.ok(!delays.includes(90_000));
    delays.length = 0;
    await sdk.webSearch("web scraping", { numResults: 10 });
    assert.ok(delays.includes(120_000), "search stays at 120 seconds");
  } finally {
    globalThis.setTimeout = original;
  }
});
test("web search sends a country only when set", async () => {
  calls = [];
  await sdk.webSearch("running shoes", { country: "ID", numResults: 100 });
  assert.deepEqual(Object.fromEntries(calls[0].url.searchParams), {
    action: "websearch",
    query: "running shoes",
    country: "id",
    numResults: "100",
  });
});
test("long JSON prompts use POST with only extraction fields in body", async () => {
  calls = [];
  const prompt = "é &".repeat(4000);
  await sdk.scrapeJson(URL_TARGET, { prompt, maxRetries: 0, saveResult: true });
  const req = calls[0];
  assert.equal(req.method, "POST");
  assert.deepEqual(JSON.parse(req.body), {
    url: URL_TARGET,
    prompt,
    agent: "general",
  });
  for (const key of ["url", "prompt", "agent", "token"])
    assert.ok(!req.url.searchParams.has(key));
  assert.deepEqual(Object.fromEntries(req.url.searchParams), {
    html: "true",
    ...LOADING_DEFAULTS,
    ...SHARED_DEFAULTS,
    maxRetries: "0",
    screenshot: "false",
  });
});

for (const name of ["scrapeHtml", "scrapeMarkdown", "scrapeJson"])
  test(`warmStart forwarding: ${name}`, async () => {
    calls = [];
    for (const warmStart of [false, true]) {
      await sdk[name](URL_TARGET, { warmStart });
      assert.equal(
        calls.at(-1).url.searchParams.get("warmStart"),
        String(warmStart),
      );
    }
    const sent = calls.length;
    for (const warmStart of ["true", 1]) {
      await assert.rejects(
        sdk[name](URL_TARGET, { warmStart }),
        /warmStart must be a boolean/,
      );
    }
    assert.equal(calls.length, sent);
  });
test("Get screenshot ignores loading controls", async () => {
  calls = [];
  await sdk.getScreenshot(URL_TARGET, { warmStart: true });
  assert.ok(!calls[0].url.searchParams.has("warmStart"));
});
