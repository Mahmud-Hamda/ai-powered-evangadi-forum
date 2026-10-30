/**
 * RAG document routes. Mounted at `/api/rag`.
 *
 * Every path below requires a valid JWT (`authenticateUser`).
 *
 * @module api/rag/routes
 */
import express from 'express';
import { authenticateUser } from '../../../middleware/authentication.js';
import {
  createDocumentController,
  deleteDocumentController,
  getDocumentFileController,
  getDocumentMetaController,
  listDocumentsController,
  queryDocumentController,
  searchInDocumentController,
} from '../controller/rag.controller.js';
import { handlePdfUpload } from '../middleware/handlePdfUpload.js';
import {
  documentIdParamValidation,
  queryDocumentValidation,
  searchInDocumentValidation,
} from '../validations/rag.validation.js';

/** Express router for `/api/rag/*` document endpoints. */
const ragDocumentRouter = express.Router();

/**
 * Requires a valid JWT on every RAG document route.
 */
ragDocumentRouter.use(authenticateUser);

/**
 * Lists PDFs owned by the signed-in user, newest first.
 *
 * @route GET /api/rag/documents
 * @access Private
 */
ragDocumentRouter.get('/documents', listDocumentsController);

/**
 * Uploads one PDF, extracts text, chunks it, embeds it, and stores it.
 *
 * @route POST /api/rag/documents
 * @access Private
 * @param {File} req.file - PDF in multipart field `file` (max 10MB).
 */
ragDocumentRouter.post('/documents', handlePdfUpload, createDocumentController);

/**
 * Streams the raw PDF so the Knowledge Base reader can preview it.
 *
 * @route GET /api/rag/documents/:documentId/file
 * @access Private
 * @param {number} req.params.documentId - Owned document id.
 */
ragDocumentRouter.get(
  '/documents/:documentId/file',
  documentIdParamValidation,
  getDocumentFileController,
);

/**
 * Ranks text excerpts inside one ready PDF by cosine similarity.
 *
 * @route GET /api/rag/documents/:documentId/search
 * @access Private
 * @param {number} req.params.documentId - Owned document id.
 * @param {string} req.query.query - Search text (min 3 characters).
 * @param {number} [req.query.k] - Max excerpts to return (1–20, default 5).
 */
ragDocumentRouter.get(
  '/documents/:documentId/search',
  searchInDocumentValidation,
  searchInDocumentController,
);

/**
 * Answers a question using only the top matching passages from one PDF.
 *
 * @route POST /api/rag/documents/:documentId/query
 * @access Private
 * @param {number} req.params.documentId - Owned document id.
 * @param {string} req.body.query - User question (min 3 characters).
 */
ragDocumentRouter.post(
  '/documents/:documentId/query',
  queryDocumentValidation,
  queryDocumentController,
);

/**
 * Returns metadata for one owned PDF (title, status, size, timestamps).
 *
 * @route GET /api/rag/documents/:documentId
 * @access Private
 * @param {number} req.params.documentId - Owned document id.
 */
ragDocumentRouter.get(
  '/documents/:documentId',
  documentIdParamValidation,
  getDocumentMetaController,
);

/**
 * Deletes an owned PDF from disk and cascades its chunks and embeddings.
 *
 * @route DELETE /api/rag/documents/:documentId
 * @access Private
 * @param {number} req.params.documentId - Owned document id.
 */
ragDocumentRouter.delete(
  '/documents/:documentId',
  documentIdParamValidation,
  deleteDocumentController,
);

export default ragDocumentRouter;
