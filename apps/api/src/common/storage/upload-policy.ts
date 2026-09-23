import { StatusCodes } from 'http-status-codes';
import { AppError } from '../middleware/error-handler.middleware.js';

export const UPLOAD_CATEGORIES = [
  'homework',
  'test',
  'receipt',
  'report',
  'avatar',
  'logo',
  'general',
] as const;
export type UploadCategory = (typeof UPLOAD_CATEGORIES)[number];

const MB = 1024 * 1024;
const IMAGES = ['image/jpeg', 'image/png', 'image/webp'];
const PDF = ['application/pdf'];
const OFFICE = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// SVG and HTML are deliberately absent: both can carry script and would be served back to users.
const POLICY: Record<UploadCategory, { mimeTypes: string[]; maxBytes: number }> = {
  avatar: { mimeTypes: IMAGES, maxBytes: 2 * MB },
  logo: { mimeTypes: IMAGES, maxBytes: 2 * MB },
  receipt: { mimeTypes: [...IMAGES, ...PDF], maxBytes: 5 * MB },
  homework: { mimeTypes: [...IMAGES, ...PDF, ...OFFICE], maxBytes: 10 * MB },
  test: { mimeTypes: [...IMAGES, ...PDF, ...OFFICE], maxBytes: 10 * MB },
  report: { mimeTypes: [...PDF, ...OFFICE], maxBytes: 10 * MB },
  general: { mimeTypes: [...IMAGES, ...PDF, ...OFFICE], maxBytes: 10 * MB },
};

/** Leading bytes each accepted type must start with, so a renamed script cannot pass as an image. */
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) =>
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) =>
    b.subarray(0, 4).toString('latin1') === 'RIFF' &&
    b.subarray(8, 12).toString('latin1') === 'WEBP',
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  // .docx / .xlsx are ZIP containers
  [OFFICE[0]]: (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  [OFFICE[1]]: (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
};

/** Checks the declared type (and size, when known) against the category's policy. */
export function assertUploadAllowed(
  category: UploadCategory,
  mimeType: string,
  sizeBytes?: number,
): void {
  const policy = POLICY[category];
  const mime = mimeType.toLowerCase().trim();
  if (!policy.mimeTypes.includes(mime)) {
    throw new AppError(
      'UNSUPPORTED_FILE_TYPE',
      `Files of type "${mimeType}" cannot be uploaded as ${category}`,
      StatusCodes.UNSUPPORTED_MEDIA_TYPE,
      { allowed: policy.mimeTypes },
    );
  }
  if (sizeBytes !== undefined && sizeBytes > policy.maxBytes) {
    throw new AppError(
      'FILE_TOO_LARGE',
      `${category} uploads are limited to ${policy.maxBytes / MB} MB`,
      StatusCodes.REQUEST_TOO_LONG,
      { maxBytes: policy.maxBytes },
    );
  }
}

/** Verifies the file content really is the declared type. */
export function assertContentMatchesType(buffer: Buffer, mimeType: string): void {
  if (buffer.length === 0) {
    throw new AppError('EMPTY_FILE', 'The uploaded file is empty', StatusCodes.BAD_REQUEST);
  }
  const matches = SIGNATURES[mimeType.toLowerCase().trim()];
  if (!matches || !matches(buffer)) {
    throw new AppError(
      'FILE_CONTENT_MISMATCH',
      `The file content is not a valid ${mimeType}`,
      StatusCodes.UNSUPPORTED_MEDIA_TYPE,
    );
  }
}

/** Reduces a client-supplied name to a safe storage name: no directories, no special characters. */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._]+/, '')
    .replace(/_+/g, '_')
    .slice(0, 100);
  return cleaned || 'file';
}
