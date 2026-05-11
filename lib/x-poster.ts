import { db, adminSettings } from "@/db";
import { eq } from "drizzle-orm";
import { refreshAccessToken } from "@/lib/x-oauth";

/**
 * Post tweets from this merchant's brand X account via X v2 API.
 * Loads the long-lived refresh token from admin_settings.x_refresh_token,
 * mints a fresh access token, and POSTs to /2/tweets. If X rotates the
 * refresh token, the new one is persisted for next time.
 *
 * Two entry points:
 *   - postTweet(text)            — single tweet
 *   - postThread([t1, t2, t3])   — chained replies, returns all ids
 *
 * Pre-condition: an operator has visited /api/auth/x/start once and
 * authorized the brand account. Without that, every call throws.
 */

interface TweetRow {
  data: { id: string; text: string };
}

async function loadRefreshToken(): Promise<string> {
  const [row] = await db
    .select({ token: adminSettings.xRefreshToken })
    .from(adminSettings)
    .where(eq(adminSettings.id, 1))
    .limit(1);
  if (!row?.token) {
    throw new Error(
      "X refresh token not configured — visit /api/auth/x/start once to authorize the brand account",
    );
  }
  return row.token;
}

async function persistRefreshToken(token: string): Promise<void> {
  await db
    .update(adminSettings)
    .set({ xRefreshToken: token, updatedAt: new Date() })
    .where(eq(adminSettings.id, 1));
}

async function getAccessToken(): Promise<string> {
  const refresh = await loadRefreshToken();
  const result = await refreshAccessToken(refresh);
  if (result.refreshToken !== refresh) {
    await persistRefreshToken(result.refreshToken);
  }
  return result.accessToken;
}

export async function postTweet(text: string, inReplyToTweetId?: string): Promise<{
  id: string;
  text: string;
}> {
  const accessToken = await getAccessToken();
  const body: Record<string, unknown> = { text };
  if (inReplyToTweetId) {
    body.reply = { in_reply_to_tweet_id: inReplyToTweetId };
  }
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const respText = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`tweet failed: HTTP ${res.status} ${respText.slice(0, 400)}`);
  }
  const json = JSON.parse(respText) as TweetRow;
  return json.data;
}

/**
 * Look up the authenticated brand account. Result is cached in
 * admin_settings.x_user_id + x_username so we only hit the API once.
 */
export async function getMyUserId(): Promise<{ id: string; username: string }> {
  const [row] = await db
    .select({ userId: adminSettings.xUserId, username: adminSettings.xUsername })
    .from(adminSettings)
    .where(eq(adminSettings.id, 1))
    .limit(1);
  if (row?.userId && row.username) {
    return { id: row.userId, username: row.username };
  }

  const accessToken = await getAccessToken();
  const res = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`/2/users/me failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text) as { data: { id: string; name: string; username: string } };

  await db
    .update(adminSettings)
    .set({
      xUserId: json.data.id,
      xUsername: json.data.username,
      updatedAt: new Date(),
    })
    .where(eq(adminSettings.id, 1));

  return { id: json.data.id, username: json.data.username };
}

export interface XMentionFetched {
  id: string;
  text: string;
  authorId: string;
  authorUsername?: string;
  createdAt?: string;
}

/**
 * Fetch recent mentions of the brand account newer than `sinceId`. If
 * sinceId is null, returns the most recent ~20 mentions.
 */
export async function fetchMentions(sinceId: string | null): Promise<XMentionFetched[]> {
  const me = await getMyUserId();
  const accessToken = await getAccessToken();

  const params = new URLSearchParams({
    max_results: "20",
    "tweet.fields": "created_at,author_id",
    expansions: "author_id",
    "user.fields": "username,name",
  });
  if (sinceId) params.set("since_id", sinceId);

  const res = await fetch(
    `https://api.twitter.com/2/users/${me.id}/mentions?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`mentions fetch failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text) as {
    data?: { id: string; text: string; author_id: string; created_at?: string }[];
    includes?: { users?: { id: string; username: string }[] };
  };
  const mentions = json.data ?? [];
  const userMap = new Map((json.includes?.users ?? []).map((u) => [u.id, u.username]));

  return mentions.map((m) => ({
    id: m.id,
    text: m.text,
    authorId: m.author_id,
    authorUsername: userMap.get(m.author_id),
    createdAt: m.created_at,
  }));
}

/**
 * Post a thread — each tweet replies to the previous. Returns the
 * created tweet IDs in order.
 */
export async function postThread(tweets: string[]): Promise<{ id: string; text: string }[]> {
  const out: { id: string; text: string }[] = [];
  let prevId: string | undefined;
  for (const text of tweets) {
    const created = await postTweet(text, prevId);
    out.push(created);
    prevId = created.id;
    // Polite pacing — X tolerates rapid replies but doesn't reward them
    await new Promise((r) => setTimeout(r, 750));
  }
  return out;
}
