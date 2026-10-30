import { apiClient } from '../core/api.client.js';

/**
 * @typedef {import('../../types/forum.js').ForumAnswer} ForumAnswer
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
 * Posts an answer to a question (POST /api/answers).
 *
 * @param {Object} payload - The answer data.
 * @param {number} payload.questionId - The parent question ID.
 * @param {string} payload.content - The answer text.
 * @returns {Promise<ForumAnswer>} The created answer, including `id` and `author`.
 * @throws {Error} When the request fails.
 */
export async function postAnswer({ questionId, content }) {
  try {
    const response = await apiClient.post('/api/answers', {
      questionId,
      content,
    });
    return response.data.data;
  } catch (error) {
    throw toServiceError(error, 'Failed to post answer.');
  }
}

/**
 * Updates an answer owned by the current user (PUT /api/answers/:answerId).
 *
 * @param {Object} payload - The update data.
 * @param {number} payload.answerId - The answer ID.
 * @param {string} payload.content - The updated answer text.
 * @returns {Promise<ForumAnswer>} The updated answer row.
 * @throws {Error} When the user does not own it or the request fails.
 */
export async function updateAnswer({ answerId, content }) {
  try {
    const response = await apiClient.put(`/api/answers/${answerId}`, {
      content,
    });
    return response.data.answer;
  } catch (error) {
    throw toServiceError(error, 'Failed to update answer.');
  }
}

/**
 * Deletes an answer owned by the current user (DELETE /api/answers/:answerId).
 *
 * @param {number} answerId - The answer ID.
 * @returns {Promise<void>} Resolves when the answer is gone.
 * @throws {Error} When the user does not own it or the request fails.
 */
export async function deleteAnswer(answerId) {
  try {
    await apiClient.delete(`/api/answers/${answerId}`);
  } catch (error) {
    throw toServiceError(error, 'Failed to delete answer.');
  }
}

export const answerService = {
  postAnswer,
  updateAnswer,
  deleteAnswer,
};
