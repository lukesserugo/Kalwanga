// src/lib/imageStorage.ts
//
// Converts a mixed array of image sources into URL strings.
//
// Input items may be:
//   • http(s) URLs                     → passed through untouched
//   • /uploads/... relative URLs       → passed through untouched
//   • data:image/<mime>;base64,<data>  → decoded, written to disk,
//                                        replaced with its public URL
//
// This is the single choke point that keeps base64 out of the database.
// Postgres index rows are limited to 8191 bytes; a 15 KB base64 string
// will always fail the `product_images.url` unique index.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
);
const PUBLIC_PREFIX = '/uploads';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

function isDataUrl(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
function isRelativeUrl(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

function parseDataUrl(
  dataUrl: string,
): { mime: string; buffer: Buffer } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const base64 = match[2];

  if (base64.length * 0.75 > MAX_BYTES) return null;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return null;
  }

  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null;
  return { mime, buffer };
}

async function persistBuffer(
  buffer: Buffer,
  mime: string,
  subdir: string,
): Promise<string> {
  const ext = MIME_EXT[mime] ?? 'bin';
  const dir = path.join(UPLOAD_ROOT, subdir);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${crypto
    .randomBytes(6)
    .toString('hex')}.${ext}`;
  const absolute = path.join(dir, filename);

  await fs.writeFile(absolute, buffer);

  return `${PUBLIC_PREFIX}/${subdir}/${filename}`;
}

export interface PersistImageOptions {
  subdir?: string;
  maxImages?: number;
}

export async function persistImages(
  images: unknown,
  options: PersistImageOptions = {},
): Promise<string[]> {
  const { subdir = 'products', maxImages = 10 } = options;

  if (!Array.isArray(images) || images.length === 0) return [];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of images) {
    if (result.length >= maxImages) break;
    if (typeof item !== 'string' || item.length === 0) continue;

    // Pass-through: already a URL.
    if (isHttpUrl(item) || isRelativeUrl(item)) {
      if (!seen.has(item)) {
        seen.add(item);
        result.push(item);
      }
      continue;
    }

    // Base64 payload — persist to disk.
    if (isDataUrl(item)) {
      const parsed = parseDataUrl(item);
      if (!parsed) {
        console.warn(
          `⚠️ Skipping malformed or oversized data URL (${item.length} chars)`,
        );
        continue;
      }
      try {
        const url = await persistBuffer(parsed.buffer, parsed.mime, subdir);
        if (!seen.has(url)) {
          seen.add(url);
          result.push(url);
        }
      } catch (err) {
        console.error('❌ Failed to persist image:', err);
      }
      continue;
    }

    // Bare base64 (no data: prefix) — wrap and retry.
    if (/^[A-Za-z0-9+/=\s]+$/.test(item) && item.length > 256) {
      const parsed = parseDataUrl(`data:image/jpeg;base64,${item}`);
      if (parsed) {
        try {
          const url = await persistBuffer(parsed.buffer, parsed.mime, subdir);
          if (!seen.has(url)) {
            seen.add(url);
            result.push(url);
          }
        } catch (err) {
          console.error('❌ Failed to persist bare-base64 image:', err);
        }
      }
    }
  }

  return result;
}

export function persistVariantImages(images: unknown): Promise<string[]> {
  return persistImages(images, { subdir: 'variants', maxImages: 10 });
}
