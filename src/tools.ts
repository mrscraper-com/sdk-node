import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchHtml, getJson, postJson } from "./api.js";
import { URLSearchParams } from "node:url";

function asTextContent(obj: unknown) {
  return [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }];
}

export function registerTools(server: McpServer) {
  server.tool(
    "fetch_html",
    "Fetch raw HTML (or JSON) of a URL using MrScraper Fetch endpoint.",
    {
      url: z.string().url(),
      timeout: z.number().int().min(1).max(600).default(120),
      geo_code: z.string().length(2).default("US"),
      block_resources: z.boolean().default(false),
      token: z.string().optional(),
    },
    async (args) => {
      const r = await fetchHtml({
        url: args.url,
        timeout: args.timeout,
        geoCode: args.geo_code,
        blockResources: args.block_resources,
        token: args.token,
      });
      return { content: asTextContent(r), isError: !r.ok };
    },
  );

  server.tool(
    "create_ai_scraper",
    "Create an AI scraper (general/listing/map) via MrScraper API.",
    {
      url: z.string().url(),
      message: z.string().default(""),
      agent: z.enum(["general", "listing", "map"]).default("general"),
      proxy_country: z.string().nullable().optional(),
      max_depth: z.number().int().min(0).max(5).default(2),
      max_pages: z.number().int().min(1).max(1000).default(50),
      limit: z.number().int().min(1).max(100000).default(1000),
      include_patterns: z.string().default(""),
      exclude_patterns: z.string().default(""),
      token: z.string().optional(),
    },
    async (args) => {
      const endpoint = "https://api.app.mrscraper.com/api/v1/scrapers-ai";
      const body =
        args.agent === "map"
          ? {
              url: args.url,
              agent: args.agent,
              maxDepth: args.max_depth,
              maxPages: args.max_pages,
              limit: args.limit,
              includePatterns: args.include_patterns,
              excludePatterns: args.exclude_patterns,
            }
          : {
              url: args.url,
              message: args.message,
              agent: args.agent,
              proxyCountry: args.proxy_country ?? null,
            };

      const r = await postJson({ url: endpoint, body, token: args.token });
      return { content: asTextContent(r), isError: !r.ok };
    },
  );

  server.tool(
    "rerun_ai_scraper",
    "Rerun an AI scraper by scraperId on a new URL.",
    {
      scraper_id: z.string().min(1),
      url: z.string().url(),
      max_depth: z.number().int().min(0).max(5).default(2),
      max_pages: z.number().int().min(1).max(1000).default(50),
      limit: z.number().int().min(1).max(100000).default(1000),
      include_patterns: z.string().default(""),
      exclude_patterns: z.string().default(""),
      token: z.string().optional(),
    },
    async (args) => {
      const endpoint = "https://api.app.mrscraper.com/api/v1/scrapers-ai-rerun";
      const body = {
        scraperId: args.scraper_id,
        url: args.url,
        maxDepth: args.max_depth,
        maxPages: args.max_pages,
        limit: args.limit,
        includePatterns: args.include_patterns,
        excludePatterns: args.exclude_patterns,
      };
      const r = await postJson({ url: endpoint, body, token: args.token });
      return { content: asTextContent(r), isError: !r.ok };
    },
  );

  server.tool(
    "bulk_rerun_ai_scraper",
    "Rerun an AI scraper on multiple URLs (bulk).",
    {
      scraper_id: z.string().min(1),
      urls: z.array(z.string().url()).min(1),
      token: z.string().optional(),
    },
    async (args) => {
      const endpoint =
        "https://api.app.mrscraper.com/api/v1/scrapers-ai-rerun/bulk";
      const body = { scraperId: args.scraper_id, urls: args.urls };
      const r = await postJson({ url: endpoint, body, token: args.token });
      return { content: asTextContent(r), isError: !r.ok };
    },
  );

  server.tool(
    "rerun_manual_scraper",
    "Rerun a manual scraper (configured in dashboard) on a URL.",
    {
      scraper_id: z.string().min(1),
      url: z.string().url(),
      token: z.string().optional(),
    },
    async (args) => {
      const endpoint =
        "https://api.app.mrscraper.com/api/v1/scrapers-manual-rerun";
      const body = { scraperId: args.scraper_id, url: args.url };
      const r = await postJson({ url: endpoint, body, token: args.token });
      return { content: asTextContent(r), isError: !r.ok };
    },
  );

  server.tool(
    "bulk_rerun_manual_scraper",
    "Rerun a manual scraper on multiple URLs (bulk).",
    {
      scraper_id: z.string().min(1),
      urls: z.array(z.string().url()).min(1),
      token: z.string().optional(),
    },
    async (args) => {
      const endpoint =
        "https://api.app.mrscraper.com/api/v1/scrapers-manual-rerun/bulk";
      const body = { scraperId: args.scraper_id, urls: args.urls };
      const r = await postJson({ url: endpoint, body, token: args.token });
      return { content: asTextContent(r), isError: !r.ok };
    },
  );

  server.tool(
    "get_all_results",
    "List results with sorting/pagination/search.",
    {
      sort_field: z
        .enum([
          "createdAt",
          "updatedAt",
          "id",
          "type",
          "url",
          "status",
          "error",
          "tokenUsage",
          "runtime",
        ])
        .default("updatedAt"),
      sort_order: z.enum(["ASC", "DESC"]).default("DESC"),
      page_size: z.number().int().min(1).max(500).default(10),
      page: z.number().int().min(1).default(1),
      search: z.string().optional(),
      date_range_column: z.string().optional(),
      start_at: z.string().optional(),
      end_at: z.string().optional(),
      token: z.string().optional(),
    },
    async (args) => {
      const endpoint = "https://api.app.mrscraper.com/api/v1/results";

      const params = new URLSearchParams({
        sortField: args.sort_field,
        sortOrder: args.sort_order,
        pageSize: String(args.page_size),
        page: String(args.page),
      });

      if (args.search) params.set("search", args.search);
      if (args.date_range_column)
        params.set("dateRangeColumn", args.date_range_column);
      if (args.start_at) params.set("startAt", args.start_at);
      if (args.end_at) params.set("endAt", args.end_at);

      const url = `${endpoint}?${params.toString()}`;
      const r = await getJson({ url, token: args.token });
      return { content: asTextContent(r), isError: !r.ok };
    },
  );

  server.tool(
    "get_result_by_id",
    "Get a specific result by ID.",
    {
      result_id: z.string().min(1),
      token: z.string().optional(),
    },
    async (args) => {
      const url = `https://api.app.mrscraper.com/api/v1/results/${encodeURIComponent(
        args.result_id,
      )}`;
      const r = await getJson({ url, token: args.token });
      return { content: asTextContent(r), isError: !r.ok };
    },
  );
}
