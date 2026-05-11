import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

const accountId = env("R2_ACCOUNT_ID");
const accessKeyId = env("R2_ACCESS_KEY_ID");
const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
const bucket = env("R2_BUCKET", "relist-photos")!;
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

export async function signedR2Url(key: string, expiresInSeconds = 60 * 60 * 24 * 7): Promise<string> {
  // If R2 bucket is fronted by a public domain, prefer that for reads.
  if (publicUrl) return `${publicUrl.replace(/\/$/, "")}/${key}`;
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
