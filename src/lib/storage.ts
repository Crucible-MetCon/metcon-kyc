/**
 * Cloudflare R2 storage — drop-in wrapper around @aws-sdk/client-s3.
 * R2 is S3-compatible so the SDK works unchanged; only the endpoint differs.
 *
 * Required environment variables:
 *   R2_ACCOUNT_ID        — Cloudflare account ID
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret key
 *   R2_BUCKET_NAME       — bucket name (e.g. kyc-documents)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

function getClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 environment variables are not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const bucket = () => {
  const name = process.env.R2_BUCKET_NAME;
  if (!name) throw new Error('R2_BUCKET_NAME environment variable is not set');
  return name;
};

// ─── Upload ────────────────────────────────────────────────────────────────────

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getClient().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

// ─── Download ──────────────────────────────────────────────────────────────────

export async function downloadFile(key: string): Promise<{ body: Buffer; contentType: string }> {
  const res = await getClient().send(new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
  }));

  if (!res.Body) throw new Error('Empty response body from R2');

  // Convert the SDK's streaming body to a Buffer
  const stream = res.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }

  return {
    body: Buffer.concat(chunks),
    contentType: res.ContentType ?? 'application/octet-stream',
  };
}

// ─── Delete single file ────────────────────────────────────────────────────────

export async function deleteFile(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({
    Bucket: bucket(),
    Key: key,
  }));
}

// ─── Delete all files for a case ──────────────────────────────────────────────
// Used when an entire case is deleted from the admin panel.

export async function deleteAllCaseFiles(caseId: string): Promise<void> {
  const client = getClient();
  const b = bucket();

  // List all objects under the case prefix
  const listed = await client.send(new ListObjectsV2Command({
    Bucket: b,
    Prefix: `${caseId}/`,
  }));

  const objects = listed.Contents ?? [];
  if (objects.length === 0) return;

  await client.send(new DeleteObjectsCommand({
    Bucket: b,
    Delete: {
      Objects: objects.map((o) => ({ Key: o.Key! })),
      Quiet: true,
    },
  }));
}
