import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import * as sdk from "../dist/index.js";

const url = "https://example.com/listings?a=1&b=2";
const token = "test-token";

async function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  try { await run(); } finally { globalThis.fetch = original; }
}

function noOutputs(params) {
  for (const name of ["html", "markdown", "screenshot"]) assert.equal(params.has(name), false);
}

for (const [name, selected] of [["scraper_html", "html"], ["scraper_markdown", "markdown"]]) {
  test(`${name} fixes its output and ignores other runtime format and agent overrides`, async () => {
    await withFetch(async (input, init) => {
      const params = new URL(input).searchParams;
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(init.body), { url, maxRetries: 3 });
      assert.equal(params.get(selected), "true");
      for (const other of ["html", "markdown", "screenshot"].filter((value) => value !== selected)) {
        assert.equal(params.has(other), false);
      }
      assert.equal(params.has("browserRendering"), false);
      return new Response("content", { headers: { "content-type": "text/plain" } });
    }, async () => {
      const response = await sdk[name](url, {
        token, html: false, markdown: false, screenshot: true, agent: "map", method: "GET",
      });
      assert.equal(response.data, "content");
    });
  });
}

for (const [full_page, screenshot] of [[undefined, "full"], [false, "true"]]) {
  test(`get_screenshot sends GET with screenshot=${screenshot} and preserves bytes`, async () => {
    const bytes = Buffer.from([137, 80, 78, 71, 0, 255, 128]);
    await withFetch(async (input, init) => {
      const params = new URL(input).searchParams;
      assert.equal(init.method, "GET");
      assert.equal(init.body, undefined);
      assert.equal(params.get("url"), url);
      assert.equal(params.get("screenshot"), screenshot);
      assert.equal(params.get("browserRendering"), "true");
      assert.equal(params.get("waitUntil"), "domcontentloaded");
      assert.equal(params.get("timeout"), "300");
      assert.equal(params.get("maxRetries"), "3");
      assert.equal(params.get("tokenCap"), "0");
      assert.equal(params.has("html"), false);
      assert.equal(params.has("markdown"), false);
      return new Response(bytes, { headers: { "content-type": "image/png" } });
    }, async () => {
      const response = await sdk.get_screenshot(url, {
        token, full_page, token_cap: 0, browser_rendering: false, html: true, markdown: true,
      });
      assert.equal(Buffer.isBuffer(response.data), true);
      assert.deepEqual(response.data, bytes);
    });
  });
}

test("screenshot accepts custom wait controls and retains JSON responses", async () => {
  for (const wait_until of [null, "networkidle", ""]) {
    await withFetch(async (input) => {
      const params = new URL(input).searchParams;
      assert.equal(params.get("waitUntil"), wait_until);
      assert.equal(params.get("timeout"), "45");
      assert.equal(params.get("maxRetries"), "0");
      assert.equal(params.has("tokenCap"), false);
      return Response.json({ screenshot: "https://example.com/image.png" });
    }, async () => {
      const response = await sdk.get_screenshot(url, { token, timeout: 45, max_retries: 0, wait_until });
      assert.deepEqual(response.data, { screenshot: "https://example.com/image.png" });
    });
  }
});

for (const [name, expectedBody, output] of [
  ["scraper_json", { agent: "general", prompt: "Extract all data as complete as possible." }, "html"],
  ["scraper_multiple_page", { agent: "listing", prompt: "Extract all entry data as complete as possible.", maxPages: 3 }],
  ["scraper_sitemap", { agent: "map", maxDepth: 2, maxPages: 3, limit: 1000 }],
]) {
  test(`${name} sends its Python service defaults`, async () => {
    await withFetch(async (input, init) => {
      const params = new URL(input).searchParams;
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(init.body), { url, maxRetries: 3, ...expectedBody });
      assert.equal(params.has("maxRetries"), false);
      assert.equal(params.has("url"), false);
      if (output) {
        assert.equal(params.get("html"), "true");
        assert.equal(params.has("markdown"), false);
        assert.equal(params.has("screenshot"), false);
      } else noOutputs(params);
      return Response.json({ result: [] });
    }, async () => {
      const response = await sdk[name](url, { token, html: false, markdown: true, screenshot: true, agent: "invalid" });
      assert.deepEqual(response.data, { result: [] });
    });
  });
}

test("JSON and listing use explicit prompts, page limits, and retry controls", async () => {
  for (const name of ["scraper_json", "scraper_multiple_page"]) {
    await withFetch(async (_input, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.prompt, "Extract address and price.");
      assert.equal(body.maxRetries, 0);
      assert.equal(body.tokenCap, 30);
      if (name === "scraper_multiple_page") assert.equal(body.maxPages, 7);
      else assert.equal("maxPages" in body, false);
      return Response.json({});
    }, () => sdk[name](url, { token, prompt: "Extract address and price.", max_pages: 7, max_retries: 0, token_cap: 30 }));
  }
});

test("sitemap preserves pattern strings, including empty strings, without placing them in query", async () => {
  const include_patterns = String.raw`https:\/\/www\.example\.com\/products\/*`;
  const exclude_patterns = String.raw`https:\/\/www\.example\.com\/blog\/*`;
  for (const patterns of [{ include_patterns, exclude_patterns }, { include_patterns: "", exclude_patterns: "" }]) {
    await withFetch(async (input, init) => {
      const params = new URL(input).searchParams;
      noOutputs(params);
      assert.equal(params.has("includePatterns"), false);
      assert.equal(params.has("excludePatterns"), false);
      assert.deepEqual(JSON.parse(init.body), {
        url, maxRetries: 3, agent: "map", maxDepth: 0, maxPages: 5, limit: 12,
        includePatterns: patterns.include_patterns, excludePatterns: patterns.exclude_patterns,
      });
      return Response.json({});
    }, () => sdk.scraper_sitemap(url, { token, max_depth: 0, max_pages: 5, limit: 12, ...patterns }));
  }
});

for (const bundle of [undefined, "clean", "full", "none"]) {
  test(`scrape_brand uses query retry controls and bundle ${bundle ?? "default clean"}`, async () => {
    await withFetch(async (input, init) => {
      const params = new URL(input).searchParams;
      assert.equal(init.method, "POST");
      noOutputs(params);
      assert.equal(params.get("action"), "brand-scraping");
      assert.equal(params.get("bundle"), bundle ?? "clean");
      assert.equal(params.get("url"), url);
      assert.equal(params.get("maxRetries"), "4");
      assert.equal(params.get("tokenCap"), "30");
      assert.deepEqual(JSON.parse(init.body), { url });
      return Response.json({ id: "job-1" });
    }, () => sdk.scrape_brand(url, { token, bundle, max_retries: 4, token_cap: 30, html: true, markdown: true }));
  });
}

test("get_brand retrieves each output, preserving binary, text, and structured JSON", async () => {
  for (const output of [undefined, "html", "bundle", "screenshot", "screenshot_full"]) {
    const expected = output === "html" ? "<html>brand</html>" : output ? Buffer.from([0, 255, 128]) : { id: "job/1 &2" };
    await withFetch(async (input, init) => {
      const endpoint = new URL(input);
      assert.equal(endpoint.pathname, "/neo/brand");
      assert.equal(endpoint.searchParams.get("id"), "job/1 &2");
      assert.equal(endpoint.searchParams.get("output"), output ?? null);
      assert.equal(endpoint.searchParams.has("token"), false);
      assert.equal(init.headers["x-api-token"], token);
      assert.equal(init.method, "GET");
      assert.equal(init.body, undefined);
      if (!output) return Response.json(expected);
      return new Response(expected, { headers: { "content-type": output === "html" ? "text/html" : output === "bundle" ? "application/zip" : "image/png" } });
    }, async () => {
      const response = await sdk.get_brand("job/1 &2", { token, output });
      assert.deepEqual(response.data, expected);
    });
  }
});

test("all service methods share authentication, runtime validation, and token redaction", async () => {
  const scraping = ["scraper_html", "scraper_markdown", "get_screenshot", "scraper_json", "scraper_multiple_page", "scraper_sitemap", "scrape_brand"];
  await withFetch(async () => assert.fail("invalid input must not be sent"), async () => {
    for (const name of scraping) {
      for (const timeout of [0, 301, Infinity, NaN]) await assert.rejects(sdk[name](url, { token, timeout }), RangeError);
      for (const max_retries of [-1, 0.5, NaN]) await assert.rejects(sdk[name](url, { token, max_retries }), RangeError);
      for (const token_cap of [-1, 0.5, NaN]) await assert.rejects(sdk[name](url, { token, token_cap }), RangeError);
      await assert.rejects(sdk[name](url, { token, super: "true" }), TypeError);
    }
    for (const full_page of [null, 1, "full"]) await assert.rejects(sdk.get_screenshot(url, { token, full_page }), TypeError);
    for (const max_pages of [0, -1, 1.5, true]) {
      await assert.rejects(sdk.scraper_multiple_page(url, { token, max_pages }), RangeError);
      await assert.rejects(sdk.scraper_sitemap(url, { token, max_pages }), RangeError);
    }
    for (const max_depth of [-1, 0.5, true]) await assert.rejects(sdk.scraper_sitemap(url, { token, max_depth }), RangeError);
    for (const limit of [0, 0.5, true]) await assert.rejects(sdk.scraper_sitemap(url, { token, limit }), RangeError);
    await assert.rejects(sdk.scraper_sitemap(url, { token, include_patterns: [] }), TypeError);
    await assert.rejects(sdk.scrape_brand(url, { token, bundle: "invalid" }), TypeError);
    await assert.rejects(sdk.get_brand(" ", { token }), TypeError);
    await assert.rejects(sdk.get_brand("job", { token, output: "invalid" }), TypeError);
    await assert.rejects(sdk.get_brand("job", { token, timeout: 0 }), RangeError);
  });
  for (const name of [...scraping, "get_brand"]) {
    await withFetch(async () => Response.json({ error: `bad ${token}` }, { status: 422 }), async () => {
      await assert.rejects(sdk[name](url, { token }), (error) => error instanceof sdk.MrScraperError && error.status === 422 && !error.message.includes(token));
    });
  }
});

test("JSON suffix media types are parsed as structured data", async () => {
  await withFetch(async () => new Response('{"result":"ok"}', { headers: { "content-type": "application/vnd.brand+json; charset=utf-8" } }), async () => {
    const result = await sdk.get_brand("job", { token });
    assert.deepEqual(result.data, { result: "ok" });
  });
});

test("all scraping services run over native fetch against a local HTTP contract", async () => {
  const observed = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    observed.push({ endpoint: new URL(req.url, "http://local"), method: req.method, body: Buffer.concat(chunks).toString(), token: req.headers["x-api-token"] });
    const endpoint = observed.at(-1).endpoint;
    if (endpoint.searchParams.has("screenshot") || endpoint.searchParams.get("output") === "bundle") {
      res.setHeader("content-type", endpoint.searchParams.has("screenshot") ? "image/png" : "application/zip");
      res.end(Buffer.from([0, 255, 128]));
    } else {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "local-job" }));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const nativeFetch = globalThis.fetch;
  try {
    await withFetch((input, init) => {
      const endpoint = new URL(input);
      endpoint.protocol = "http:";
      endpoint.host = `127.0.0.1:${server.address().port}`;
      return nativeFetch(endpoint, init);
    }, async () => {
      for (const name of ["scraper_html", "scraper_markdown", "get_screenshot", "scraper_json", "scraper_multiple_page", "scraper_sitemap", "scrape_brand"]) {
        const result = await sdk[name](url, { token });
        assert.equal(result.status_code, 200);
        if (name === "get_screenshot") assert.deepEqual(result.data, Buffer.from([0, 255, 128]));
      }
      const result = await sdk.get_brand("local-job", { token, output: "bundle" });
      assert.deepEqual(result.data, Buffer.from([0, 255, 128]));
    });
    assert.equal(observed.length, 8);
    assert.equal(observed.every((request) => request.token === token), true);
    assert.equal(observed[2].method, "GET");
    assert.equal(observed[2].body, "");
    assert.equal(observed[2].endpoint.searchParams.get("screenshot"), "full");
    assert.equal(JSON.parse(observed[3].body).agent, "general");
    assert.equal(JSON.parse(observed[4].body).agent, "listing");
    assert.equal(JSON.parse(observed[5].body).agent, "map");
    assert.equal(observed[6].endpoint.searchParams.get("action"), "brand-scraping");
    assert.deepEqual(JSON.parse(observed[6].body), { url });
    assert.equal(observed[7].endpoint.pathname, "/neo/brand");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
