import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { configuration, rootDirectory } from '../config';
import { BusinessError } from '../domain/business-error';

export const maxFiles = 5;
export const maxFileBytes = 5 * 1024 * 1024;
export const maxMultipartBytes = 26 * 1024 * 1024;
const maxPixels = 16_000_000;
const maxDimension = 6000;
const formats = {
  jpeg: { extension: 'jpg', mime: 'image/jpeg', suffix: /\.jpe?g$/i },
  png: { extension: 'png', mime: 'image/png', suffix: /\.png$/i },
  webp: { extension: 'webp', mime: 'image/webp', suffix: /\.webp$/i },
} as const;

const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
const pngEnd = Buffer.from('0000000049454e44ae426082', 'hex');

function detect(data: Buffer) {
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data.at(-2) === 0xff && data.at(-1) === 0xd9)
    return 'jpeg';
  if (data.length >= 20 && data.subarray(0, 8).equals(pngSignature) && data.subarray(-12).equals(pngEnd))
    return 'png';
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' &&
      data.toString('ascii', 8, 12) === 'WEBP' && data.readUInt32LE(4) === data.length - 8)
    return 'webp';
  return undefined;
}

export async function normalizeEvidence(data: Buffer, declared?: { originalname: string; mimetype: string }) {
  const format = detect(data);
  const invalid = () => new BusinessError(415, 'La evidencia debe ser una imagen JPEG, PNG o WebP válida.');
  if (!format) throw invalid();
  const { mime, extension, suffix } = formats[format];
  if (declared && (declared.mimetype !== mime || !suffix.test(declared.originalname))) throw invalid();
  try {
    const image = sharp(data, { failOn: 'warning', limitInputPixels: maxPixels });
    const { width, height, pages, format: decoded } = await image.metadata();
    if (!width || !height || width > maxDimension || height > maxDimension || (pages ?? 1) > 1 || decoded !== format)
      throw invalid();
    const buffer = await image.autoOrient().toFormat(format).toBuffer();
    return { buffer, extension, mime };
  } catch {
    throw invalid();
  }
}

export const validatedEvidence = path.join(configuration.evidenceRoot, 'validated');
export const evidenceRoute = '/uploads/tickets/';

export function safeEvidenceName(name: string) {
  return name.length > 0 && Buffer.byteLength(name) <= 255 && name !== '.' && name !== '..' &&
    !/[/\\\u0000-\u001f\u007f]/u.test(name);
}

export async function openEvidence(name: string) {
  if (!safeEvidenceName(name)) return;
  const candidates = [validatedEvidence, path.join(configuration.evidenceRoot, 'tickets')];
  if (!configuration.usesMountedEvidence)
    candidates.push(path.join(rootDirectory, 'public/uploads/tickets'));

  for (const directory of candidates) {
    try {
      const handle = await fs.open(path.join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const stat = await handle.stat();
        if (stat.isFile()) return { handle, size: stat.size, validated: directory === validatedEvidence };
      } catch (error) {
        await handle.close();
        throw error;
      }
      await handle.close();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR' && code !== 'ELOOP') throw error;
    }
  }
  return undefined;
}

export function validatedEvidenceType(name: string) {
  for (const format of Object.values(formats)) if (format.suffix.test(name)) return format.mime;
  return 'application/octet-stream';
}
