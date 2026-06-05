import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export interface UploadResult {
  url: string;
}

// Cloudflare R2 client (lazy init)
let r2Client: S3Client | null = null;
function getR2Client(): S3Client | null {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }
  return r2Client;
}

export async function saveUpload(
  file: File,
  directory: string,
): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("不支持的文件类型，请上传 jpg/png/gif/webp 格式");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("文件大小不能超过 5MB");
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${Date.now()}-${randomUUID()}.${ext}`;
  const key = `${directory}/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const r2 = getR2Client();
  if (r2) {
    // Upload to Cloudflare R2
    const bucket = process.env.R2_BUCKET_NAME!;
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (publicUrl) {
      return { url: `${publicUrl}/${key}` };
    }
    return { url: `${process.env.R2_ENDPOINT}/${bucket}/${key}` };
  }

  // Local filesystem fallback (dev only)
  const uploadDir = join(process.cwd(), "public", directory);
  const filepath = join(uploadDir, filename);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(filepath, buffer);

  return { url: `/${directory}/${filename}` };
}
