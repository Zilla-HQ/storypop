import Anthropic from "@anthropic-ai/sdk";
import { db, adminSettings, xMentions } from "@/db";
import { eq } from "drizzle-orm";
import {
  fetchMentions,
  postTweet,
  type XMentionFetched,
} from "@/lib/x-poster";

/**
 * Auto-reply to brand-account @mentions on X using Claude.
 *
 * Pipeline:
 *   1. Read x_mentions_since_id from admin_settings (watermark)
 *   2. Fetch new mentions since that ID via X API
 *   3. For each: pass to Claude to evaluate + draft a reply
 *   4. If Claude says reply: post via X API + persist x_mentions row
 *   5. If skip: persist with decision=skipped + reasoning
 *   6. Update watermark to highest mention ID seen
 *
 * Safety caps:
 *   - Hard cap at MAX_REPLIES_PER_RUN per run (avoid blowing X + Anthropic budget)
 *   - Skips own tweets (we don't auto-reply to ourselves)
 *
 * Per-merchant configuration (env):
 *   X_BRAND_NAME       — display name in the system prompt (e.g. "Sitebeat")
 *   X_BRAND_HANDLE     — @handle without the @ (e.g. "Sitebeatapp")
 *   X_BRAND_ABOUT      — multi-line description of what the brand does +
 *                        when to reply / not reply / link CTAs / discount
 *                        codes. Pasted directly into the system prompt.
 *   ANTHROPIC_MODEL    — default claude-haiku-4-5-20251001
 *   X_MENTIONS_MAX_REPLIES_PER_RUN — default 5
 *
 * If X_BRAND_ABOUT isn't set, the handler uses a generic SMB-friendly
 * fallback so it still does something useful, but every merchant should
 * customize this.
 */

const MAX_REPLIES_PER_RUN = Number(process.env.X_MENTIONS_MAX_REPLIES_PER_RUN ?? "5");

interface ClaudeDecision {
  shouldReply: boolean;
  replyText?: string;
  reasoning: string;
}

const DEFAULT_BRAND_ABOUT = `You manage a brand X account for a small business.

REPLY when:
- Genuine question about our product or industry
- Friendly engagement / banter
- Sales-curious or pricing questions
- Someone shares a positive experience

DO NOT reply when:
- Spam, bots, or accounts with obvious crypto/onlyfans/scam patterns
- Hostile, troll, or angry takedown
- Off-topic political content
- The mention is just an @ tag with no actual content
- Someone is venting in a way that doesn't expect a reply
- The mention is from our own account`;

function buildSystemPrompt(): string {
  const brandName = process.env.X_BRAND_NAME ?? "this brand";
  const brandHandle = process.env.X_BRAND_HANDLE ?? "the brand handle";
  const about = process.env.X_BRAND_ABOUT ?? DEFAULT_BRAND_ABOUT;
  return `You manage the X (Twitter) account @${brandHandle} for ${brandName}.

${about}

Your job: read a mention of @${brandHandle} and decide whether to reply.

Reply rules:
- ≤270 characters total
- No emojis
- No "Hi [name]" prefix — just dive in
- Tone: friendly, concise, helpful
- Don't sound like a bot — vary phrasing across replies

Output ONLY a JSON object:
{
  "shouldReply": boolean,
  "replyText": "the reply text (only if shouldReply=true; ≤270 chars)",
  "reasoning": "1-line internal note explaining the decision"
}`;
}

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

async function evaluateMention(mention: XMentionFetched): Promise<ClaudeDecision> {
  const userMessage = `Mention from @${mention.authorUsername ?? mention.authorId} (tweet ID ${mention.id}):

"${mention.text}"

Decide whether to reply.`;

  const response = await anthropic().messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Claude returned no JSON: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(jsonMatch[0]) as ClaudeDecision;

  if (typeof parsed.shouldReply !== "boolean") {
    throw new Error("Claude response missing shouldReply boolean");
  }
  if (parsed.shouldReply && (!parsed.replyText || parsed.replyText.length > 270)) {
    throw new Error(
      `Claude said reply but text invalid (len=${parsed.replyText?.length ?? 0})`,
    );
  }
  return parsed;
}

interface RunResult {
  fetched: number;
  replied: number;
  skipped: number;
  errored: number;
  capHit: boolean;
}

export async function runMentionsHandler(): Promise<RunResult> {
  const out: RunResult = {
    fetched: 0,
    replied: 0,
    skipped: 0,
    errored: 0,
    capHit: false,
  };

  const [s] = await db
    .select({
      sinceId: adminSettings.xMentionsSinceId,
      myUsername: adminSettings.xUsername,
    })
    .from(adminSettings)
    .where(eq(adminSettings.id, 1))
    .limit(1);

  const sinceId = s?.sinceId ?? null;

  const mentions = await fetchMentions(sinceId);
  out.fetched = mentions.length;
  if (mentions.length === 0) return out;

  let highestId = sinceId ?? "0";

  for (const m of mentions) {
    if (BigInt(m.id) > BigInt(highestId)) highestId = m.id;

    if (s?.myUsername && m.authorUsername?.toLowerCase() === s.myUsername.toLowerCase()) {
      await persistMention(m, "skipped", "own tweet — not auto-replying to self");
      out.skipped += 1;
      continue;
    }

    if (out.replied >= MAX_REPLIES_PER_RUN) {
      await persistMention(m, "skipped", "reply cap hit for this run");
      out.skipped += 1;
      out.capHit = true;
      continue;
    }

    try {
      const decision = await evaluateMention(m);
      if (decision.shouldReply && decision.replyText) {
        const result = await postTweet(decision.replyText, m.id);
        await persistMention(m, "replied", decision.reasoning, result.id, decision.replyText);
        out.replied += 1;
      } else {
        await persistMention(m, "skipped", decision.reasoning);
        out.skipped += 1;
      }
    } catch (err) {
      await persistMention(m, "errored", (err as Error).message.slice(0, 200));
      out.errored += 1;
    }
  }

  await db
    .update(adminSettings)
    .set({ xMentionsSinceId: highestId, updatedAt: new Date() })
    .where(eq(adminSettings.id, 1));

  return out;
}

async function persistMention(
  m: XMentionFetched,
  decision: "replied" | "skipped" | "errored",
  reasoning: string,
  replyTweetId?: string,
  replyText?: string,
): Promise<void> {
  await db
    .insert(xMentions)
    .values({
      mentionTweetId: m.id,
      authorId: m.authorId,
      authorUsername: m.authorUsername,
      text: m.text,
      createdAtX: m.createdAt ? new Date(m.createdAt) : null,
      decision,
      reasoning,
      replyTweetId: replyTweetId ?? null,
      replyText: replyText ?? null,
    })
    .onConflictDoNothing({ target: xMentions.mentionTweetId });
}
