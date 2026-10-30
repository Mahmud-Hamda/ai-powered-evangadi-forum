import { apiClient } from '../core/api.client.js';

/**
 * @typedef {import('../../types/forum.js').ForumQuestion} ForumQuestion
 * @typedef {import('../../types/forum.js').QuestionDetailPayload} QuestionDetailPayload
 * @typedef {import('../../types/forum.js').QuestionFormData} QuestionFormData
 * @typedef {import('../../types/forum.js').QuestionListOptions} QuestionListOptions
 * @typedef {import('../../types/forum.js').DraftCoachFeedback} DraftCoachFeedback
 * @typedef {import('../../types/forum.js').AnswerFitResult} AnswerFitResult
 */

/**
 * Turns an axios failure into an Error with a readable message.
 *
 * @param {import('axios').AxiosError<{msg?: string, message?: string}> | Error} error - The caught request error.
 * @param {string} fallback - Message used when the server sends none.
 * @returns {Error} Error whose `.message` can be shown in the UI.
 */
const toServiceError = (error, fallback) => {
  const message =
    error.response?.data?.msg || error.response?.data?.message || fallback;
  return new Error(message);
};

/**
 * Creates a new question (POST /api/questions).
 *
 * @param {QuestionFormData} payload - Title and body from the ask form.
 * @returns {Promise<ForumQuestion>} The created question, including `questionHash`.
 * @throws {Error} When the request fails.
 */
export async function createQuestion(payload) {
  const { title, content } = payload;
  try {
    const response = await apiClient.post('/api/questions', { title, content });
    return response.data.data;
  } catch (error) {
    throw toServiceError(error, 'Failed to post question.');
  }
}

/**
 * Lists questions (GET /api/questions).
 *
 * @param {QuestionListOptions} [options] - Optional keyword or "mine" filter.
 * @returns {Promise<ForumQuestion[]>} Questions, newest first.
 * @throws {Error} When the request fails.
 */
export async function getQuestions(options = {}) {
  const { search, mine } = options;
  try {
    const params = {};
    if (search) params.q = search;
    if (mine) params.mine = true;
    const response = await apiClient.get('/api/questions', { params });
    return response.data.data;
  } catch (error) {
    throw toServiceError(error, 'Failed to load questions.');
  }
}

/**
 * Semantic similarity search (GET /api/questions/search).
 *
 * @param {string} query - Natural-language search text (min 5 characters).
 * @param {Object} [options] - Ranking options.
 * @param {number} [options.k=10] - Maximum number of results.
 * @param {number} [options.threshold=0.75] - Minimum cosine similarity.
 * @returns {Promise<ForumQuestion[]>} Ranked similar questions, including `score`.
 * @throws {Error} When the request fails.
 */
export async function searchQuestionsSemantic(query, options = {}) {
  const { k = 10, threshold = 0.75 } = options;
  try {
    const response = await apiClient.get('/api/questions/search', {
      params: { query, k, threshold },
      timeout: 60000,
    });
    return response.data.data;
  } catch (error) {
    throw toServiceError(error, 'Failed to run AI search.');
  }
}

/**
 * Related threads for one question (GET /api/questions/:questionHash/similar).
 *
 * @param {string} questionHash - The 16-character source question hash.
 * @param {Object} [options] - Ranking options.
 * @param {number} [options.k=4] - Maximum number of results.
 * @param {number} [options.threshold=0.75] - Minimum cosine similarity.
 * @returns {Promise<ForumQuestion[]>} Ranked similar questions, including `score`.
 * @throws {Error} When the request fails.
 */
export async function getSimilarQuestions(questionHash, options = {}) {
  const { k = 4, threshold = 0.75 } = options;
  try {
    const response = await apiClient.get(
      `/api/questions/${questionHash}/similar`,
      {
        params: { k, threshold },
        timeout: 30000,
      },
    );
    return response.data.data;
  } catch (error) {
    throw toServiceError(error, 'Failed to load related questions.');
  }
}

/**
 * Fetches one question and its answers (GET /api/questions/:questionHash).
 *
 * @param {string} questionHash - The 16-character public question hash.
 * @returns {Promise<QuestionDetailPayload>} `{ question, answers }` for the thread page.
 * @throws {Error} When the question is missing or the request fails.
 */
export async function getSingleQuestion(questionHash) {
  try {
    const response = await apiClient.get(`/api/questions/${questionHash}`);
    return response.data;
  } catch (error) {
    throw toServiceError(error, 'Failed to load question.');
  }
}

/**
 * Updates a question owned by the current user (PUT /api/questions/:questionHash).
 *
 * @param {Object} payload - Fields to save.
 * @param {string} payload.questionHash - The question hash.
 * @param {string} payload.title - The updated title.
 * @param {string} payload.content - The updated body.
 * @returns {Promise<ForumQuestion>} The updated question row.
 * @throws {Error} When the user does not own it or the request fails.
 */
export async function updateQuestion(payload) {
  const { questionHash, title, content } = payload;
  try {
    const response = await apiClient.put(`/api/questions/${questionHash}`, {
      title,
      content,
    });
    return response.data.question;
  } catch (error) {
    throw toServiceError(error, 'Failed to update question.');
  }
}

/**
 * Deletes a question owned by the current user (DELETE /api/questions/:questionHash).
 *
 * @param {string} questionHash - The question hash.
 * @returns {Promise<void>} Resolves when the question is gone.
 * @throws {Error} When the user does not own it or the request fails.
 */
export async function deleteQuestion(questionHash) {
  try {
    await apiClient.delete(`/api/questions/${questionHash}`);
  } catch (error) {
    throw toServiceError(error, 'Failed to delete question.');
  }
}

/**
 * Scores how well a draft answer addresses a question.
 *
 * @param {string} questionHash - The 16-character question hash.
 * @param {string} answerText - The draft answer to score.
 * @returns {Promise<AnswerFitResult>} `{ level, note }` from the AI coach.
 * @throws {Error} When the fit request fails.
 */
export async function assessAnswerFit(questionHash, answerText) {
  try {
    const response = await apiClient.post(
      `/api/questions/${questionHash}/answer-fit`,
      { answerText },
      { timeout: 30000 },
    );
    return response.data.data;
  } catch (error) {
    throw toServiceError(error, 'Failed to check answer fit.');
  }
}

/**
 * Asks the AI draft coach for tips before posting a question.
 *
 * @param {QuestionFormData} payload - Draft title and body.
 * @returns {Promise<DraftCoachFeedback>} `{ tips: string[] }` from the API.
 * @throws {Error} If the draft-coach request fails.
 */
export async function generateQuestionDraftCoach(payload) {
  const { title, content } = payload;
  try {
    const response = await apiClient.post(
      '/api/questions/draft-coach',
      { title, content },
      { timeout: 60000 },
    );
    return response.data.data;
  } catch (error) {
    throw toServiceError(error, 'Failed to get AI draft feedback.');
  }
}

export const questionService = {
  createQuestion,
  getQuestions,
  searchQuestionsSemantic,
  getSimilarQuestions,
  getSingleQuestion,
  updateQuestion,
  deleteQuestion,
  assessAnswerFit,
  generateQuestionDraftCoach,
};
