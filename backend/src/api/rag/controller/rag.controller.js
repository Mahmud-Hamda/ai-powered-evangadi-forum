/**
 * HTTP handlers for RAG document endpoints.
 * Controllers parse the request, call a service, and send JSON (or a PDF stream).
 *
 * @module api/rag/controller
 */
import path from 'node:path';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError } from '../../../utils/errors/index.js';
import {
  answerFromDocumentOnlyService,
  assertOwnedDocument,
  createDocumentFromUploadService,
  deleteDocumentService,
  getDocumentMetaService,
  listDocumentsForUserService,
  resolveDocumentPath,
  searchDocumentByCosineSimilarityService,
} from '../service/rag.service.js';

/**
 * POST /api/rag/documents. Uploads a PDF, indexes its chunks, and returns metadata.
 *
 * @param {import('express').Request} req - `req.file` from multer; `req.user.id` from JWT.
 * @param {import('express').Response} res - 201 `{ success, message, data }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const createDocumentController = async (req, res, next) => {
  try {
    const createdDocument = await createDocumentFromUploadService({
      userId: req.user.id,
      file: req.file,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Document uploaded and processed.',
      data: createdDocument,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rag/documents. Lists the signed-in user's PDFs, newest first.
 *
 * @param {import('express').Request} req - `req.user.id` from JWT.
 * @param {import('express').Response} res - 200 `{ success, message, data }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const listDocumentsController = async (req, res, next) => {
  try {
    const documents = await listDocumentsForUserService(req.user.id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Documents fetched successfully.',
      data: documents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rag/documents/:documentId. Returns metadata for one owned PDF.
 *
 * @param {import('express').Request} req - `req.params.documentId`; `req.user.id`.
 * @param {import('express').Response} res - 200 `{ success, message, data }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const getDocumentMetaController = async (req, res, next) => {
  try {
    const document = await getDocumentMetaService(
      Number(req.params.documentId),
      req.user.id,
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Document fetched successfully.',
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rag/documents/:documentId/file. Streams the PDF for the reader iframe.
 *
 * @param {import('express').Request} req - `req.params.documentId`; `req.user.id`.
 * @param {import('express').Response} res - 200 `application/pdf` bytes.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const getDocumentFileController = async (req, res, next) => {
  try {
    const ownedDocument = await assertOwnedDocument(
      Number(req.params.documentId),
      req.user.id,
    );
    const absolutePdfPath = resolveDocumentPath(ownedDocument.storage_path);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(ownedDocument.title)}"`,
    );
    res.sendFile(path.resolve(absolutePdfPath), sendFileError => {
      if (sendFileError) {
        next(sendFileError);
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/rag/documents/:documentId. Removes the PDF file and database row.
 *
 * @param {import('express').Request} req - `req.params.documentId`; `req.user.id`.
 * @param {import('express').Response} res - 200 `{ success, message, data: { id } }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const deleteDocumentController = async (req, res, next) => {
  try {
    const deletedDocument = await deleteDocumentService(
      Number(req.params.documentId),
      req.user.id,
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Document deleted successfully.',
      data: deletedDocument,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/rag/documents/:documentId/search. Returns ranked chunk excerpts.
 *
 * @param {import('express').Request} req - `req.params.documentId`, `req.query.query`, optional `req.query.k`.
 * @param {import('express').Response} res - 200 `{ success, message, data: { query, results } }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const searchInDocumentController = async (req, res, next) => {
  try {
    const searchResult = await searchDocumentByCosineSimilarityService({
      documentId: Number(req.params.documentId),
      userId: req.user.id,
      query: String(req.query.query),
      resultLimit: req.query.k ? Number(req.query.k) : undefined,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Ranked chunk excerpts',
      data: searchResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/rag/documents/:documentId/query. Answers from retrieved PDF passages only.
 *
 * @param {import('express').Request} req - `req.params.documentId`; `req.body.query`.
 * @param {import('express').Response} res - 200 `{ success, message, data: { answer, citations, chunksUsed } }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const queryDocumentController = async (req, res, next) => {
  try {
    const userQuestion = String(req.body.query || '').trim();
    if (!userQuestion) {
      throw new BadRequestError('Body field "query" is required.');
    }

    const groundedAnswer = await answerFromDocumentOnlyService({
      documentId: Number(req.params.documentId),
      userId: req.user.id,
      query: userQuestion,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Answer and citations',
      data: groundedAnswer,
    });
  } catch (error) {
    next(error);
  }
};
