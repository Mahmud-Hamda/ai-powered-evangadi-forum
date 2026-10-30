/**
 * Multer middleware that accepts one PDF on the `file` form field.
 *
 * @module api/rag/middleware/handlePdfUpload
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import multer from 'multer';
import { BadRequestError } from '../../../utils/errors/index.js';

/**
 * Maximum PDF size. Vercel rejects request bodies above 4.5MB, so production
 * stops at 4MB with an application error instead of a platform failure.
 */
const MAX_PDF_UPLOAD_BYTES = process.env.VERCEL
  ? 4 * 1024 * 1024
  : 10 * 1024 * 1024;

/** Absolute path to the backend package root (`.../backend`). */
const BACKEND_PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../',
);

/**
 * Directory where uploaded PDFs are stored: `backend/uploads/rag/<userId>/`.
 *
 * @type {string}
 */
export const RAG_UPLOAD_ROOT = process.env.VERCEL
  ? path.join('/tmp', 'uploads', 'rag')
  : path.join(BACKEND_PROJECT_ROOT, 'uploads', 'rag');

/**
 * Multer instance: disk storage, PDF-only filter, 10MB limit.
 *
 * @type {import('multer').Multer}
 */
const pdfUploadStorage = multer({
  storage: multer.diskStorage({
    /**
     * Writes the file under that user's RAG folder, creating it if needed.
     *
     * @param {import('express').Request} req - Must already have `req.user.id`.
     * @param {import('multer').File} _file - Unused; destination is per user.
     * @param {import('multer').FileFilterCallback} callback - Receives the folder path.
     * @returns {void}
     */
    destination: (req, _file, callback) => {
      const userUploadDirectory = path.join(
        RAG_UPLOAD_ROOT,
        String(req.user.id),
      );
      fs.mkdirSync(userUploadDirectory, { recursive: true });
      callback(null, userUploadDirectory);
    },
    /**
     * Names the file with a UUID so two uploads never collide.
     *
     * @param {import('express').Request} _req - Unused.
     * @param {import('multer').File} _file - Unused; extension is always `.pdf`.
     * @param {import('multer').FileFilterCallback} callback - Receives the file name.
     * @returns {void}
     */
    filename: (_req, _file, callback) => {
      callback(null, `${crypto.randomUUID()}.pdf`);
    },
  }),
  limits: { fileSize: MAX_PDF_UPLOAD_BYTES },
  /**
   * Accepts `application/pdf` or a `.pdf` file name.
   *
   * @param {import('express').Request} _req - Unused.
   * @param {import('multer').File} file - The incoming upload.
   * @param {import('multer').FileFilterCallback} callback - Accepts or rejects the file.
   * @returns {void}
   */
  fileFilter: (_req, file, callback) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      const uploadError = new Error('Only PDF files are allowed');
      uploadError.statusCode = 400;
      return callback(uploadError);
    }

    callback(null, true);
  },
});

/** Parses one multipart field named `file`. */
const parseSinglePdfFormField = pdfUploadStorage.single('file');

/**
 * Reads one PDF from the `file` field and sets `req.file`.
 *
 * @param {import('express').Request} req - Incoming request; `req.file` is set on success.
 * @param {import('express').Response} res - Passed through to multer.
 * @param {import('express').NextFunction} next - Continues to the controller, or receives the upload error.
 * @returns {void}
 */
export const handlePdfUpload = (req, res, next) => {
  parseSinglePdfFormField(req, res, uploadError => {
    if (!uploadError) {
      return next();
    }

    if (uploadError.code === 'LIMIT_FILE_SIZE') {
      const maxMb = process.env.VERCEL ? 4 : 10;
      return next(new BadRequestError(`PDF must be ${maxMb}MB or smaller.`));
    }

    return next(uploadError);      // uploadError is express's error handler
  });
};
