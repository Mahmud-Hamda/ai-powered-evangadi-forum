/**
 * Express-validator chains for RAG document routes.
 *
 * @module api/rag/validations
 */
import { body, param, query } from 'express-validator';
import { validationErrorHandler } from '../../../middleware/validation-handler.js';

/**
 * Requires a numeric `documentId` path param.
 *
 * @returns {Array} Middleware that rejects invalid ids with 400.
 */
export const documentIdParamValidation = [
  param('documentId')
    .isInt({ min: 1 })
    .withMessage('documentId must be a positive integer')
    .toInt(),
  validationErrorHandler,
];

/**
 * Validates semantic search: `documentId`, required `query`, optional `k`.
 *
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const searchInDocumentValidation = [
  param('documentId')
    .isInt({ min: 1 })
    .withMessage('documentId must be a positive integer')
    .toInt(),
  query('query')
    .trim()
    .notEmpty()
    .withMessage('Query parameter "query" is required.')
    .isLength({ min: 3, max: 2000 })
    .withMessage('Query must be between 3 and 2000 characters'),
  query('k')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('k must be an integer between 1 and 20')
    .toInt(),
  validationErrorHandler,
];

/**
 * Validates Ask AI: `documentId` in the path and `query` in the JSON body.
 *
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const queryDocumentValidation = [
  param('documentId')
    .isInt({ min: 1 })
    .withMessage('documentId must be a positive integer')
    .toInt(),
  body('query')
    .trim()
    .notEmpty()
    .withMessage('Body field "query" is required.')
    .isLength({ min: 3, max: 4000 })
    .withMessage('Query must be between 3 and 4000 characters'),
  validationErrorHandler,
];
