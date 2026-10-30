import { body, param, query } from 'express-validator';
import { validationErrorHandler } from '../../../middleware/validation-handler.js';

/**
 * Validates the request body when posting a new question.
 *
 * @param {string} title - The question title from the request body (5-255 characters).
 * @param {string} content - The question text from the request body (min 10 characters).
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const createQuestionValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isString()
    .withMessage('Title must be a string')
    .isLength({ min: 5, max: 255 })
    .withMessage('Title must be between 5 and 255 characters')
    .trim(),
  body('content')
    .notEmpty()
    .withMessage('Question content is required')
    .isString()
    .withMessage('Question content must be a string')
    .isLength({ min: 10 })
    .withMessage('Question content must be at least 10 characters long')
    .trim(),
  validationErrorHandler,
];

/**
 * Validates optional query params when listing questions.
 *
 * @param {string} [search] - Optional keyword to match against title or content.
 * @param {string} [q] - Optional alias for search (frontend uses ?q=).
 * @param {boolean} [mine] - When true, return only the current user's questions.
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const getQuestionsValidation = [
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .isLength({ min: 1, max: 255 })
    .withMessage('Search must be between 1 and 255 characters')
    .trim(),
  query('q')
    .optional()
    .isString()
    .withMessage('Search query must be a string')
    .isLength({ min: 1, max: 255 })
    .withMessage('Search query must be between 1 and 255 characters')
    .trim(),
  query('mine')
    .optional()
    .isBoolean()
    .withMessage('Mine must be a boolean')
    .toBoolean(),
  validationErrorHandler,
];

/**
 * Validates the 16-character hex hash in the route param.
 *
 * @param {string} questionHash - The question hash from the route param.
 * @returns {Array} Middleware that rejects an invalid hash with 400.
 */
export const questionHashParamValidation = [
  param('questionHash')
    .matches(/^[a-f0-9]{16}$/)
    .withMessage('Question hash must be a 16-character lowercase hex string'),
  validationErrorHandler,
];

/**
 * Validates the hash and body when updating a question.
 *
 * @param {string} questionHash - The question hash from the route param.
 * @param {string} title - The updated title (5-255 characters).
 * @param {string} content - The updated question text (min 10 characters).
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const updateQuestionValidation = [
  param('questionHash')
    .matches(/^[a-f0-9]{16}$/)
    .withMessage('Question hash must be a 16-character lowercase hex string'),
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isString()
    .withMessage('Title must be a string')
    .isLength({ min: 5, max: 255 })
    .withMessage('Title must be between 5 and 255 characters')
    .trim(),
  body('content')
    .notEmpty()
    .withMessage('Question content is required')
    .isString()
    .withMessage('Question content must be a string')
    .isLength({ min: 10 })
    .withMessage('Question content must be at least 10 characters long')
    .trim(),
  validationErrorHandler,
];

/**
 * Validates semantic search query params.
 *
 * @param {string} query - Search text (min 5 characters). `q` is accepted as an alias.
 * @param {number} [k] - Optional result cap (1-20).
 * @param {number} [threshold] - Optional cosine threshold (0-1).
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const searchQuestionsSemanticValidation = [
  query('query')
    .customSanitizer((value, { req }) => value || req.query.q)
    .notEmpty()
    .withMessage('Query is required')
    .isString()
    .withMessage('Query must be a string')
    .isLength({ min: 5, max: 500 })
    .withMessage('Query must be between 5 and 500 characters')
    .trim(),
  query('k')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('k must be an integer between 1 and 20')
    .toInt(),
  query('threshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('threshold must be a number between 0 and 1')
    .toFloat(),
  validationErrorHandler,
];

/**
 * Validates similar-question lookup: hash plus optional ranking params.
 *
 * @param {string} questionHash - The source question hash from the route param.
 * @param {number} [k] - Optional result cap (1-20).
 * @param {number} [threshold] - Optional cosine threshold (0-1).
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const getSimilarQuestionsValidation = [
  param('questionHash')
    .matches(/^[a-f0-9]{16}$/)
    .withMessage('Question hash must be a 16-character lowercase hex string'),
  query('k')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('k must be an integer between 1 and 20')
    .toInt(),
  query('threshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('threshold must be a number between 0 and 1')
    .toFloat(),
  validationErrorHandler,
];

/**
 * Validates a question draft sent to the AI coach.
 *
 * @param {string} [title] - Optional title (max 255 characters).
 * @param {string} content - The question body (min 10 characters).
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const generateQuestionDraftCoachValidation = [
  body('title')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Title must be a string')
    .isLength({ max: 255 })
    .withMessage('Title must be at most 255 characters')
    .trim(),
  body('content')
    .notEmpty()
    .withMessage('Question content is required')
    .isString()
    .withMessage('Question content must be a string')
    .isLength({ min: 10 })
    .withMessage('Question content must be at least 10 characters long')
    .trim(),
  validationErrorHandler,
];

/**
 * Validates the hash and draft when checking answer fit.
 *
 * @param {string} questionHash - The question hash from the route param.
 * @param {string} answerText - The unpublished answer draft (min 20 characters).
 *   `answerContent` is accepted as an alias.
 * @returns {Array} Middleware that rejects invalid input with 400.
 */
export const assessAnswerFitValidation = [
  param('questionHash')
    .matches(/^[a-f0-9]{16}$/)
    .withMessage('Question hash must be a 16-character lowercase hex string'),
  body('answerText')
    .customSanitizer((value, { req }) => value || req.body.answerContent)
    .notEmpty()
    .withMessage('Answer text is required')
    .isString()
    .withMessage('Answer text must be a string')
    .isLength({ min: 20 })
    .withMessage('Answer text must be at least 20 characters long')
    .trim(),
  validationErrorHandler,
];
