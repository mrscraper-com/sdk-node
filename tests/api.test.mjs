import test from "node:test";
import assert from "node:assert/strict";
import * as sdk from "../dist/index.js";

async function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("public API has only two request functions", () => {
  assert.deepEqual(Object.keys(sdk).sort(), ["MrScraperError", "scraper_api", "web_search"]);
});

test("scraper_api matches Python request mapping and parses JSON wrapper", async () => {
  await withFetch(async (input, init) => {
    const endpoint = new URL(input);
    const params = endpoint.searchParams;
    assert.equal(endpoint.origin, "https://api.mrscraper.com");
    assert.equal(endpoint.pathname, "/");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), {
      url: "https://example.com/page",
      maxRetries: 4,
      tokenCap: 0,
    });
    assert.equal(params.get("token"), "test-token");
    assert.equal(params.get("timeout"), "45");
    assert.equal(params.get("geoCode"), "ID");
    assert.equal(params.get("proxyCountry"), "SG");
    assert.equal(params.get("browserRendering"), "true");
    assert.equal(params.get("super"), "true");
    assert.equal(params.get("useProxy"), "false");
    assert.equal(params.get("proxy"), "user:pass@proxy.example:8000");
    assert.equal(params.get("html"), "false");
    assert.equal(params.get("markdown"), "true");
    assert.equal(params.get("waitForSelector"), ".ready");
    assert.equal(params.get("warmStart"), "true");
    assert.equal(params.get("screenshot"), "true");
    assert.equal(params.get("blockResources"), "true");
    assert.equal(params.get("bypassProxy"), "true");
    assert.equal(params.get("cookieJar"), "domain=example.com&country=sg");
    assert.deepEqual(JSON.parse(params.get("headers")), { "accept-language": "en-US" });
    assert.equal(params.get("stream"), "false");
    assert.equal(init.headers.Authorization, "Bearer test-token");
    assert.equal(init.headers["x-api-token"], "test-token");
    assert.equal(init.headers["x-discard-token-secret"], "discard-secret");
    return new Response('{"ok":true}', {
      status: 200,
      headers: { "content-type": "application/json", "x-test": "yes" },
    });
  }, async () => {
    const result = await sdk.scraper_api("https://example.com/page", {
      token: "test-token",
      timeout: 45,
      geo_code: "ID",
      proxy_country: "SG",
      browser_rendering: false,
      super: true,
      use_proxy: false,
      proxy: "user:pass@proxy.example:8000",
      html: false,
      markdown: true,
      wait_for_selector: ".ready",
      home_page: true,
      screenshot: true,
      block_resources: true,
      bypass_proxy: true,
      cookie_jar: "domain=example.com&country=sg",
      headers: { "accept-language": "en-US" },
      max_retries: 4,
      token_cap: 0,
      stream: false,
      discard_token_secret: "discard-secret",
    });
    assert.deepEqual(result.data, { ok: true });
    assert.equal(result.status_code, 200);
    assert.equal(result.headers["x-test"], "yes");
  });
});

test("scraper_api defaults and explicit false values", async () => {
  await withFetch(async (input, init) => {
    const params = new URL(input).searchParams;
    assert.deepEqual(JSON.parse(init.body), { url: "https://example.com", maxRetries: 3 });
    assert.equal(params.get("geoCode"), "US");
    assert.equal(params.get("timeout"), "120");
    assert.equal(params.get("html"), "true");
    assert.equal(params.get("markdown"), "false");
    assert.equal(params.get("browserRendering"), "false");
    for (const key of ["super", "useProxy", "screenshot", "warmStart", "blockResources", "stream"]) {
      assert.equal(params.has(key), false);
    }
    return new Response("<html>ok</html>", { headers: { "content-type": "text/html" } });
  }, async () => {
    const result = await sdk.scraper_api("https://example.com", {
      token: "test-token", browser_rendering: false,
    });
    assert.equal(result.data, "<html>ok</html>");
  });
});

test("web_search normalizes URL, overrides URL values, and selects JSON", async () => {
  await withFetch(async (input, init) => {
    assert.equal(input, "https://sync.scraper.mrscraper.com/api/google/serp/v2/sync");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer test-token");
    assert.equal(init.headers["x-api-token"], "test-token");
    assert.deepEqual(JSON.parse(init.body), {
      query: "running shoes", region: "id", language: "en", page: 4,
      format: "json", renderJs: true,
    });
    return new Response('{"results":[]}', { headers: { "content-type": "application/json" } });
  }, async () => {
    const result = await sdk.web_search(
      "https://www.google.com/search?q=running+shoes&gl=us&hl=fr&start=20",
      { token: "test-token", raw: false, region: "id", language: "en", page: 4, render_js: true },
    );
    assert.deepEqual(result.data, { results: [] });
  });
});

test("web_search defaults to HTML and derives page from start", async () => {
  await withFetch(async (_input, init) => {
    assert.deepEqual(JSON.parse(init.body), {
      query: "iphone 17", region: "us", language: "en", page: 3,
      format: "html", renderJs: false,
    });
    return new Response("<html>results</html>");
  }, async () => {
    const result = await sdk.web_search(
      "https://www.google.com/search?q=iphone+17&gl=us&hl=en&start=20",
      { token: "test-token" },
    );
    assert.equal(result.data, "<html>results</html>");
  });
});

test("errors carry status and do not disclose a query token", async () => {
  await withFetch(async () => new Response('{"message":"bad secret-token"}', {
    status: 422, headers: { "content-type": "application/json" },
  }), async () => {
    await assert.rejects(
      sdk.scraper_api("https://example.com", { token: "secret-token" }),
      (error) => error instanceof sdk.MrScraperError && error.status === 422 && !error.message.includes("secret-token"),
    );
  });
  await withFetch(async () => new Response("unauthorized", { status: 401 }), async () => {
    await assert.rejects(
      sdk.web_search("test", { token: "bad-token" }),
      (error) => error instanceof sdk.MrScraperError && error.status === 401,
    );
  });
});

test("validates options before sending", async () => {
  await withFetch(async () => { throw new Error("should not fetch"); }, async () => {
    await assert.rejects(sdk.scraper_api("https://example.com", { token: "x", timeout: 301 }), RangeError);
    await assert.rejects(sdk.scraper_api("https://example.com", { token: "x", max_retries: -1 }), RangeError);
    await assert.rejects(sdk.web_search("", { token: "x" }), TypeError);
    await assert.rejects(sdk.web_search("https://google.com/search?hl=en", { token: "x" }), TypeError);
    await assert.rejects(sdk.web_search("test", { token: "x", page: 0 }), RangeError);
  });
});

test("web_search accepts plain query text with default HTML format", async () => {
  await withFetch(async (_input, init) => {
    assert.deepEqual(JSON.parse(init.body), {
      query: "iphone 17", format: "html", renderJs: false,
    });
    return new Response("<html>results</html>");
  }, async () => {
    const result = await sdk.web_search("  iphone 17  ", { token: "test-token" });
    assert.equal(result.data, "<html>results</html>");
  });
});

test("network failures have no HTTP status", async () => {
  await withFetch(async () => { throw new Error("connection failed"); }, async () => {
    await assert.rejects(
      sdk.scraper_api("https://example.com", { token: "test-token" }),
      (error) => error instanceof sdk.MrScraperError
        && error.status === undefined
        && error.message === "connection failed",
    );
  });
});
