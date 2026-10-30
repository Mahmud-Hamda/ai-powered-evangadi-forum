/**
 * Parses a JSON embedding column from MySQL into a numeric array.
 *
 * @param {unknown} value - JSON array, stringified JSON, or empty.
 * @returns {number[]} The embedding values, or an empty array.
 */
export const parseEmbedding = value => {
  if (Array.isArray(value)) {
    return value.map(Number);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch {
      return [];
    }
  }

  return [];
};

/**
 * Gemini embedding-001 stores the useful signal in the first 768 values.
 * Comparing the full 3072-length vector makes unrelated threads score almost the same.
 */
const COMPARE_DIMENSIONS = 768;

/**
 * Cosine similarity between two vectors, using the first 768 values.
 *
 * @param {number[]} left - The first vector.
 * @param {number[]} right - The second vector.
 * @returns {number} Similarity in roughly [-1, 1], or 0 when invalid.
 */

export const cosineSimilarity = (left, right) => {
  if (!left?.length || !right?.length) {
    return 0;
  }

  const length = Math.min(left.length, right.length, COMPARE_DIMENSIONS);
  left = left.slice(0, length);
  right = right.slice(0, length);

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }

  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denominator === 0 ? 0 : dot / denominator;
};

/**
 * Ranks items by cosine similarity to a query vector.
 *
 * @param {number[]} queryVector - The query embedding.
 * @param {Array<{embedding: number[], [key: string]: unknown}>} items - Rows with an `embedding` field.
 * @param {Object} [options] - Ranking options.
 * @param {number} [options.limit] - Maximum number of matches to return.
 * @param {number} [options.threshold=0] - Minimum score to keep.
 * @returns {Array<Object>} Ranked copies with `score`, without `embedding`.
 */
export const rankByCosine = (queryVector, items, options = {}) => {
  const threshold =
    typeof options.threshold === 'number' ? options.threshold : 0;
  const cap = options.limit;

  const scored = [];

  for (const item of items) {
    const score = cosineSimilarity(queryVector, item.embedding);
    if (score < threshold) {
      continue;
    }

    const { embedding: _embedding, ...rest } = item;
    scored.push({ ...rest, score });
  }

  scored.sort((left, right) => right.score - left.score);

  if (Number.isFinite(cap) && cap > 0) {
    return scored.slice(0, cap);
  }

  return scored;
};
