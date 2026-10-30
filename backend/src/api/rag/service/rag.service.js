/**
 * RAG document business logic: upload, list, preview path, delete, search, and Ask AI.
 *
 * @module api/rag/service
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { safeExecute } from '../../../../db/config.js';
import { chunkTextWithOverlap } from '../../../utils/chunk.js';
import {
  rankByCosine,
  parseEmbedding,
} from '../../../utils/cosine/cosine.js';
import { BadRequestError, NotFoundError } from '../../../utils/errors/index.js';
import {
  generateAnswer,
  generateEmbedding,
} from '../../../utils/gemini/gemini.js';
import { RAG_UPLOAD_ROOT } from '../middleware/handlePdfUpload.js';

/** Default number of excerpts returned by semantic search. */
const DEFAULT_SEARCH_RESULT_LIMIT = 5;

/** How many top chunks to send to Gemini when answering a question. */
const DEFAULT_ASK_CONTEXT_CHUNK_COUNT = 3;

/** Minimum cosine score to keep a search hit (0 keeps the top `resultLimit`). */
const DEFAULT_SEARCH_SCORE_THRESHOLD = 0.75;

/**
 * @typedef {Object} RagDocumentPayload
 * @property {number} documentId - Numeric document id.
 * @property {number} document_id - Same id (snake_case for the task payload).
 * @property {number} userId - Owner user id.
 * @property {number} user_id - Same owner id (snake_case).
 * @property {string} title - Original file name.
 * @property {string} mimeType - MIME type, usually `application/pdf`.
 * @property {string} mime_type - Same MIME type (snake_case).
 * @property {string} storagePath - Relative path under the RAG upload root.
 * @property {string} storage_path - Same path (snake_case).
 * @property {number} byteSize - File size in bytes.
 * @property {number} byte_size - Same size (snake_case).
 * @property {string} status - `processing`, `ready`, or `failed`.
 * @property {string|null} errorMessage - Indexing error when status is `failed`.
 * @property {string|null} error_message - Same error (snake_case).
 * @property {string} createdAt - Created timestamp.
 * @property {string} created_at - Same timestamp (snake_case).
 * @property {string} updatedAt - Updated timestamp.
 * @property {string} updated_at - Same timestamp (snake_case).
 */

/**
 * @typedef {Object} RagSearchHit
 * @property {number} chunkId - `document_chunks.chunk_id`.
 * @property {number} chunkIndex - Order of the chunk in the PDF.
 * @property {number} score - Cosine similarity to the query.
 * @property {string} excerpt - Chunk text.
 */

/**
 * Copies a `documents` row into the object sent in JSON responses (camelCase and snake_case).
 *
 * @param {Object} documentRow - MySQL `documents` row.
 * @returns {RagDocumentPayload} Document metadata for JSON responses.
 */
const mapDocumentRowToObjectForm = documentRow => ({
  documentId: documentRow.document_id,
  document_id: documentRow.document_id,
  userId: documentRow.user_id,
  user_id: documentRow.user_id,
  title: documentRow.title,
  mimeType: documentRow.mime_type,
  mime_type: documentRow.mime_type,
  storagePath: documentRow.storage_path,
  storage_path: documentRow.storage_path,
  byteSize: Number(documentRow.byte_size),
  byte_size: Number(documentRow.byte_size),
  status: documentRow.status,
  errorMessage: documentRow.error_message,
  error_message: documentRow.error_message,
  createdAt: documentRow.created_at,
  created_at: documentRow.created_at,
  updatedAt: documentRow.updated_at,
  updated_at: documentRow.updated_at,
});

/**
 * Resolves a stored relative path under the RAG upload root.
 *
 * @param {string} storagePath - Path like `12/uuid.pdf`.
 * @returns {string} Absolute file path on disk.
 */
export const resolveDocumentPath = storagePath =>
  path.join(RAG_UPLOAD_ROOT, storagePath);

/**
 * Reads an owned PDF from disk, or from `documents.pdf_bytes` when the file
 * is gone. Vercel keeps the disk only for the upload request, so later reads
 * use the database copy.
 *
 * @param {{ document_id: number, user_id: number, storage_path: string }} documentRow - Owned document row.
 * @returns {Promise<Buffer>} PDF bytes.
 * @throws {NotFoundError} When neither the file nor the stored bytes exist.
 */
export const readOwnedPdfBuffer = async documentRow => {
  try {
    return await fs.readFile(resolveDocumentPath(documentRow.storage_path));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const rows = await safeExecute(
    `SELECT pdf_bytes
     FROM documents
     WHERE document_id = ? AND user_id = ?
     LIMIT 1`,
    [documentRow.document_id, documentRow.user_id],
  );
  const pdfBytes = rows[0]?.pdf_bytes;

  if (!pdfBytes || pdfBytes.length === 0) {
    throw new NotFoundError('Document file not found.');
  }

  return pdfBytes;
};

/**
 * Loads one document that belongs to the signed-in user.
 *
 * @param {number} documentId - Document id from the URL.
 * @param {number} userId - Authenticated user id from the JWT.
 * @returns {Promise<Object>} The `documents` row.
 * @throws {NotFoundError} When the row is missing or owned by someone else.
 */
export const assertOwnedDocument = async (documentId, userId) => {
  const documentRows = await safeExecute(
    `SELECT document_id, user_id, title, mime_type, storage_path, byte_size,
            status, error_message, created_at, updated_at
     FROM documents
     WHERE document_id = ? AND user_id = ?
     LIMIT 1`,
    [documentId, userId],
  );

  if (!documentRows[0]) {
    throw new NotFoundError('Document not found.');
  }

  return documentRows[0];
};

/**
 * Loads the PDF parser only when a file is indexed. Importing it at startup
 * crashes the Vercel function because pdf.js expects a browser DOMMatrix.
 *
 * @returns {Promise<{ PDFParse: new (options: { data: Uint8Array }) => { getText: () => Promise<{ text?: string }>, destroy: () => Promise<void> } }>}
 */
const loadPdfParse = async () => {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    const { default: CSSMatrix } = await import('dommatrix');
    globalThis.DOMMatrix = CSSMatrix;
  }
  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class ImageData {
      /**
       * @param {Uint8ClampedArray} data
       * @param {number} width
       * @param {number} height
       */
      constructor(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    };
  }
  if (typeof globalThis.Path2D === 'undefined') {
    globalThis.Path2D = class Path2D {};
  }
  return import('pdf-parse');
};

/**
 * Reads a PDF from disk and returns its extracted plain text.
 *
 * @param {string} absolutePdfPath - Absolute path to the uploaded PDF.
 * @returns {Promise<string>} Trimmed extracted text.
 */
const extractPlainTextFromPdfFile = async absolutePdfPath => {
  const pdfBuffer = await fs.readFile(absolutePdfPath);
  const { PDFParse } = await loadPdfParse();
  const pdfParser = new PDFParse({ data: new Uint8Array(pdfBuffer) });

  try {
    const textResult = await pdfParser.getText();
    return String(textResult?.text || '').trim();
  } finally {
    await pdfParser.destroy();
  }
};

/**
 * Chunks extracted PDF text, embeds each chunk, and marks the document ready or failed.
 *
 * @param {number} documentId - Document id being indexed.
 * @param {string} absolutePdfPath - Absolute path to the PDF on disk.
 * @returns {Promise<void>} Status is written on the `documents` row.
 */
const indexPdfChunksAndEmbeddings = async (documentId, absolutePdfPath) => {
  try {
    const extractedText = await extractPlainTextFromPdfFile(absolutePdfPath);
    const textChunks = chunkTextWithOverlap(extractedText);
    if (textChunks.length === 0) {
      throw new Error('No extractable text in this PDF.');
    }

    for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex += 1) {
      const chunkContent = textChunks[chunkIndex];
      const insertedChunk = await safeExecute(
        `INSERT INTO document_chunks (document_id, chunk_index, content)
         VALUES (?, ?, ?)`,
        [documentId, chunkIndex, chunkContent],
      );
      const embedding = await generateEmbedding(
        chunkContent,
        'RETRIEVAL_DOCUMENT',
      );
      await safeExecute(
        `INSERT INTO document_chunk_vectors (chunk_id, source_text, embedding, status)
         VALUES (?, ?, ?, 'ready')`,
        [insertedChunk.insertId, chunkContent, JSON.stringify(embedding)],
      );
    }

    await safeExecute(
      `UPDATE documents
       SET status = 'ready', error_message = NULL
       WHERE document_id = ?`,
      [documentId],
    );
  } catch (error) {
    await safeExecute(
      `UPDATE documents
       SET status = 'failed', error_message = ?
       WHERE document_id = ?`,
      [error.message || 'Failed to process PDF.', documentId],
    );
  }
};

/**
 * Saves an uploaded PDF, then extracts, chunks, and embeds it.
 *
 * @param {Object} payload - Upload context.
 * @param {number} payload.userId - Owner id from the JWT.
 * @param {import('multer').File} payload.file - Disk file written by multer.
 * @returns {Promise<RagDocumentPayload>} Document metadata after processing.
 * @throws {BadRequestError} When no PDF was uploaded.
 */
export const createDocumentFromUploadService = async ({ userId, file }) => {
  if (!file?.path) {
    throw new BadRequestError('Upload a PDF using form field "file".');
  }

  const pdfBytes = await fs.readFile(file.path);
  const storagePath = `${userId}/${file.filename}`;  // the relative path stored in the database, not the display name.
  const originalFileName = file.originalname || 'document.pdf';

  const insertResult = await safeExecute(
    `INSERT INTO documents
      (user_id, title, mime_type, storage_path, byte_size, pdf_bytes, status)
     VALUES (?, ?, ?, ?, ?, ?, 'processing')`,
    [
      userId,
      originalFileName,
      file.mimetype || 'application/pdf',
      storagePath,
      file.size || pdfBytes.length,
      pdfBytes,
    ],
  );

  await indexPdfChunksAndEmbeddings(insertResult.insertId, file.path);   //insertId is “the document_id MySQL just created.”
  const documentRow = await assertOwnedDocument(insertResult.insertId, userId);
  return mapDocumentRowToObjectForm(documentRow);
};

/**
 * Lists PDFs uploaded by the current user, newest first.
 *
 * @param {number} userId - Authenticated user id from the JWT.
 * @returns {Promise<RagDocumentPayload[]>} Document metadata rows.
 */
export const listDocumentsForUserService = async userId => {
  const documentRows = await safeExecute(
    `SELECT document_id, user_id, title, mime_type, storage_path, byte_size,
            status, error_message, created_at, updated_at
     FROM documents
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId],
  );

  return documentRows.map(mapDocumentRowToObjectForm);
};

/**
 * Returns metadata for one owned document.
 *
 * @param {number} documentId - Document id from the URL.
 * @param {number} userId - Authenticated user id from the JWT.
 * @returns {Promise<RagDocumentPayload>} Document metadata.
 * @throws {NotFoundError} When missing or not owned.
 */
export const getDocumentMetaService = async (documentId, userId) => {
  const documentRow = await assertOwnedDocument(documentId, userId);
  return mapDocumentRowToObjectForm(documentRow);
};

/**
 * Deletes an owned PDF from disk and the database (chunks cascade).
 *
 * @param {number} documentId - Document id from the URL.
 * @param {number} userId - Authenticated user id from the JWT.
 * @returns {Promise<{id: number}>} Deleted document id.
 * @throws {NotFoundError} When missing or not owned.
 */
export const deleteDocumentService = async (documentId, userId) => {
  const documentRow = await assertOwnedDocument(documentId, userId);
  const absolutePdfPath = resolveDocumentPath(documentRow.storage_path);

  try {
    await fs.unlink(absolutePdfPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await safeExecute(
    'DELETE FROM documents WHERE document_id = ? AND user_id = ?',
    [documentId, userId],
  );

  return { id: documentId };
};

/**
 * Loads ready chunk vectors and text for one document.
 *
 * @param {number} documentId - Document id.
 * @returns {Promise<Array<{chunkId: number, chunkIndex: number, content: string, embedding: number[]}>>}
 *   Chunks that can be scored with cosine similarity.
 */
const loadReadyDocumentChunksWithEmbeddings = async documentId => {
  const chunkRows = await safeExecute(
    `SELECT c.chunk_id, c.chunk_index, c.content, v.embedding
     FROM document_chunks c
     INNER JOIN document_chunk_vectors v ON v.chunk_id = c.chunk_id
     WHERE c.document_id = ? AND v.status = 'ready'`,
    [documentId],
  );

  return chunkRows.map(chunkRow => ({
    chunkId: chunkRow.chunk_id,
    chunkIndex: chunkRow.chunk_index,
    content: chunkRow.content,
    embedding: parseEmbedding(chunkRow.embedding),
  }));
};

/**
 * Ranks excerpts in one owned, ready document by cosine similarity.
 *
 * @param {Object} payload - Search inputs.
 * @param {number} payload.documentId - Document id from the URL.
 * @param {number} payload.userId - Authenticated user id from the JWT.
 * @param {string} payload.query - Search text.
 * @param {number} [payload.resultLimit] - Maximum excerpts to return.
 * @returns {Promise<{query: string, results: RagSearchHit[]}>} Ranked excerpts.
 * @throws {BadRequestError} When the PDF is not ready or has no chunks.
 * @throws {NotFoundError} When the document is missing or not owned.
 */
export const searchDocumentByCosineSimilarityService = async ({
  documentId,
  userId,
  query,
  resultLimit = DEFAULT_SEARCH_RESULT_LIMIT,
}) => {
  const documentRow = await assertOwnedDocument(documentId, userId);
  if (documentRow.status !== 'ready') {
    throw new BadRequestError(
      documentRow.status === 'failed'
        ? 'This PDF failed to index. Upload it again.'
        : 'This PDF is still processing. Try again in a moment.',
    );
  }

  const documentChunks = await loadReadyDocumentChunksWithEmbeddings(documentId);
  if (!documentChunks.length) {
    throw new BadRequestError('No indexed passages in this document.');
  }

  const queryEmbedding = await generateEmbedding(query, 'RETRIEVAL_QUERY');
  const rankedMatches = rankByCosine(queryEmbedding, documentChunks, {
    limit: resultLimit,
    threshold: DEFAULT_SEARCH_SCORE_THRESHOLD,
  });

  return {
    query,
    results: rankedMatches.map(match => ({
      chunkId: match.chunkId,
      chunkIndex: match.chunkIndex,
      score: Number(match.score.toFixed(4)),
      excerpt: match.content,
    })),
  };
};

/**
 * Answers a question using only the top matching passages from one PDF.
 *
 * @param {Object} payload - Query inputs.
 * @param {number} payload.documentId - Document id from the URL.
 * @param {number} payload.userId - Authenticated user id from the JWT.
 * @param {string} payload.query - User question.
 * @returns {Promise<{answer: string, citations: Array<{ref: number, chunkIndex: number}>, chunksUsed: number[]}>}
 *   Grounded answer plus source chunk ids.
 * @throws {BadRequestError} When the PDF is not ready or has no chunks.
 * @throws {NotFoundError} When the document is missing or not owned.
 */
export const answerFromDocumentOnlyService = async ({ documentId, userId, query }) => {
  const searchResult = await searchDocumentByCosineSimilarityService({
    documentId,
    userId,
    query,
    resultLimit: DEFAULT_ASK_CONTEXT_CHUNK_COUNT,
  });

  const retrievedPassages = searchResult.results.map(result => result.excerpt);
  const answer = await generateAnswer({
    question: query,
    context: retrievedPassages,
  });

  return {
    answer,
    citations: searchResult.results.map((result, citationIndex) => ({
      ref: citationIndex + 1,
      chunkIndex: result.chunkIndex,
    })),
    chunksUsed: searchResult.results.map(result => result.chunkId),
  };
};
