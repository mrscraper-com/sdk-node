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
const pageServices = [scrapeHtml, scrapeMarkdown, getScreenshot, scrapeJson];
const invalidPageOptions = [
  { timeout: 0 },
  { timeout: 331 },
  { timeout: 1.5 },
  { maxRetries: -1 },
  { maxRetries: 1.5 },
  { maxAge: -1 },
  { maxAge: 604800001 },
  { maxAge: 1.5 },
  { geoCode: "usa" },
  { geoCode: "" },
  { waitForSelector: " " },
  { waitForSelector: "a".repeat(501) },
];
for (const [fn, extra] of [
  ...pageServices.flatMap((fn) =>
    invalidPageOptions.map((options) => [fn, options]),
  ),
  ...[scrapeHtml, scrapeMarkdown, scrapeJson].flatMap((fn) => [
    [fn, { browserRendering: "true" }],
    [fn, { blockResources: 1 }],
  ]),
  ...[
    true,
    "",
    "FULL",
    "bottom",
    "99x800",
    "1280x3841",
    "12345x800",
    "1280x800-24",
    "1280x800-301",
    "1280x800-",
  ].map((screenshot) => [scrapeHtml, { screenshot }]),
  ...[
    false,
    true,
    null,
    "",
    "FULL",
    "bottom",
    "99x800",
    "1280x3841",
    "12345x800",
    "1280x800-24",
    "1280x800-301",
    "1280x800-",
    1280,
  ].map((screenshot) => [getScreenshot, { screenshot }]),
  [scrapeJson, { prompt: " " }],
  [scrapeJson, { html: "true" }],
  [scrapeJson, { screenshot: "full" }],
])
  test(`${fn.name} rejects invalid ${JSON.stringify(extra).slice(0, 60)}`, async () => {
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
  ["ok", { country: "" }],
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
