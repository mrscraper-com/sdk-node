import assert from "node:assert/strict";
import { request } from "../dist/api.js";
import { afterEach, test } from "node:test";
import {
  scrapeHtml,
  scrapeMarkdown,
  getScreenshot,
  scrapeJson,
  scrapeBrand,
  webSearch,
  MrScraperError,
} from "../dist/index.js";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const options = { token: "test-token" };
for (const [fn, extra] of [
  [scrapeHtml, { timeout: 0 }],
  [scrapeHtml, { timeout: 301 }],
  [scrapeHtml, { timeout: 1.5 }],
  [scrapeHtml, { maxRetries: -1 }],
  [scrapeHtml, { waitUntil: "networkidle" }],
  [scrapeHtml, { geoCode: "usa" }],
  [getScreenshot, { screenshot: true }],
  [scrapeJson, { prompt: " " }],
])
  test(`rejects invalid ${JSON.stringify(extra)}`, async () => {
    globalThis.fetch = () => {
      throw Error("must not send");
    };
    await assert.rejects(
      fn("https://example.com", { ...options, ...extra }),
      (error) => !(error instanceof MrScraperError),
    );
  });
for (const [query, extra] of [
  [" ", {}],
  ["a".repeat(1001), {}],
  ["ok", { numResults: 9 }],
  ["ok", { numResults: 101 }],
  ["ok", { numResults: 10.5 }],
  ["ok", { country: "usa" }],
])
  test(`rejects search ${query.slice(0, 5)} ${JSON.stringify(extra)}`, async () => {
    let sent = false;
    globalThis.fetch = () => {
      sent = true;
    };
    await assert.rejects(webSearch(query, { ...options, ...extra }));
    assert.equal(sent, false);
  });
for (const fn of [
  scrapeHtml,
  scrapeMarkdown,
  getScreenshot,
  scrapeJson,
  scrapeBrand,
])
  test(`${fn.name} rejects non-web URLs`, async () => {
    await assert.rejects(fn("file:///tmp/file", options), /HTTP/);
  });
test("parses JSON, text and binary without changing data", async () => {
  for (const [type, body, expected] of [
    ["application/json", '{"ok":true}', { ok: true }],
    ["text/html", "<html>test</html>", "<html>test</html>"],
    ["image/png", Buffer.from([0, 255, 128]), Buffer.from([0, 255, 128])],
  ]) {
    globalThis.fetch = async () =>
      new Response(body, { headers: { "content-type": type } });
    assert.deepEqual(
      (await getScreenshot("https://example.com", options)).data,
      expected,
    );
  }
});
test("HTTP errors have a status and redact credentials", async () => {
  globalThis.fetch = async () =>
    new Response("bad test-token", { status: 429 });
  await assert.rejects(
    scrapeHtml("https://example.com", options),
    (e) => e.status === 429 && !e.message.includes("test-token"),
  );
  globalThis.fetch = async () => new Response("bad", { status: 401 });
  await assert.rejects(
    scrapeHtml("https://example.com", options),
    (e) => e.status === 401,
  );
});
test("abort deadline becomes a safe SDK failure", async () => {
  globalThis.fetch = async (_, init) =>
    new Promise((_, reject) =>
      init.signal.addEventListener("abort", () =>
        reject(new Error("aborted test-token")),
      ),
    );
  await assert.rejects(
    request("GET", "https://example.com", undefined, {}, 0.01, options.token),
    (e) => e instanceof MrScraperError && !e.message.includes("test-token"),
  );
});
