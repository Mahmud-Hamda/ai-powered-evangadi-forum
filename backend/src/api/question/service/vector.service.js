import { safeExecute } from '../../../../db/config.js';
import {
  rankByCosine,
  parseEmbedding,
} from '../../../utils/cosine/cosine.js';

const DEFAULT_K = Number(process.env.RECOMMEND_K) || 5;
const DEFAULT_THRESHOLD = Number(process.env.RECOMMEND_THRESHOLD) || 0.75;

export { parseEmbedding };

/**
 * Ranks ready question vectors by cosine similarity to a query embedding.
 *
 * @param {number[]} vector - The query embedding.
 * @param {number} [limit] - Maximum number of matches to return.
 * @param {Object} [options] - Extra ranking options.
 * @param {number} [options.threshold] - Minimum score to keep.
 * @param {number} [options.excludeQuestionId] - Question id to skip (similar-to).
 * @returns {Promise<{questionId: number, score: number}[]>} Ranked matches.
 */
export const rankReadyQuestionVectors = async (
  vector,
  limit = DEFAULT_K,
  options = {},
) => {
  const threshold =
    typeof options.threshold === 'number' ? options.threshold : DEFAULT_THRESHOLD;
  const excludeQuestionId = options.excludeQuestionId;
  const cap = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_K;

  const rows = await safeExecute(
    `SELECT question_id, embedding
     FROM question_vectors
     WHERE status = 'ready'`,
    [],
  );

  const items = [];

  for (const row of rows) {
    if (excludeQuestionId && row.question_id === excludeQuestionId) {
      continue;
    }

    items.push({
      questionId: row.question_id,
      embedding: parseEmbedding(row.embedding),
    });
  }

  return rankByCosine(vector, items, { limit: cap, threshold });
};
