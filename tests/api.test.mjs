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

test("public API exposes exactly scraper_api, web_search, and account", () => {
  assert.deepEqual(Object.keys(sdk).sort(), ["MrScraperError", "account", "scraper_api", "web_search"]);
  const methods = Object.entries(sdk).filter(([, value]) => typeof value === "function" && value !== sdk.MrScraperError);
  assert.deepEqual(methods.map(([name]) => name).sort(), ["account", "scraper_api", "web_search"]);
});

test("package exports map exposes only the entry point", async () => {
  const { readFile } = await import("node:fs/promises");
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(manifest.exports), ["."]);
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

test("scraper_api sends every option in the GET query string", async () => {
  await withFetch(async (input, init) => {
    const endpoint = new URL(input);
    const params = endpoint.searchParams;
    assert.equal(endpoint.origin, "https://api.mrscraper.com");
    assert.equal(endpoint.pathname, "/");
    assert.equal(init.method, "GET");
    assert.equal(init.body, undefined);
    assert.equal(params.get("token"), "test-token");
    assert.equal(params.get("url"), "https://example.com/page?a=1&b=2");
    assert.equal(params.get("maxRetries"), "4");
    assert.equal(params.get("tokenCap"), "0");
    assert.equal(params.get("timeout"), "45");
    assert.equal(params.get("geoCode"), "ID");
    assert.equal(params.get("proxyCountry"), "SG");
    assert.equal(params.get("browserRendering"), "true");
    assert.equal(params.get("super"), "true");
    assert.equal(params.get("useProxy"), "false");
    assert.equal(params.get("proxy"), "user:pass@proxy.example:8000");
    assert.equal(params.get("html"), "true");
    assert.equal(params.get("markdown"), "true");
    assert.equal(params.get("screenshot"), "true");
    assert.equal(params.get("waitForSelector"), ".ready");
    assert.equal(params.get("waitUntil"), "networkidle");
    assert.equal(params.get("warmStart"), "true");
    assert.equal(params.get("blockResources"), "true");
    assert.equal(params.get("bypassProxy"), "true");
    assert.equal(params.get("cookieJar"), "domain=example.com&country=sg");
    assert.deepEqual(JSON.parse(params.get("headers")), { "accept-language": "en-US" });
    assert.equal(params.get("stream"), "false");
    for (const key of ["agent", "prompt", "action", "bundle"]) assert.equal(params.has(key), false);
    assert.equal(init.headers.Authorization, "Bearer test-token");
    assert.equal(init.headers["x-api-token"], "test-token");
    assert.equal(init.headers["x-discard-token-secret"], "discard-secret");
    return Response.json({ html: "<html></html>", markdown: "# Page", screenshot: "iVBORw0KGgo=" }, {
      headers: { "x-test": "yes" },
    });
  }, async () => {
    const result = await sdk.scraper_api("https://example.com/page?a=1&b=2", {
      token: "test-token",
      html: true,
      markdown: true,
      screenshot: true,
      timeout: 45,
      geo_code: "ID",
      proxy_country: "SG",
      browser_rendering: false,
      super: true,
      use_proxy: false,
      proxy: "user:pass@proxy.example:8000",
      wait_for_selector: ".ready",
      wait_until: "networkidle",
      home_page: true,
      block_resources: true,
      bypass_proxy: true,
      cookie_jar: "domain=example.com&country=sg",
      headers: { "accept-language": "en-US" },
      max_retries: 4,
      token_cap: 0,
      stream: false,
      discard_token_secret: "discard-secret",
    });
    assert.deepEqual(result.data, { html: "<html></html>", markdown: "# Page", screenshot: "iVBORw0KGgo=" });
    assert.equal(result.status_code, 200);
    assert.equal(result.headers["x-test"], "yes");
  });
});

test("scraper_api defaults to HTML only and returns the HTML string", async () => {
  await withFetch(async (input, init) => {
    const params = new URL(input).searchParams;
    assert.equal(init.method, "GET");
    assert.equal(init.body, undefined);
    assert.deepEqual([...params.keys()].sort(), ["geoCode", "html", "markdown", "maxRetries", "timeout", "token", "url"]);
    assert.equal(params.get("url"), "https://example.com");
    assert.equal(params.get("geoCode"), "US");
    assert.equal(params.get("timeout"), "120");
    assert.equal(params.get("maxRetries"), "3");
    assert.equal(params.get("html"), "true");
    assert.equal(params.get("markdown"), "false");
    return new Response("<html>ok</html>", { headers: { "content-type": "text/html; charset=utf-8" } });
  }, async () => {
    const result = await sdk.scraper_api("https://example.com", { token: "test-token" });
    assert.equal(result.data, "<html>ok</html>");
  });
});

test("scraper_api supports each output alone and preserves explicit false values", async () => {
  for (const [outputs, expected] of [
    [{ html: false, markdown: true }, { html: "false", markdown: "true", screenshot: null, browserRendering: "false" }],
    [{ html: false, screenshot: true }, { html: "false", markdown: "false", screenshot: "true", browserRendering: "true" }],
  ]) {
    await withFetch(async (input, init) => {
      const params = new URL(input).searchParams;
      assert.equal(init.method, "GET");
      for (const [key, value] of Object.entries(expected)) assert.equal(params.get(key), value);
      return Response.json({});
    }, () => sdk.scraper_api("https://example.com", { token: "test-token", browser_rendering: false, ...outputs }));
  }
});

test("scraper_api validates outputs and page options before sending", async () => {
  await withFetch(async () => assert.fail("invalid input must not be sent"), async () => {
    await assert.rejects(sdk.scraper_api("https://example.com", { token: "x", html: false }),
      /At least one of html, markdown, or screenshot must be true/);
    await assert.rejects(sdk.scraper_api("https://example.com", { token: "x", html: false, markdown: false, screenshot: false }), TypeError);
    for (const name of ["html", "markdown", "screenshot"]) {
      for (const value of ["true", 1, null, "full"]) {
        await assert.rejects(sdk.scraper_api("https://example.com", { token: "x", [name]: value }), TypeError);
      }
    }
    for (const timeout of [0, 301, Infinity, NaN]) {
      await assert.rejects(sdk.scraper_api("https://example.com", { token: "x", timeout }), RangeError);
    }
    for (const max_retries of [-1, 0.5, NaN]) {
      await assert.rejects(sdk.scraper_api("https://example.com", { token: "x", max_retries }), RangeError);
    }
    for (const token_cap of [-1, 0.5]) {
      await assert.rejects(sdk.scraper_api("https://example.com", { token: "x", token_cap }), RangeError);
    }
    await assert.rejects(sdk.scraper_api("https://example.com", { token: "x", super: "true" }), TypeError);
  });
});

test("web_search posts the websearch action with query, country, and numResults", async () => {
  await withFetch(async (input, init) => {
    assert.equal(new URL(input).href, "https://api.mrscraper.com/");
    assert.equal(new URL(input).search, "");
    assert.equal(init.method, "POST");
    assert.equal(init.headers["x-api-token"], "test-token");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(init.body), {
      action: "websearch", query: "e-menessaptieka.lv linkedin", country: "us", numResults: 25,
    });
    return Response.json({
      success: true, message: "Search completed",
      data: [{ rank: 1, title: "Result", url: "https://example.com", description: "About", source: "example.com" }],
    });
  }, async () => {
    const result = await sdk.web_search("  e-menessaptieka.lv linkedin ", {
      token: "test-token", country: " us ", num_results: 25,
    });
    assert.equal(result.status_code, 200);
    assert.equal(result.data.success, true);
    assert.deepEqual(result.data.data[0], {
      rank: 1, title: "Result", url: "https://example.com", description: "About", source: "example.com",
    });
  });
});

test("web_search defaults numResults to 10 and omits an unset country", async () => {
  for (const country of [undefined, null]) {
    await withFetch(async (_input, init) => {
      assert.deepEqual(JSON.parse(init.body), { action: "websearch", query: "python web scraping", numResults: 10 });
      return Response.json({ success: true, message: "Search completed", data: [] });
    }, () => sdk.web_search("python web scraping", { token: "test-token", country }));
  }
});

test("web_search accepts the numResults bounds and validates inputs before sending", async () => {
  for (const num_results of [10, 100]) {
    await withFetch(async (_input, init) => {
      assert.equal(JSON.parse(init.body).numResults, num_results);
      return Response.json({ success: true, data: [] });
    }, () => sdk.web_search("query", { token: "test-token", num_results }));
  }
  await withFetch(async () => assert.fail("invalid input must not be sent"), async () => {
    for (const query of ["", "   ", undefined, 5]) {
      await assert.rejects(sdk.web_search(query, { token: "x" }), TypeError);
    }
    for (const num_results of [9, 101, 0, 10.5, NaN, "10", true]) {
      await assert.rejects(sdk.web_search("query", { token: "x", num_results }), RangeError);
    }
    for (const country of ["", "  ", 1]) {
      await assert.rejects(sdk.web_search("query", { token: "x", country }), TypeError);
    }
    for (const timeout of [0, -1, Infinity, NaN]) {
      await assert.rejects(sdk.web_search("query", { token: "x", timeout }), RangeError);
    }
  });
});

test("errors carry status and do not disclose a token", async () => {
  await withFetch(async () => new Response('{"message":"bad secret-token"}', {
    status: 422, headers: { "content-type": "application/json" },
  }), async () => {
    await assert.rejects(
      sdk.scraper_api("https://example.com", { token: "secret-token" }),
      (error) => error instanceof sdk.MrScraperError && error.status === 422 && !error.message.includes("secret-token"),
    );
  });
  await withFetch(async () => Response.json({ message: "numResults must be between 10 and 100" }, { status: 400 }), async () => {
    await assert.rejects(
      sdk.web_search("test", { token: "test-token" }),
      (error) => error instanceof sdk.MrScraperError && error.status === 400 && /numResults/.test(error.message),
    );
  });
  await withFetch(async () => Response.json({ message: "Unauthorized access", data: null }, { status: 401 }), async () => {
    await assert.rejects(
      sdk.web_search("test", { token: "bad-token" }),
      (error) => error instanceof sdk.MrScraperError && error.status === 401,
    );
  });
});

test("public methods reject missing credentials before fetching", async () => {
  const original = process.env.MRSCRAPER_API_TOKEN;
  try {
    delete process.env.MRSCRAPER_API_TOKEN;
    await withFetch(async () => assert.fail("should not fetch"), async () => {
      await assert.rejects(sdk.scraper_api("https://example.com"), sdk.MrScraperError);
      await assert.rejects(sdk.web_search("query"), sdk.MrScraperError);
    });
  } finally {
    if (original !== undefined) process.env.MRSCRAPER_API_TOKEN = original;
  }
});

test("network failures have no HTTP status and redact the token", async () => {
  await withFetch(async () => { throw new Error("connection failed for test-token"); }, async () => {
    for (const run of [
      () => sdk.scraper_api("https://example.com", { token: "test-token" }),
      () => sdk.web_search("query", { token: "test-token" }),
    ]) {
      await assert.rejects(run(), (error) => error instanceof sdk.MrScraperError
        && error.status === undefined
        && error.message === "connection failed for [REDACTED]");
    }
  });
});
