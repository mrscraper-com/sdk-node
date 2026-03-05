import { URL, URLSearchParams } from "node:url";

type Json = Record<string, unknown>;

export type ApiResult =
  | { ok: true; status: number; headers: Record<string, string>; data: unknown }
  | { ok: false; status?: number; error: string };

function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((v, k) => (out[k] = v));
  return out;
}

function requireToken(explicitToken?: string): string {
  const token = explicitToken ?? process.env.MRSCRAPER_API_TOKEN;
  if (!token) {
    throw new Error(
      "Missing API token. Set MRSCRAPER_API_TOKEN environment variable.",
    );
  }
  return token;
}

export async function fetchHtml(args: {
  url: string;
  timeout?: number; // seconds
  geoCode?: string;
  blockResources?: boolean;
  token?: string; // optional override
}): Promise<ApiResult> {
  const token = requireToken(args.token);

  const base = new URL("https://api.mrscraper.com/");
  const params = new URLSearchParams({
    token,
    timeout: String(args.timeout ?? 120),
    geoCode: args.geoCode ?? "US",
    url: args.url,
    blockResources: String(!!args.blockResources).toLowerCase(),
  });

  base.search = params.toString();

  const controller = new AbortController();
  const hardTimeoutMs = ((args.timeout ?? 120) + 30) * 1000;
  const t = setTimeout(() => controller.abort(), hardTimeoutMs);

  try {
    const res = await fetch(base.toString(), { signal: controller.signal });
    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";

    if (res.status === 401) {
      return {
        ok: false,
        status: 401,
        error: "Unauthorized or invalid token.",
      };
    }

    const data = contentType.includes("application/json")
      ? await res.json()
      : await res.text();

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof data === "string" ? data : JSON.stringify(data),
      };
    }

    return {
      ok: true,
      status: res.status,
      headers: headersToObject(res.headers),
      data,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  } finally {
    clearTimeout(t);
  }
}

export async function postJson(args: {
  url: string;
  token?: string; // optional override
  body: Json;
  timeoutMs?: number;
}): Promise<ApiResult> {
  const token = requireToken(args.token);

  const controller = new AbortController();
  const timeoutMs = args.timeoutMs ?? 600_000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(args.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-token": token,
      },
      body: JSON.stringify(args.body),
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    const data = contentType.includes("application/json")
      ? await res.json()
      : await res.text();

    if (res.status === 401) {
      return {
        ok: false,
        status: 401,
        error: "Unauthorized or invalid token.",
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof data === "string" ? data : JSON.stringify(data),
      };
    }

    return {
      ok: true,
      status: res.status,
      headers: headersToObject(res.headers),
      data,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  } finally {
    clearTimeout(t);
  }
}

export async function getJson(args: {
  url: string;
  token?: string;
  timeoutMs?: number;
}): Promise<ApiResult> {
  const token = requireToken(args.token);

  const controller = new AbortController();
  const timeoutMs = args.timeoutMs ?? 600_000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(args.url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-token": token,
      },
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    const data = contentType.includes("application/json")
      ? await res.json()
      : await res.text();

    if (res.status === 401) {
      return {
        ok: false,
        status: 401,
        error: "Unauthorized or invalid token.",
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof data === "string" ? data : JSON.stringify(data),
      };
    }

    return {
      ok: true,
      status: res.status,
      headers: headersToObject(res.headers),
      data,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  } finally {
    clearTimeout(t);
  }
}
