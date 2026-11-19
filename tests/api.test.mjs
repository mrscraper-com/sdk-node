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
      return;
    }
    if (name === "webSearch") {
      assert.deepEqual(p, {
        action: "websearch",
        query: "web scraping",
        country: "us",
        numResults: "10",
      });
      return;
    }
    const expected = {
      url: URL_TARGET,
      timeout: "300",
      geoCode: "us",
      proxyCountry: "us",
      super: "false",
      waitUntil: "domcontentloaded",
      saveResult: "false",
    };
    if (name !== "scrapeJson")
      Object.assign(expected, {
        blockResources: "false",
        returnCookie: "false",
        markdown: name === "scrapeMarkdown" ? "true" : "false",
      });
    Object.assign(expected, {
      browserRendering: name === "getScreenshot" ? "true" : "false",
      html: ["scrapeHtml", "getScreenshot"].includes(name) ? "true" : "false",
      screenshot: name === "getScreenshot" ? "full" : "false",
    });
    if (name === "scrapeJson")
      Object.assign(expected, {
        agent: "general",
        prompt: "Extract all data as complete as possible.",
      });
    assert.deepEqual(p, expected);
  });
test("forwards explicit controls and preserves false and zero", async () => {
  calls = [];
  await sdk.scrapeHtml(URL_TARGET, {
    timeout: 15,
    geoCode: "ID",
    proxyCountry: "SG",
    super: true,
    waitUntil: "networkidle2",
    proxy: "http://proxy.example",
    maxRetries: 0,
    saveResult: true,
    blockResources: true,
    waitForSelector: ".ready",
    returnCookie: true,
    browserRendering: true,
  });
  const p = Object.fromEntries(calls[0].url.searchParams);
  for (const [k, v] of Object.entries({
    timeout: "15",
    geoCode: "id",
    proxyCountry: "sg",
    super: "true",
    waitUntil: "networkidle2",
    proxy: "http://proxy.example",
    maxRetries: "0",
    saveResult: "true",
    blockResources: "true",
    waitForSelector: ".ready",
    returnCookie: "true",
    browserRendering: "true",
  }))
    assert.equal(p[k], v);
});
test("combines Markdown and screenshot outputs", async () => {
  calls = [];
  await sdk.scrapeMarkdown(URL_TARGET, { html: true, browserRendering: false });
  await sdk.getScreenshot(URL_TARGET, {
    screenshot: "top",
    html: false,
    markdown: true,
  });
  assert.equal(calls[0].url.searchParams.get("browserRendering"), "true");
  assert.equal(calls[1].url.searchParams.get("screenshot"), "top");
  assert.equal(calls[1].url.searchParams.get("html"), "false");
  assert.equal(calls[1].url.searchParams.get("markdown"), "true");
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
  for (const key of [
    "url",
    "prompt",
    "agent",
    "blockResources",
    "returnCookie",
    "token",
  ])
    assert.ok(!req.url.searchParams.has(key));
  assert.equal(req.url.searchParams.get("maxRetries"), "0");
});
