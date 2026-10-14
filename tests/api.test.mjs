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

test("public API has three request functions", () => {
  assert.deepEqual(Object.keys(sdk).sort(), ["MrScraperError", "account", "scraper_api", "web_search"]);
});

test("account uses an authenticated GET and returns a safe subscription summary", async () => {
  const details = {
    stripeStatus: "active", isEnterprise: true, tokenLimit: "100", tokenUsage: 25,
    rateLimit: 10, rateTtl: 60, isAutoRenew: true, endsAt: "2026-11-01T00:00:00Z",
    stripeCustomerId: "private-billing-id",
    user: { name: "Test User", email: "user@example.com", isVerified: true, latestApiToken: "private-key" },
  };
  for (const body of [details, { message: "ok", data: details }]) {
    await withFetch(async (input, init) => {
      assert.equal(String(input), "https://api.app.mrscraper.com/api/v1/subscription-accounts");
      assert.equal(init.method, "GET");
      assert.equal(init.body, undefined);
      assert.equal(init.headers.Authorization, "Bearer test-token");
      assert.equal(init.headers["x-api-token"], "test-token");
      return Response.json(body, { headers: { "set-cookie": "session=private", "x-request-id": "req-1" } });
    }, async () => {
      const result = await sdk.account({ token: "test-token" });
      assert.equal(result.status_code, 200);
      assert.deepEqual(result.data, {
        subscription_status: "active", enterprise: true,
        token_usage: 25, token_limit: 100, token_remaining: 75, usage_percent: 25,
        rate_limit: 10, rate_ttl: 60, auto_renew: true, ends_at: "2026-11-01T00:00:00Z",
        user: { name: "Test User", email: "user@example.com", verified: true },
      });
      assert.equal(result.headers["x-request-id"], "req-1");
      assert.doesNotMatch(JSON.stringify(result), /private|stripeCustomerId|latestApiToken/);
    });
  }
});

test("account handles absent quotas and clamps remaining tokens at zero", async () => {
  for (const details of [{}, { tokenLimit: 10, tokenUsage: 15 }]) {
    await withFetch(async () => Response.json({ data: details }), async () => {
      const result = await sdk.account({ token: "test-token" });
      assert.equal(result.data.token_remaining, 0);
      assert.equal(result.data.usage_percent, details.tokenLimit ? 150 : 0);
      assert.deepEqual(result.data.user, { name: null, email: null, verified: false });
    });
  }
});

test("account uses environment credentials and rejects missing credentials before fetching", async () => {
  const original = process.env.MRSCRAPER_API_TOKEN;
  try {
    process.env.MRSCRAPER_API_TOKEN = "environment-token";
    await withFetch(async (_input, init) => {
      assert.equal(init.headers.Authorization, "Bearer environment-token");
      return Response.json({});
    }, () => sdk.account());
    delete process.env.MRSCRAPER_API_TOKEN;
    await withFetch(async () => assert.fail("should not fetch"), async () => {
      await assert.rejects(sdk.account(), sdk.MrScraperError);
      for (const timeout of [0, -1, Infinity, NaN]) {
        await assert.rejects(sdk.account({ token: "test-token", timeout }), RangeError);
      }
    });
  } finally {
    if (original === undefined) delete process.env.MRSCRAPER_API_TOKEN;
    else process.env.MRSCRAPER_API_TOKEN = original;
  }
});

test("account preserves HTTP failures and rejects malformed account payloads", async () => {
  for (const status of [401, 403, 500]) {
    await withFetch(async () => Response.json({ error: "bad test-token" }, { status }), async () => {
      await assert.rejects(sdk.account({ token: "test-token" }), (error) =>
        error instanceof sdk.MrScraperError && error.status === status && !error.message.includes("test-token"));
    });
  }
  for (const body of [null, [], { data: null }]) {
    await withFetch(async () => Response.json(body), async () => {
      await assert.rejects(sdk.account({ token: "test-token" }), /Account response must contain an object/);
    });
  }
});

test("account enforces its HTTP deadline while reading the body", async () => {
  await withFetch(async (_input, init) => ({
    status: 200, ok: true, headers: new Headers({ "content-type": "application/json" }),
    json: () => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  }), async () => {
    await assert.rejects(sdk.account({ token: "test-token", timeout: 0.01 }), (error) =>
      error instanceof sdk.MrScraperError && error.status === undefined && error.message === "aborted");
  });
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
