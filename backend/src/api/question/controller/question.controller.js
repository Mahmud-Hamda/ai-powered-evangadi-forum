import { StatusCodes } from 'http-status-codes';
import {
  createQuestionWithVectorService,
  deleteQuestionService,
  getQuestionsService,
  getSimilarQuestionsService,
  getSingleQuestionService,
  searchQuestionsSemanticService,
  updateQuestionService,
} from '../service/question.service.js';
import {
  assessAnswerAgainstQuestionService,
  generateQuestionDraftCoachService,
} from '../service/geminiTextCoach.service.js';

/**
 * Posts a new question for the authenticated user.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {string} req.body.title - The question title.
 * @param {string} req.body.content - The question text.
 * @param {number} req.user.id - The authenticated user's ID.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
/**
 * POST /api/questions. Saves the question and generates a Gemini embedding.
 *
 * @param {import('express').Request} req - `req.body.title`, `req.body.content`; `req.user.id` from JWT.
 * @param {import('express').Response} res - 201 `{ success, message, data: question }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const createQuestionController = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    const question = await createQuestionWithVectorService({
      title,
      content,
      userId: req.user.id,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Question posted successfully.',
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists questions, with optional search and "mine" filters.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {string} [req.query.search] - Optional keyword search.
 * @param {string} [req.query.q] - Optional alias for search.
 * @param {boolean} [req.query.mine] - When true, only this user's questions.
 * @param {number} req.user.id - The authenticated user's ID.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
/**
 * GET /api/questions. Optional `search` and `mine` query filters.
 *
 * @param {import('express').Request} req - `req.query.search`, `req.query.mine`; `req.user.id`.
 * @param {import('express').Response} res - 200 `{ success, message, data: questions, meta }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const getQuestionsController = async (req, res, next) => {
  try {
    const search = req.query.search || req.query.q;
    const mine = req.query.mine === true || req.query.mine === 'true';

    const { questions, total } = await getQuestionsService({
      search,
      userId: req.user.id,
      mine,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Questions fetched successfully.',
      data: questions,
      meta: {
        limit: 100,
        total,
        sortBy: 'newest',
        sortOrder: 'desc',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/questions/search. Semantic similarity search against question vectors.
 *
 * @param {import('express').Request} req - `req.query.query` (or `q`), optional `k` and `threshold`.
 * @param {import('express').Response} res - 200 `{ success, message, data, meta }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const searchQuestionsSemanticController = async (req, res, next) => {
  try {
    const query = String(req.query.query || req.query.q || '').trim();
    const k = req.query.k !== undefined ? Number(req.query.k) : undefined;
    const threshold =
      req.query.threshold !== undefined
        ? Number(req.query.threshold)
        : undefined;

    const { questions, meta } = await searchQuestionsSemanticService({
      query,
      k: Number.isFinite(k) ? k : undefined,
      threshold: Number.isFinite(threshold) ? threshold : undefined,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Semantic search completed successfully',
      data: questions,
      meta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/questions/:questionHash/similar. Recommends related threads by embedding.
 *
 * @param {import('express').Request} req - `req.params.questionHash`, optional `k` and `threshold`.
 * @param {import('express').Response} res - 200 `{ success, message, data, meta }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const getSimilarQuestionsController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;
    const k = req.query.k !== undefined ? Number(req.query.k) : undefined;
    const threshold =
      req.query.threshold !== undefined
        ? Number(req.query.threshold)
        : undefined;

    const { questions, meta } = await getSimilarQuestionsService({
      questionHash,
      k: Number.isFinite(k) ? k : undefined,
      threshold: Number.isFinite(threshold) ? threshold : undefined,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Similar questions fetched successfully',
      data: questions,
      meta,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns one question by hash, plus its answers.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {string} req.params.questionHash - The 16-character question hash.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
/**
 * GET /api/questions/:questionHash. Returns the thread question plus answers.
 *
 * @param {import('express').Request} req - `req.params.questionHash` (16-char hex).
 * @param {import('express').Response} res - 200 `{ success, message, question, answers, answersMeta }`.
 * @param {import('express').NextFunction} next - Error middleware (404 if missing).
 * @returns {Promise<void>}
 */
export const getSingleQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;
    const { question, answers } = await getSingleQuestionService({
      questionHash,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Question fetched successfully',
      question,
      answers,
      answersMeta: {
        limit: 100,
        total: answers.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a question owned by the current user.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {string} req.params.questionHash - The 16-character question hash.
 * @param {string} req.body.title - The updated title.
 * @param {string} req.body.content - The updated question text.
 * @param {number} req.user.id - The authenticated user's ID.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
/**
 * PUT /api/questions/:questionHash. Owner-only title/body update.
 *
 * @param {import('express').Request} req - `req.params.questionHash`, `req.body.title`, `req.body.content`.
 * @param {import('express').Response} res - 200 `{ success, question }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const updateQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;
    const { title, content } = req.body;

    const question = await updateQuestionService({
      questionHash,
      userId: req.user.id,
      title,
      content,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Question updated successfully.',
      question,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a question owned by the current user.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {string} req.params.questionHash - The 16-character question hash.
 * @param {number} req.user.id - The authenticated user's ID.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
/**
 * DELETE /api/questions/:questionHash. Owner-only delete.
 *
 * @param {import('express').Request} req - `req.params.questionHash`; `req.user.id`.
 * @param {import('express').Response} res - 200 `{ success, message }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const deleteQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;

    await deleteQuestionService({
      questionHash,
      userId: req.user.id,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Question deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Scores how well a draft answer addresses the question.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {string} req.params.questionHash - The 16-character question hash.
 * @param {string} req.body.answerText - The unpublished answer draft.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
/**
 * POST /api/questions/:questionHash/answer-fit. Scores a draft answer.
 *
 * @param {import('express').Request} req - `req.params.questionHash`, `req.body.answerText`.
 * @param {import('express').Response} res - 200 `{ success, data: { level, note } }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const assessAnswerAgainstQuestionController = async (req, res, next) => {
  try {
    const { questionHash } = req.params;
    const answerText = req.body.answerText || req.body.answerContent;

    const data = await assessAnswerAgainstQuestionService({
      questionHash,
      answerDraft: answerText,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Answer fit assessed',
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns AI tips for improving a question draft before posting.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {string} [req.body.title] - Optional question title.
 * @param {string} req.body.content - The question body.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
/**
 * POST /api/questions/draft-coach. AI tips for a question draft.
 *
 * @param {import('express').Request} req - `req.body.title`, `req.body.content`.
 * @param {import('express').Response} res - 200 `{ success, data: { tips } }`.
 * @param {import('express').NextFunction} next - Error middleware.
 * @returns {Promise<void>}
 */
export const generateQuestionDraftCoachController = async (req, res, next) => {
  try {
    const { title, content } = req.body;
    const data = await generateQuestionDraftCoachService({ title, content });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Draft suggestions generated',
      data,
    });
  } catch (error) {
    next(error);
  }
};
