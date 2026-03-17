import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const SIGNED_URL_TTL_SECONDS = 60 * 15;

let s3Client: S3Client | null = null;

function getAwsRegion(): string {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
}

function getExportsBucket(): string {
  const bucket = process.env.AWS_S3_EXPORTS_BUCKET?.trim();
  if (!bucket) {
    throw new Error("AWS_S3_EXPORTS_BUCKET is required");
  }
  return bucket;
}

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: getAwsRegion() });
  }
  return s3Client;
}

export async function getExportSignedUrl(key: string): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: getExportsBucket(),
      Key: key,
    }),
    { expiresIn: SIGNED_URL_TTL_SECONDS }
  );
}

export async function uploadExport(
  key: string,
  content: Buffer,
  contentType: string
): Promise<string> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getExportsBucket(),
      Key: key,
      Body: content,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
      CacheControl: "private, max-age=0, no-cache",
    })
  );

  return getExportSignedUrl(key);
}
