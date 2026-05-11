import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { normalizeDomain } from "@/lib/domain";

export const runtime = "nodejs";

type ToolId =
  | "meta-description"
  | "title-tag"
  | "robots-txt"
  | "sitemap"
  | "schema-markup";

const ALLOWED: ReadonlySet<ToolId> = new Set([
  "meta-description",
  "title-tag",
  "robots-txt",
  "sitemap",
  "schema-markup",
]);

async function fetchWithTimeout(url: string, timeout = 12000): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SitebeatToolsBot/1.0; +https://sitebeat.tech)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
}

function originFromDomain(domain: string): string {
  return `https://${domain}`;
}

interface ToolResult {
  ok: boolean;
  status: "pass" | "warn" | "fail";
  summary: string;
  detail?: string;
  data?: Record<string, unknown>;
}

async function checkMetaDescription(domain: string): Promise<ToolResult> {
  const res = await fetchWithTimeout(originFromDomain(domain));
  if (!res.ok) {
    return { ok: false, status: "fail", summary: `Could not fetch the page (HTTP ${res.status}).` };
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const desc = ($('meta[name="description"]').attr("content") ?? "").trim();
  const len = desc.length;
  if (!desc) {
    return {
      ok: true,
      status: "fail",
      summary: "No meta description found on the homepage.",
      detail:
        "Without a meta description, Google auto-generates a snippet from your page text — usually a generic chunk that lowers your click-through rate.",
      data: { description: null, length: 0 },
    };
  }
  if (len < 50) {
    return {
      ok: true,
      status: "warn",
      summary: `Meta description is too short (${len} chars).`,
      detail: "Aim for 120–160 characters so Google has enough to display.",
      data: { description: desc, length: len },
    };
  }
  if (len > 160) {
    return {
      ok: true,
      status: "warn",
      summary: `Meta description is long (${len} chars) — Google may truncate it.`,
      detail: "Trim to 120–160 characters so the full description shows.",
      data: { description: desc, length: len },
    };
  }
  return {
    ok: true,
    status: "pass",
    summary: `Meta description is ${len} characters — within the 120–160 sweet spot.`,
    data: { description: desc, length: len },
  };
}

async function checkTitleTag(domain: string): Promise<ToolResult> {
  const res = await fetchWithTimeout(originFromDomain(domain));
  if (!res.ok) {
    return { ok: false, status: "fail", summary: `Could not fetch the page (HTTP ${res.status}).` };
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const title = ($("title").first().text() ?? "").trim();
  const len = title.length;
  if (!title) {
    return {
      ok: true,
      status: "fail",
      summary: "No <title> tag found.",
      detail:
        "The title is the headline shown in search results. Without one, Google falls back to a heuristic — usually worse for click-through.",
      data: { title: null, length: 0 },
    };
  }
  if (len < 30) {
    return {
      ok: true,
      status: "warn",
      summary: `Title is short (${len} chars).`,
      detail: "Aim for 50–60 characters so the title carries enough keyword weight.",
      data: { title, length: len },
    };
  }
  if (len > 60) {
    return {
      ok: true,
      status: "warn",
      summary: `Title is long (${len} chars) — Google will truncate it.`,
      detail: "Trim to ≤60 chars so the full title shows in search results.",
      data: { title, length: len },
    };
  }
  return {
    ok: true,
    status: "pass",
    summary: `Title is ${len} characters — within the 30–60 sweet spot.`,
    data: { title, length: len },
  };
}

async function checkRobotsTxt(domain: string): Promise<ToolResult> {
  const url = `${originFromDomain(domain)}/robots.txt`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    return {
      ok: true,
      status: "fail",
      summary: `No robots.txt found (HTTP ${res.status} at ${url}).`,
      detail:
        "Without robots.txt, you have no way to tell crawlers which paths to skip — and no way to point them at your sitemap.",
    };
  }
  const body = (await res.text()).slice(0, 50_000);
  const hasSitemap = /^\s*sitemap:/im.test(body);
  const disallowsAll = /^\s*Disallow:\s*\/\s*$/im.test(body);
  if (disallowsAll) {
    return {
      ok: true,
      status: "fail",
      summary: "robots.txt blocks all crawlers (Disallow: /).",
      detail: "This will deindex your entire site. Remove the Disallow: / line immediately.",
      data: { robotsTxt: body },
    };
  }
  if (!hasSitemap) {
    return {
      ok: true,
      status: "warn",
      summary: "robots.txt exists but does not reference a sitemap.",
      detail: `Add a "Sitemap: ${originFromDomain(domain)}/sitemap.xml" line so crawlers find your sitemap automatically.`,
      data: { robotsTxt: body },
    };
  }
  return {
    ok: true,
    status: "pass",
    summary: "robots.txt is present and references a sitemap.",
    data: { robotsTxt: body },
  };
}

async function checkSitemap(domain: string): Promise<ToolResult> {
  const url = `${originFromDomain(domain)}/sitemap.xml`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    return {
      ok: true,
      status: "fail",
      summary: `No sitemap.xml found (HTTP ${res.status} at ${url}).`,
      detail:
        "Without a sitemap, large sites end up with pages that are never discovered by Google.",
    };
  }
  const body = (await res.text()).slice(0, 200_000);
  const urlCount = (body.match(/<loc>/g) ?? []).length;
  const isIndex = /<sitemapindex/i.test(body);
  if (urlCount === 0) {
    return {
      ok: true,
      status: "fail",
      summary: "Sitemap exists but contains zero URLs.",
      detail: "Verify your sitemap generator is including pages.",
    };
  }
  return {
    ok: true,
    status: "pass",
    summary: isIndex
      ? `Sitemap index found, references ${urlCount} child sitemaps.`
      : `Sitemap found with ${urlCount} URLs.`,
    data: { urlCount, isIndex },
  };
}

async function checkSchemaMarkup(domain: string): Promise<ToolResult> {
  const res = await fetchWithTimeout(originFromDomain(domain));
  if (!res.ok) {
    return { ok: false, status: "fail", summary: `Could not fetch the page (HTTP ${res.status}).` };
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const blocks = $('script[type="application/ld+json"]').toArray();
  if (blocks.length === 0) {
    return {
      ok: true,
      status: "fail",
      summary: "No JSON-LD structured data found.",
      detail:
        "Schema markup powers rich results (FAQ, Review stars, Sitelinks). Without it, you compete with plain blue links — not the visually rich entries.",
    };
  }
  const types: string[] = [];
  for (const b of blocks) {
    try {
      const raw = $(b).text();
      const parsed = JSON.parse(raw) as { "@type"?: string | string[] } | { "@type"?: string }[];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const it of items) {
        const t = (it as { "@type"?: string | string[] })["@type"];
        if (typeof t === "string") types.push(t);
        else if (Array.isArray(t)) types.push(...t);
      }
    } catch {
      // ignore parse errors — counted as malformed below
    }
  }
  if (types.length === 0) {
    return {
      ok: true,
      status: "warn",
      summary: `${blocks.length} JSON-LD block(s) found but none parsed cleanly.`,
      detail: "Validate your schema with Google's Rich Results Test.",
    };
  }
  return {
    ok: true,
    status: "pass",
    summary: `Schema present: ${[...new Set(types)].join(", ")}`,
    data: { types: [...new Set(types)] },
  };
}

const HANDLERS: Record<ToolId, (domain: string) => Promise<ToolResult>> = {
  "meta-description": checkMetaDescription,
  "title-tag": checkTitleTag,
  "robots-txt": checkRobotsTxt,
  sitemap: checkSitemap,
  "schema-markup": checkSchemaMarkup,
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { tool, url } = (body ?? {}) as { tool?: unknown; url?: unknown };

  if (typeof tool !== "string" || !ALLOWED.has(tool as ToolId)) {
    return NextResponse.json({ error: "unknown tool" }, { status: 400 });
  }
  if (typeof url !== "string") {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  const domain = normalizeDomain(url);
  if (!domain) {
    return NextResponse.json({ error: "invalid URL" }, { status: 400 });
  }

  try {
    const result = await HANDLERS[tool as ToolId](domain);
    return NextResponse.json({ ...result, domain });
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json(
      { ok: false, status: "fail", summary: `Check failed: ${msg.slice(0, 200)}` },
      { status: 200 },
    );
  }
}
