import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';
import { safeUnlink, sniffType } from '../utils/files.js';

export const UPLOAD_ROOT = path.resolve(env.uploadDir);
const TMP = path.join(UPLOAD_ROOT, 'tmp');
for (const d of ['tmp', 'public', 'private']) fs.mkdirSync(path.join(UPLOAD_ROOT, d), { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TMP),
  filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
});

const IMAGE_MIME = /^image\/(jpeg|png|webp|gif)$/;
const DOC_MIME = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
const SHEET_MIME = /(csv|excel|spreadsheet|sheet|text\/plain|octet-stream)/;

export const imageUpload = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => (IMAGE_MIME.test(file.mimetype) || DOC_MIME.test(file.mimetype)
    ? cb(null, true)
    : cb(badRequest('Only JPG, PNG, WEBP or GIF images (and PDF for proof documents) are allowed', 'INVALID_FILE'))),
});

export const sheetUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(csv|xlsx)$/i.test(file.originalname) && SHEET_MIME.test(file.mimetype);
    return ok ? cb(null, true) : cb(badRequest('Upload a .csv or .xlsx file', 'INVALID_FILE'));
  },
});

/**
 * Verify uploaded temp files by their real content and move them into place.
 * @param files multer files
 * @param visibility 'public' (served statically) | 'private' (served only through authorised routes)
 * @param allow array of allowed extensions
 */
export async function finalizeFiles(files = [], visibility, allow) {
  const moved = [];
  try {
    for (const f of files) {
      const type = await sniffType(f.path);
      if (!type || !allow.includes(type.ext)) {
        throw badRequest(`"${f.originalname}" is not a supported file type`, 'INVALID_FILE');
      }
      const name = `${crypto.randomUUID()}.${type.ext}`;
      const dest = path.join(UPLOAD_ROOT, visibility, name);
      await fsp.rename(f.path, dest);
      moved.push({ name, dest, mime: type.mime, original: f.originalname.slice(0, 120), size: f.size });
    }
    return moved.map(({ name, mime, original, size }) => ({
      name, mime, original, size,
      url: visibility === 'public' ? `/uploads/public/${name}` : null,
    }));
  } catch (err) {
    await Promise.all([...files.map((f) => safeUnlink(f.path)), ...moved.map((m) => safeUnlink(m.dest))]);
    throw err;
  }
}

export async function cleanupTemp(req) {
  const all = [];
  if (req.file) all.push(req.file);
  if (Array.isArray(req.files)) all.push(...req.files);
  else if (req.files) Object.values(req.files).forEach((arr) => all.push(...arr));
  await Promise.all(all.map((f) => (f.path?.startsWith(TMP) ? safeUnlink(f.path) : null)));
}

export const IMAGE_EXT = ['jpg', 'png', 'webp', 'gif'];
export const PROOF_EXT = ['jpg', 'png', 'webp', 'pdf'];

export function publicFilePath(url) {
  if (!url?.startsWith('/uploads/public/')) return null;
  return path.join(UPLOAD_ROOT, 'public', path.basename(url));
}
export const privateFilePath = (name) => path.join(UPLOAD_ROOT, 'private', path.basename(name));
