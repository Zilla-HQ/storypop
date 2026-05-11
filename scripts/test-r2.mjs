import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const Bucket = "relist-photos";
const Key = "_healthcheck/hello.txt";

try {
  await s3.send(new PutObjectCommand({ Bucket, Key, Body: "relist ok", ContentType: "text/plain" }));
  console.log("PUT ✓");
  const got = await s3.send(new GetObjectCommand({ Bucket, Key }));
  const body = await got.Body.transformToString();
  console.log("GET ✓", body);
  await s3.send(new DeleteObjectCommand({ Bucket, Key }));
  console.log("DELETE ✓");
  console.log("R2 FULLY WORKING");
} catch (e) {
  console.error("R2 FAIL:", e.name, e.message);
  process.exit(1);
}
