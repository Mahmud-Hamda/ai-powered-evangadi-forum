import express from 'express';
import { authenticateUser } from '../../../middleware/authentication.js';
import {
  assessAnswerAgainstQuestionController,
  createQuestionController,
  deleteQuestionController,
  generateQuestionDraftCoachController,
  getQuestionsController,
  getSimilarQuestionsController,
  getSingleQuestionController,
  searchQuestionsSemanticController,
  updateQuestionController,
} from '../controller/question.controller.js';
import {
  assessAnswerFitValidation,
  createQuestionValidation,
  generateQuestionDraftCoachValidation,
  getQuestionsValidation,
  getSimilarQuestionsValidation,
  questionHashParamValidation,
  searchQuestionsSemanticValidation,
  updateQuestionValidation,
} from '../validation/question.validation.js';

const router = express.Router();

/**
 * Requires a valid JWT on every question route.
 */
router.use(authenticateUser);

/**
 * Posts a new question.
 *
 * @route POST /api/questions
 * @access Private
 * @param {string} req.body.title - The question title.
 * @param {string} req.body.content - The question text.
 */
router.post('/', createQuestionValidation, createQuestionController);

/**
 * Lists questions, optionally filtered by search or current user.
 *
 * @route GET /api/questions
 * @access Private
 * @param {string} [req.query.search] - Optional keyword search.
 * @param {boolean} [req.query.mine] - When true, only the current user's questions.
 */
router.get('/', getQuestionsValidation, getQuestionsController);

/**
 * Semantic search over question embeddings. Must stay before `/:questionHash`.
 *
 * @route GET /api/questions/search
 * @access Private
 * @param {string} req.query.query - Search text (min 5 characters).
 * @param {number} [req.query.k] - Maximum results (1-20).
 * @param {number} [req.query.threshold] - Minimum cosine similarity (0-1).
 */
router.get(
  '/search',
  searchQuestionsSemanticValidation,
  searchQuestionsSemanticController,
);

/**
 * Returns AI tips for a question draft before posting.
 *
 * @route POST /api/questions/draft-coach
 * @access Private
 * @param {string} [req.body.title] - Optional question title.
 * @param {string} req.body.content - The question body.
 */
router.post(
  '/draft-coach',
  generateQuestionDraftCoachValidation,
  generateQuestionDraftCoachController,
);

/**
 * Scores how well a draft answer addresses the question.
 *
 * @route POST /api/questions/:questionHash/answer-fit
 * @access Private
 * @param {string} req.params.questionHash - The 16-character question hash.
 * @param {string} req.body.answerText - The unpublished answer draft.
 */
router.post(
  '/:questionHash/answer-fit',
  assessAnswerFitValidation,
  assessAnswerAgainstQuestionController,
);

/**
 * Recommends similar threads by embedding. Must stay before `/:questionHash`.
 *
 * @route GET /api/questions/:questionHash/similar
 * @access Private
 * @param {string} req.params.questionHash - The 16-character question hash.
 * @param {number} [req.query.k] - Maximum results (1-20).
 * @param {number} [req.query.threshold] - Minimum cosine similarity (0-1).
 */
router.get(
  '/:questionHash/similar',
  getSimilarQuestionsValidation,
  getSimilarQuestionsController,
);

/**
 * Returns one question by hash, plus its answers.
 *
 * @route GET /api/questions/:questionHash
 * @access Private
 * @param {string} req.params.questionHash - The 16-character question hash.
 */
router.get(
  '/:questionHash',
  questionHashParamValidation,
  getSingleQuestionController,
);

/**
 * Updates a question owned by the current user.
 *
 * @route PUT /api/questions/:questionHash
 * @access Private
 * @param {string} req.params.questionHash - The 16-character question hash.
 * @param {string} req.body.title - The updated title.
 * @param {string} req.body.content - The updated question text.
 */
router.put(
  '/:questionHash',
  updateQuestionValidation,
  updateQuestionController,
);

/**
 * Deletes a question owned by the current user.
 *
 * @route DELETE /api/questions/:questionHash
 * @access Private
 * @param {string} req.params.questionHash - The 16-character question hash.
 */
router.delete(
  '/:questionHash',
  questionHashParamValidation,
  deleteQuestionController,
);

export default router;
