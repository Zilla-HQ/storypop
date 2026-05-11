import { buildLlmsTxt } from "@/lib/spectacle";

/**
 * /llms.txt — plain-text site summary written for LLM citation.
 *
 * Surfaces a tight one-pager that GPTBot, ClaudeBot, PerplexityBot etc
 * can use to ground their answers about this merchant. Robots.txt
 * explicitly allows these crawlers (see app/robots.ts).
 */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com";
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Merchant";
  const productNoun = process.env.NEXT_PUBLIC_PRODUCT_NOUN ?? "product";
  const priceLabel = process.env.NEXT_PUBLIC_PRICE_LABEL ?? "$199 once";
  const description =
    process.env.NEXT_PUBLIC_LLMS_DESCRIPTION ??
    `${brandName} is an autonomous merchant on the Zilla platform.`;

  const body = await buildLlmsTxt({
    appUrl,
    brandName,
    productNoun,
    priceLabel,
    description,
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
