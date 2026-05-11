import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { postTweet, postThread } from "@/lib/x-poster";

export const runtime = "nodejs";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "jack@seifdn.org").trim().toLowerCase();
const ADMIN_DOMAINS = (
  process.env.ADMIN_EMAIL_DOMAINS ?? "seifdn.org,seinetwork.io,sierrawood.io"
)
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

async function requireAdmin(): Promise<{ ok: true } | { ok: false; status: number; msg: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, status: 401, msg: "unauthorized" };
  const cc = await clerkClient();
  const user = await cc.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) return { ok: false, status: 401, msg: "unauthorized" };
  const domain = email.split("@")[1];
  if (email === ADMIN_EMAIL || (domain && ADMIN_DOMAINS.includes(domain))) return { ok: true };
  return { ok: false, status: 403, msg: "forbidden" };
}

/**
 * POST /api/admin/post-tweet
 *
 * Body: { text: string }                          — single tweet
 *   or  { thread: string[] }                       — chained replies
 *
 * Returns: { ok, tweets: [{ id, text }] }
 */
export async function POST(req: Request) {
  const a = await requireAdmin();
  if (!a.ok) return NextResponse.json({ error: a.msg }, { status: a.status });

  let body: { text?: unknown; thread?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  try {
    if (Array.isArray(body.thread) && body.thread.length > 0) {
      const tweets = body.thread.filter(
        (t): t is string => typeof t === "string" && t.trim().length > 0,
      );
      if (tweets.length === 0) {
        return NextResponse.json({ error: "thread is empty" }, { status: 400 });
      }
      const tooLong = tweets.find((t) => t.length > 280);
      if (tooLong) {
        return NextResponse.json(
          {
            error: `tweet exceeds 280 chars (got ${tooLong.length}): "${tooLong.slice(0, 60)}..."`,
          },
          { status: 400 },
        );
      }
      const result = await postThread(tweets);
      return NextResponse.json({ ok: true, tweets: result });
    }

    if (typeof body.text === "string" && body.text.trim().length > 0) {
      if (body.text.length > 280) {
        return NextResponse.json(
          { error: `tweet exceeds 280 chars (got ${body.text.length})` },
          { status: 400 },
        );
      }
      const result = await postTweet(body.text);
      return NextResponse.json({ ok: true, tweets: [result] });
    }

    return NextResponse.json({ error: "send `text` or `thread` in body" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message.slice(0, 400) }, { status: 500 });
  }
}
