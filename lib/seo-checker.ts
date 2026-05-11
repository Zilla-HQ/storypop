import * as cheerio from "cheerio";

export interface SeoCheck {
  id: string;
  name: string;
  description: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  points: number;
  earned: number;
}

export interface AuditResult {
  score: number;
  checks: SeoCheck[];
  url: string;
  fetchedAt: string;
}

async function fetchPage(url: string): Promise<{ html: string; status: number; ttfb: number; finalUrl: string }> {
  const start = Date.now();
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SEOAuditBot/1.0)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  const ttfb = Date.now() - start;
  const html = await response.text();
  return { html, status: response.status, ttfb, finalUrl: response.url };
}

export async function runAudit(rawUrl: string): Promise<AuditResult> {
  // Normalize URL
  let url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  const checks: SeoCheck[] = [];
  let html = "";
  let httpStatus = 0;
  let ttfb = 0;
  let finalUrl = url;
  let fetchError = false;

  try {
    const result = await fetchPage(url);
    html = result.html;
    httpStatus = result.status;
    ttfb = result.ttfb;
    finalUrl = result.finalUrl;
  } catch (e) {
    fetchError = true;
  }

  const $ = cheerio.load(html);
  const parsedUrl = new URL(url);
  const origin = parsedUrl.origin;

  // 1. HTTPS Status
  const isHttps = url.startsWith("https://") || finalUrl.startsWith("https://");
  checks.push({
    id: "https",
    name: "HTTPS",
    description: "Page is served over HTTPS",
    status: fetchError ? "fail" : (isHttps ? "pass" : "fail"),
    detail: fetchError ? "Could not reach the page" : (isHttps ? "Page is served over HTTPS" : "Page is not served over HTTPS"),
    points: 10,
    earned: (!fetchError && isHttps) ? 10 : 0,
  });

  // 2. Meta Description
  const metaDesc = $('meta[name="description"]').attr("content") || "";
  const metaDescLen = metaDesc.length;
  let metaDescStatus: "pass" | "warn" | "fail" = "fail";
  let metaDescDetail = "No meta description found";
  let metaDescEarned = 0;
  if (metaDescLen >= 120 && metaDescLen <= 160) {
    metaDescStatus = "pass"; metaDescDetail = `Meta description is ${metaDescLen} characters (ideal)`; metaDescEarned = 8;
  } else if (metaDescLen > 0 && metaDescLen < 120) {
    metaDescStatus = "warn"; metaDescDetail = `Meta description is too short (${metaDescLen} chars, aim for 120-160)`; metaDescEarned = 4;
  } else if (metaDescLen > 160) {
    metaDescStatus = "warn"; metaDescDetail = `Meta description too long (${metaDescLen} chars, trim to 160)`; metaDescEarned = 4;
  }
  checks.push({ id: "meta_description", name: "Meta Description", description: "Page has an optimized meta description", status: metaDescStatus, detail: metaDescDetail, points: 8, earned: metaDescEarned });

  // 3. Heading Structure (H1-H3)
  const h1s = $("h1").length;
  const h2s = $("h2").length;
  const h3s = $("h3").length;
  let headingStatus: "pass" | "warn" | "fail" = "pass";
  let headingDetail = `${h1s} H1, ${h2s} H2, ${h3s} H3 tags found`;
  let headingEarned = 8;
  if (h1s === 0) { headingStatus = "fail"; headingDetail = "No H1 tag found"; headingEarned = 0; }
  else if (h1s > 1) { headingStatus = "warn"; headingDetail = `Multiple H1 tags (${h1s}) — use only one`; headingEarned = 4; }
  else if (h2s === 0) { headingStatus = "warn"; headingDetail = "H1 present but no H2 tags for structure"; headingEarned = 4; }
  checks.push({ id: "heading_structure", name: "Heading Structure", description: "Page uses proper H1-H3 hierarchy", status: headingStatus, detail: headingDetail, points: 8, earned: headingEarned });

  // 4. Page Load Speed (TTFB proxy)
  let speedStatus: "pass" | "warn" | "fail" = "pass";
  let speedDetail = `Server responded in ${ttfb}ms`;
  let speedEarned = 8;
  if (fetchError) { speedStatus = "fail"; speedDetail = "Could not measure — page unreachable"; speedEarned = 0; }
  else if (ttfb > 2000) { speedStatus = "fail"; speedDetail = `Slow TTFB: ${ttfb}ms (target < 600ms)`; speedEarned = 0; }
  else if (ttfb > 600) { speedStatus = "warn"; speedDetail = `TTFB is ${ttfb}ms (target < 600ms)`; speedEarned = 4; }
  checks.push({ id: "page_speed", name: "Page Load Speed", description: "Server responds quickly (TTFB < 600ms)", status: speedStatus, detail: speedDetail, points: 8, earned: speedEarned });

  // 5. Sitemap.xml
  let sitemapStatus: "pass" | "warn" | "fail" = "fail";
  let sitemapDetail = "No sitemap.xml found";
  let sitemapEarned = 0;
  try {
    const sitemapResp = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(5000) });
    if (sitemapResp.ok) { sitemapStatus = "pass"; sitemapDetail = "sitemap.xml found and accessible"; sitemapEarned = 8; }
    else { sitemapStatus = "fail"; sitemapDetail = `sitemap.xml returned ${sitemapResp.status}`; }
  } catch { sitemapStatus = "fail"; sitemapDetail = "sitemap.xml not found or unreachable"; }
  checks.push({ id: "sitemap", name: "Sitemap.xml", description: "Site has a sitemap.xml file", status: sitemapStatus, detail: sitemapDetail, points: 8, earned: sitemapEarned });

  // 6. Robots.txt
  let robotsStatus: "pass" | "warn" | "fail" = "fail";
  let robotsDetail = "No robots.txt found";
  let robotsEarned = 0;
  try {
    const robotsResp = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(5000) });
    const robotsText = await robotsResp.text();
    if (robotsResp.ok && robotsText.toLowerCase().includes("user-agent")) {
      robotsStatus = "pass"; robotsDetail = "robots.txt found with valid content"; robotsEarned = 6;
    } else if (robotsResp.ok) {
      robotsStatus = "warn"; robotsDetail = "robots.txt found but content may be invalid"; robotsEarned = 3;
    }
  } catch { robotsStatus = "fail"; robotsDetail = "robots.txt not found or unreachable"; }
  checks.push({ id: "robots_txt", name: "Robots.txt", description: "Site has a valid robots.txt file", status: robotsStatus, detail: robotsDetail, points: 6, earned: robotsEarned });

  // 7. Canonical Tag
  const canonical = $('link[rel="canonical"]').attr("href") || "";
  let canonicalStatus: "pass" | "warn" | "fail" = "fail";
  let canonicalDetail = "No canonical tag found";
  let canonicalEarned = 0;
  if (canonical) {
    canonicalStatus = "pass"; canonicalDetail = `Canonical tag set to: ${canonical.substring(0, 60)}`; canonicalEarned = 8;
  }
  checks.push({ id: "canonical", name: "Canonical Tag", description: "Page has a canonical URL tag", status: canonicalStatus, detail: canonicalDetail, points: 8, earned: canonicalEarned });

  // 8. Mobile Viewport
  const viewport = $('meta[name="viewport"]').attr("content") || "";
  const hasViewport = viewport.includes("width=device-width");
  checks.push({
    id: "mobile_viewport",
    name: "Mobile Viewport",
    description: "Page has a mobile-friendly viewport meta tag",
    status: hasViewport ? "pass" : "fail",
    detail: hasViewport ? "Viewport meta tag correctly configured" : "Missing or invalid viewport meta tag",
    points: 8,
    earned: hasViewport ? 8 : 0,
  });

  // 9. Language Attribute
  const lang = $("html").attr("lang") || "";
  checks.push({
    id: "lang_attribute",
    name: "Language Attribute",
    description: "HTML element has a language attribute",
    status: lang ? "pass" : "fail",
    detail: lang ? `Language set to: ${lang}` : "Missing lang attribute on <html> element",
    points: 4,
    earned: lang ? 4 : 0,
  });

  // 10. Image Alt Text
  const allImages = $("img");
  const imgsWithoutAlt = $("img:not([alt]), img[alt='']").length;
  const totalImgs = allImages.length;
  let altStatus: "pass" | "warn" | "fail" = "pass";
  let altDetail = `All ${totalImgs} images have alt text`;
  let altEarned = 8;
  if (totalImgs === 0) { altStatus = "pass"; altDetail = "No images found on page"; altEarned = 8; }
  else if (imgsWithoutAlt === totalImgs) { altStatus = "fail"; altDetail = `${imgsWithoutAlt}/${totalImgs} images missing alt text`; altEarned = 0; }
  else if (imgsWithoutAlt > 0) { altStatus = "warn"; altDetail = `${imgsWithoutAlt}/${totalImgs} images missing alt text`; altEarned = 4; }
  checks.push({ id: "image_alt", name: "Image Alt Text", description: "All images have descriptive alt attributes", status: altStatus, detail: altDetail, points: 8, earned: altEarned });

  // 11. Open Graph Tags
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const ogDesc = $('meta[property="og:description"]').attr("content") || "";
  const ogImage = $('meta[property="og:image"]').attr("content") || "";
  const ogCount = [ogTitle, ogDesc, ogImage].filter(Boolean).length;
  let ogStatus: "pass" | "warn" | "fail" = "fail";
  let ogDetail = "No Open Graph tags found";
  let ogEarned = 0;
  if (ogCount === 3) { ogStatus = "pass"; ogDetail = "og:title, og:description, og:image all present"; ogEarned = 6; }
  else if (ogCount > 0) { ogStatus = "warn"; ogDetail = `Only ${ogCount}/3 core OG tags (title, description, image) present`; ogEarned = 3; }
  checks.push({ id: "open_graph", name: "Open Graph Tags", description: "Page has Open Graph tags for social sharing", status: ogStatus, detail: ogDetail, points: 6, earned: ogEarned });

  // 12. Broken Links (sample check — first 10 internal links)
  const links = $("a[href]").map((_, el) => $(el).attr("href")).get().filter((href): href is string => !!href);
  const internalLinks = links.filter(href => {
    try {
      const abs = new URL(href, url);
      return abs.origin === parsedUrl.origin && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:");
    } catch { return false; }
  }).slice(0, 8);

  let brokenCount = 0;
  const linkChecks = await Promise.allSettled(
    internalLinks.map(href => {
      const abs = new URL(href, url).toString();
      return fetch(abs, { method: "HEAD", signal: AbortSignal.timeout(5000), redirect: "follow" });
    })
  );
  linkChecks.forEach(result => {
    if (result.status === "rejected") brokenCount++;
    else if (result.value.status >= 400) brokenCount++;
  });
  let linkStatus: "pass" | "warn" | "fail" = "pass";
  let linkDetail = internalLinks.length === 0 ? "No internal links to check" : `Checked ${internalLinks.length} links — none broken`;
  let linkEarned = 8;
  if (brokenCount > 0) { linkStatus = "fail"; linkDetail = `${brokenCount} broken link(s) found`; linkEarned = 0; }
  checks.push({ id: "broken_links", name: "Broken Links", description: "No broken internal links found", status: linkStatus, detail: linkDetail, points: 8, earned: linkEarned });

  // 13. Structured Data
  // We try JSON.parse first (strictly correct case) but fall back to a
  // regex extraction when parse fails — real-world JSON-LD often has
  // trailing commas, extra whitespace, or HTML comments that break
  // strict parse but still register with browsers' lenient parsers.
  // False-negatives here cost us credibility with SEO-savvy customers
  // (they look at their own page, see schema, and assume our audit
  // is broken).
  const schemaScripts = $('script[type="application/ld+json"]');
  let structuredStatus: "pass" | "warn" | "fail" = "fail";
  let structuredDetail = "No structured data (JSON-LD) found";
  let structuredEarned = 0;
  const schemaTypes: string[] = [];
  schemaScripts.each((_, el) => {
    const raw = ($(el).html() ?? "").trim();
    if (!raw) return;
    // Try strict parse — handles arrays, @graph, etc. cleanly
    let detectedType: string | undefined;
    try {
      const parsed = JSON.parse(raw);
      const typeFromParsed = extractSchemaType(parsed);
      if (typeFromParsed) detectedType = typeFromParsed;
    } catch {
      // Fall through to regex extraction
    }
    // Regex fallback — looks for `@type` AND `@context` inside the
    // raw text. If both present, we treat it as valid JSON-LD even
    // if strict-parse failed (the search engines will read it fine).
    if (!detectedType) {
      const hasContext = /"@context"\s*:\s*"[^"]*schema\.org[^"]*"/i.test(raw);
      const typeMatch = raw.match(/"@type"\s*:\s*"([^"]+)"/);
      if (hasContext && typeMatch) {
        detectedType = typeMatch[1];
      }
    }
    if (detectedType) {
      schemaTypes.push(detectedType);
    }
  });
  if (schemaTypes.length > 0) {
    structuredStatus = "pass";
    structuredDetail = `Found JSON-LD structured data (${schemaTypes.join(", ")})`;
    structuredEarned = 6;
  }
  if (structuredStatus === "fail") {
    const microdataItems = $("[itemscope]").length;
    if (microdataItems > 0) { structuredStatus = "warn"; structuredDetail = `Microdata found (${microdataItems} items) — consider JSON-LD`; structuredEarned = 3; }
  }
  checks.push({ id: "structured_data", name: "Structured Data", description: "Page uses JSON-LD structured data markup", status: structuredStatus, detail: structuredDetail, points: 6, earned: structuredEarned });

  // 14. Local Business Schema — critical for Google local pack rankings.
  const LOCAL_TYPES = [
    "LocalBusiness", "Restaurant", "Store", "Hotel", "MedicalOrganization",
    "Dentist", "AutoRepair", "Plumber", "HVACBusiness", "HomeAndConstructionBusiness",
    "RealEstateAgent", "ProfessionalService", "Attorney", "FinancialService",
    "BeautySalon", "HairSalon", "DaySpa", "FoodEstablishment", "BarOrPub",
    "CafeOrCoffeeShop", "Bakery", "FastFoodRestaurant",
  ];
  const hasLocalSchema = schemaTypes.some((t) => LOCAL_TYPES.includes(t));
  let localStatus: "pass" | "warn" | "fail" = "fail";
  let localDetail = "No LocalBusiness or vertical-specific schema (Restaurant, Plumber, etc.) found";
  let localEarned = 0;
  if (hasLocalSchema) {
    localStatus = "pass";
    localDetail = `Found local-business schema: ${schemaTypes.filter((t) => LOCAL_TYPES.includes(t)).join(", ")}`;
    localEarned = 6;
  } else if (schemaTypes.length > 0) {
    localStatus = "warn";
    localDetail = `Has JSON-LD (${schemaTypes.join(", ")}) but no LocalBusiness type — Google's local pack uses LocalBusiness schema for ranking`;
    localEarned = 2;
  }
  checks.push({ id: "local_schema", name: "Local Business Schema", description: "Page uses LocalBusiness JSON-LD for Google local pack rankings", status: localStatus, detail: localDetail, points: 6, earned: localEarned });

  // 15. NAP Consistency — Google trust signal for local SEO. Look for a
  // visible phone number and street address on the homepage. Counts both
  // tel: links and US-style phone formats; street-style address tokens.
  const telLinks = $('a[href^="tel:"]').length;
  const phoneRx = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  const bodyText = $("body").text();
  const phonePresent = telLinks > 0 || phoneRx.test(bodyText);
  // Address heuristic: street-style line with number + street suffix.
  const addressRx =
    /\b\d{1,5}\s+[A-Za-z0-9 .,'-]+?\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Court|Ct\.?|Place|Pl\.?|Highway|Hwy\.?|Parkway|Pkwy\.?)\b/i;
  // Postal-org schema can also count.
  const hasAddressSchema = schemaScripts
    .toArray()
    .some((el) => /"@type":\s*"PostalAddress"|"streetAddress":/i.test($(el).html() ?? ""));
  const addressPresent = addressRx.test(bodyText) || hasAddressSchema;

  let napStatus: "pass" | "warn" | "fail" = "fail";
  let napDetail = "No phone or street address visible on page";
  let napEarned = 0;
  if (phonePresent && addressPresent) {
    napStatus = "pass";
    napDetail = `Phone${telLinks > 0 ? " (with tel: link)" : ""} and address both present`;
    napEarned = 6;
  } else if (phonePresent || addressPresent) {
    napStatus = "warn";
    napDetail = phonePresent
      ? "Phone present but no street address — local search engines need both"
      : "Address present but no phone — add a tel: link in the header/footer";
    napEarned = 3;
  }
  checks.push({ id: "nap_consistency", name: "NAP (Name/Address/Phone)", description: "Local SMBs need machine-readable name, address, and phone on every page", status: napStatus, detail: napDetail, points: 6, earned: napEarned });

  // Calculate score
  const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
  const earnedPoints = checks.reduce((sum, c) => sum + c.earned, 0);
  const score = Math.round((earnedPoints / totalPoints) * 100);

  return { score, checks, url: finalUrl || url, fetchedAt: new Date().toISOString() };
}

/**
 * Extract a schema.org @type from a parsed JSON-LD object.
 * Handles three common shapes:
 *   - Single object: { "@type": "Restaurant", ... }
 *   - Array of objects: [{ "@type": "Org" }, ...]
 *   - @graph wrapper: { "@graph": [{ "@type": "X" }, ...] }
 * Returns the most "specific" type when @type is itself an array
 * (Schema.org allows ["LocalBusiness", "Restaurant"] — pick the
 * narrowest, here Restaurant).
 */
function extractSchemaType(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const obj = parsed as Record<string, unknown>;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const t = extractSchemaType(item);
      if (t) return t;
    }
    return undefined;
  }
  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"] as unknown[]) {
      const t = extractSchemaType(item);
      if (t) return t;
    }
  }
  const rawType = obj["@type"];
  if (typeof rawType === "string") return rawType;
  if (Array.isArray(rawType) && rawType.length > 0) {
    // Pick the last entry — usually the most specific, e.g.
    // ["Thing", "LocalBusiness", "Restaurant"] -> Restaurant
    return String(rawType[rawType.length - 1]);
  }
  return undefined;
}
