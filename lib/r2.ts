import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

const accountId = env("R2_ACCOUNT_ID");
const accessKeyId = env("R2_ACCESS_KEY_ID");
const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
const bucket = env("R2_BUCKET", "storypop-books")!;
const publicUrl = env("R2_PUBLIC_URL");

const client =
  accountId && accessKeyId && secretAccessKey
    ? new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      })
    : null;

function requireClient(): S3Client {
  if (!client) {
    throw new Error("R2 is not configured (missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).");
  }
  return client;
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const c = requireClient();
  await c.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** AWS SigV4 caps presigned URLs at 7 days. Any value above throws. */
const MAX_PRESIGN_SECONDS = 7 * 24 * 60 * 60;

export async function signedR2Url(key: string, expiresInSeconds = MAX_PRESIGN_SECONDS): Promise<string> {
  // If R2 bucket is fronted by a public domain, prefer that for reads.
  if (publicUrl) return `${publicUrl.replace(/\/$/, "")}/${key}`;
  if (expiresInSeconds > MAX_PRESIGN_SECONDS) {
    // Clamp + warn. Previously a caller asking for 30 days would silently
    // throw inside getSignedUrl and the catching code would discard the
    // photo (real customer-impact bug — see comments in /api/self-serve).
    console.warn(
      `[r2] signedR2Url asked for ${expiresInSeconds}s but max is ${MAX_PRESIGN_SECONDS}s (7d); clamping.`,
    );
    expiresInSeconds = MAX_PRESIGN_SECONDS;
  }
  const c = requireClient();
  return getSignedUrl(
    c,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export function r2Bucket(): string {
  return bucket;
}

import { DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Delete an R2 object. Used by `inngest/functions/photo-purge.ts` to honor
 * the 30-day photo-retention commitment in the privacy policy.
 *
 * Idempotent — deleting a key that doesn't exist returns successfully.
 */
export async function deleteR2Object(keyOrUrl: string): Promise<void> {
  if (!keyOrUrl) return;
  // Accept either a full public URL or a bare R2 key. Strip the public
  // domain prefix if present.
  let key = keyOrUrl;
  if (publicUrl && key.startsWith(publicUrl)) {
    key = key.slice(publicUrl.length).replace(/^\//, "");
  } else if (key.startsWith("http")) {
    try {
      key = new URL(key).pathname.replace(/^\//, "");
    } catch {
      // not a URL, leave as-is
    }
  }
  const c = requireClient();
  await c.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
