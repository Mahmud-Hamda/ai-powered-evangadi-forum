import crypto from 'crypto';
import { safeExecute } from '../../../../db/config.js';
import {
  ForbiddenError,
  NotFoundError,
} from '../../../utils/errors/index.js';
import { generateEmbedding } from '../../../utils/gemini/gemini.js';
import { rankReadyQuestionVectors, parseEmbedding } from './vector.service.js';

const VECTOR_BACKFILL_LIMIT = 8;

/**
 * Builds a unique 16-character hex hash for /questions/:questionHash routing.
 *
 * @returns {string} A 16-character lowercase hex string.
 */
const generateQuestionHash = () => crypto.randomBytes(8).toString('hex');

/**
 * Maps a joined questions/users row to the API response shape.
 *
 * @param {Object} row - The database row.
 * @returns {Object} The mapped question, including author and answerCount.
 */
const mapQuestion = row => ({
  id: row.question_id,
  questionHash: row.question_hash,
  title: row.title,
  content: row.content,
  answerCount: Number(row.answer_count) || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  author: {
    id: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
  },
});

/**
 * Maps a joined answers/users row to the API response shape.
 *
 * @param {Object} row - The database row.
 * @returns {Object} The mapped answer, including author details.
 */
const mapAnswer = row => ({
  id: row.answer_id,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  author: {
    id: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
  },
});

/**
 * Stores a question embedding row. Uses failed status when no vector is ready.
 *
 * @param {Object} payload - The vector data.
 * @param {number} payload.questionId - The parent question ID.
 * @param {string} payload.sourceText - The text used for embedding.
 * @param {number[]|null} payload.embedding - The embedding vector, if generated.
 * @param {string} payload.status - ready, pending, or failed.
 * @returns {Promise<void>}
 */
const storeQuestionVector = async ({
  questionId,
  sourceText,
  embedding,
  status,
}) => {
  await safeExecute(
    `INSERT INTO question_vectors (question_id, source_text, embedding, status)
     VALUES (?, ?, ?, ?)`,
    [questionId, sourceText, JSON.stringify(embedding || []), status],
  );
};

/**
 * Creates a question and stores a vector row (ready or failed).
 *
 * @param {Object} payload - The question data.
 * @param {string} payload.title - The question title.
 * @param {string} payload.content - The question text.
 * @param {number} payload.userId - The authenticated author's user ID.
 * @returns {Promise<Object>} The created question object.
 */
export const createQuestionWithVectorService = async ({
  title,
  content,
  userId,
}) => {
  const questionHash = generateQuestionHash();

  const result = await safeExecute(
    'INSERT INTO questions (question_hash, user_id, title, content) VALUES (?, ?, ?, ?)',
    [questionHash, userId, title, content],
  );

  const questionId = result.insertId;
  const sourceText = `${title}\n\n${content}`;

  try {
    const embedding = await generateEmbedding(
      sourceText,
      'RETRIEVAL_DOCUMENT',
    );
    await storeQuestionVector({
      questionId,
      sourceText,
      embedding,
      status: 'ready',
    });
  } catch {
    try {
      await storeQuestionVector({
        questionId,
        sourceText,
        embedding: [],
        status: 'failed',
      });
    } catch {
      // The question row is already stored. A vector failure must not fail the post.
    }
  }

  return {
    id: questionId,
    questionHash,
    title,
    content,
    userId,
  };
};

/**
 * Lists questions with author info and answer counts.
 *
 * @param {Object} filters - The list filters.
 * @param {string} [filters.search] - Optional keyword for title/content LIKE search.
 * @param {number} filters.userId - The authenticated user's ID.
 * @param {boolean} [filters.mine] - When true, return only this user's questions.
 * @returns {Promise<{questions: Object[], total: number}>} The mapped questions and count.
 */
export const getQuestionsService = async ({ search, userId, mine }) => {
  const where = [];
  const params = [];

  if (mine) {
    where.push('q.user_id = ?');
    params.push(userId);
  }

  if (search) {
    where.push('(q.title LIKE ? OR q.content LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await safeExecute(
    `SELECT
       q.question_id,
       q.question_hash,
       q.user_id,
       q.title,
       q.content,
       q.created_at,
       q.updated_at,
       u.first_name,
       u.last_name,
       COUNT(a.answer_id) AS answer_count
     FROM questions q
     INNER JOIN users u ON u.user_id = q.user_id
     LEFT JOIN answers a ON a.question_id = q.question_id
     ${whereSql}
     GROUP BY
       q.question_id,
       q.question_hash,
       q.user_id,
       q.title,
       q.content,
       q.created_at,
       q.updated_at,
       u.first_name,
       u.last_name
     ORDER BY q.created_at DESC
     LIMIT 100`,
    params,
  );

  return {
    questions: rows.map(mapQuestion),
    total: rows.length,
  };
};

/**
 * Loads mapped questions for a set of ids, preserving the given order.
 *
 * @param {number[]} questionIds - Question ids to hydrate.
 * @returns {Promise<Object[]>} Mapped questions in `questionIds` order.
 */
const getQuestionsByIds = async questionIds => {
  if (!questionIds.length) {
    return [];
  }

  const placeholders = questionIds.map(() => '?').join(', ');
  const rows = await safeExecute(
    `SELECT
       q.question_id,
       q.question_hash,
       q.user_id,
       q.title,
       q.content,
       q.created_at,
       q.updated_at,
       u.first_name,
       u.last_name,
       COUNT(a.answer_id) AS answer_count
     FROM questions q
     INNER JOIN users u ON u.user_id = q.user_id
     LEFT JOIN answers a ON a.question_id = q.question_id
     WHERE q.question_id IN (${placeholders})
     GROUP BY
       q.question_id,
       q.question_hash,
       q.user_id,
       q.title,
       q.content,
       q.created_at,
       q.updated_at,
       u.first_name,
       u.last_name`,
    questionIds,
  );

  const byId = new Map(rows.map(row => [row.question_id, mapQuestion(row)]));
  return questionIds.map(id => byId.get(id)).filter(Boolean);
};

/**
 * Embeds a small batch of pending/failed question vectors so older threads
 * become searchable without a separate backfill job.
 *
 * @returns {Promise<void>}
 */
const backfillPendingQuestionVectors = async () => {
  const pending = await safeExecute(
    `SELECT question_id, source_text
     FROM question_vectors
     WHERE status IN ('pending', 'failed')
     LIMIT ?`,
    [VECTOR_BACKFILL_LIMIT],
  );

  for (const row of pending) {
    const sourceText = String(row.source_text || '').trim();
    if (!sourceText) {
      continue;
    }

    try {
      const embedding = await generateEmbedding(
        sourceText,
        'RETRIEVAL_DOCUMENT',
      );
      await safeExecute(
        `UPDATE question_vectors
         SET embedding = ?, status = 'ready'
         WHERE question_id = ?`,
        [JSON.stringify(embedding), row.question_id],
      );
    } catch {
      await safeExecute(
        `UPDATE question_vectors SET status = 'failed' WHERE question_id = ?`,
        [row.question_id],
      );
    }
  }
};

/**
 * Semantic search: embed the query, rank ready question vectors, hydrate rows.
 *
 * @param {Object} payload - Search options.
 * @param {string} payload.query - Natural-language search text.
 * @param {number} [payload.k] - Maximum number of results.
 * @param {number} [payload.threshold] - Minimum cosine similarity.
 * @returns {Promise<{questions: Object[], meta: Object}>} Ranked matches and meta.
 */
export const searchQuestionsSemanticService = async ({
  query,
  k,
  threshold,
}) => {
  const limit = Number.isInteger(k) && k > 0 ? k : Number(process.env.RECOMMEND_K) || 5;
  const minScore =
    typeof threshold === 'number'
      ? threshold
      : Number(process.env.RECOMMEND_THRESHOLD) || 0.75;

  await backfillPendingQuestionVectors();

  const queryVector = await generateEmbedding(query, 'RETRIEVAL_QUERY');
  const matches = await rankReadyQuestionVectors(queryVector, limit, {
    threshold: minScore,
  });

  const questions = await getQuestionsByIds(
    matches.map(match => match.questionId),
  );
  const scoreById = new Map(
    matches.map(match => [match.questionId, match.score]),
  );

  return {
    questions: questions.map(question => ({
      ...question,
      score: Number((scoreById.get(question.id) || 0).toFixed(6)),
    })),
    meta: {
      total: questions.length,
      k: limit,
      threshold: minScore,
      query,
      questionHash: null,
    },
  };
};

/**
 * Recommends other questions similar to the one identified by hash.
 *
 * @param {Object} payload - Lookup options.
 * @param {string} payload.questionHash - The source question hash.
 * @param {number} [payload.k] - Maximum number of results.
 * @param {number} [payload.threshold] - Minimum cosine similarity.
 * @returns {Promise<{questions: Object[], meta: Object}>} Ranked similar questions.
 * @throws {NotFoundError} If the source question does not exist.
 */
export const getSimilarQuestionsService = async ({
  questionHash,
  k,
  threshold,
}) => {
  const limit = Number.isInteger(k) && k > 0 ? k : Number(process.env.RECOMMEND_K) || 5;
  const minScore =
    typeof threshold === 'number'
      ? threshold
      : Number(process.env.RECOMMEND_THRESHOLD) || 0.75;

  const rows = await safeExecute(
    `SELECT
       q.question_id,
       q.title,
       q.content,
       qv.embedding,
       qv.status
     FROM questions q
     LEFT JOIN question_vectors qv ON qv.question_id = q.question_id
     WHERE q.question_hash = ?
     LIMIT 1`,
    [questionHash],
  );

  if (!rows[0]) {
    throw new NotFoundError('Question not found.');
  }

  const source = rows[0];
  let sourceVector = parseEmbedding(source.embedding);

  if (source.status !== 'ready' || !sourceVector.length) {
    try {
      sourceVector = await generateEmbedding(
        `${source.title}\n\n${source.content}`,
        'RETRIEVAL_DOCUMENT',
      );
    } catch {
      return {
        questions: [],
        meta: {
          total: 0,
          k: limit,
          threshold: minScore,
          query: null,
          questionHash,
        },
      };
    }
  }

  const matches = await rankReadyQuestionVectors(sourceVector, limit, {
    threshold: minScore,
    excludeQuestionId: source.question_id,
  });

  const questions = await getQuestionsByIds(
    matches.map(match => match.questionId),
  );
  const scoreById = new Map(
    matches.map(match => [match.questionId, match.score]),
  );

  return {
    questions: questions.map(question => ({
      ...question,
      score: Number((scoreById.get(question.id) || 0).toFixed(6)),
    })),
    meta: {
      total: questions.length,
      k: limit,
      threshold: minScore,
      query: null,
      questionHash,
    },
  };
};

/**
 * Returns one question by hash, plus its answers.
 *
 * @param {Object} payload - The lookup data.
 * @param {string} payload.questionHash - The 16-character question hash.
 * @returns {Promise<{question: Object, answers: Object[]}>} The question and its answers.
 * @throws {NotFoundError} If the question does not exist.
 */
/**
 * Loads one question by public hash, plus its answers.
 *
 * @param {Object} args - Lookup options.
 * @param {string} args.questionHash - 16-character hex hash from the URL.
 * @returns {Promise<{question: object, answers: object[]}>} Thread payload; throws NotFoundError if missing.
 */
export const getSingleQuestionService = async ({ questionHash }) => {
  const questionRows = await safeExecute(
    `SELECT
       q.question_id,
       q.question_hash,
       q.user_id,
       q.title,
       q.content,
       q.created_at,
       q.updated_at,
       u.first_name,
       u.last_name,
       COUNT(a.answer_id) AS answer_count
     FROM questions q
     INNER JOIN users u ON u.user_id = q.user_id
     LEFT JOIN answers a ON a.question_id = q.question_id
     WHERE q.question_hash = ?
     GROUP BY
       q.question_id,
       q.question_hash,
       q.user_id,
       q.title,
       q.content,
       q.created_at,
       q.updated_at,
       u.first_name,
       u.last_name
     LIMIT 1`,
    [questionHash],
  );

  if (!questionRows[0]) {
    throw new NotFoundError('Question not found.');
  }

  const question = mapQuestion(questionRows[0]);

  const answerRows = await safeExecute(
    `SELECT
       a.answer_id,
       a.user_id,
       a.content,
       a.created_at,
       a.updated_at,
       u.first_name,
       u.last_name
     FROM answers a
     INNER JOIN users u ON u.user_id = a.user_id
     WHERE a.question_id = ?
     ORDER BY a.created_at ASC
     LIMIT 100`,
    [question.id],
  );

  return {
    question,
    answers: answerRows.map(mapAnswer),
  };
};

/**
 * Finds a question owner row by hash.
 *
 * @param {string} questionHash - The 16-character question hash.
 * @returns {Promise<Object|null>} The question row with user_id, or null.
 */
const getQuestionOwnerRow = async questionHash => {
  const rows = await safeExecute(
    'SELECT question_id, user_id FROM questions WHERE question_hash = ? LIMIT 1',
    [questionHash],
  );
  return rows[0] || null;
};

/**
 * Ensures the current user owns the question.
 *
 * @param {Object} questionRow - The question row from the database.
 * @param {number} questionRow.user_id - The question author's user ID.
 * @param {number} userId - The authenticated user's ID.
 * @returns {void}
 * @throws {ForbiddenError} If the user does not own the question.
 */
const assertQuestionOwner = (questionRow, userId) => {
  if (questionRow.user_id !== userId) {
    throw new ForbiddenError('You can only modify your own questions.');
  }
};

/**
 * Updates a question owned by the current user.
 *
 * @param {Object} payload - The update data.
 * @param {string} payload.questionHash - The question hash to update.
 * @param {number} payload.userId - The authenticated user's ID.
 * @param {string} payload.title - The updated title.
 * @param {string} payload.content - The updated question text.
 * @returns {Promise<Object>} The updated question object.
 * @throws {NotFoundError} If the question does not exist.
 * @throws {ForbiddenError} If the user does not own the question.
 */
export const updateQuestionService = async ({
  questionHash,
  userId,
  title,
  content,
}) => {
  const question = await getQuestionOwnerRow(questionHash);
  if (!question) {
    throw new NotFoundError('Question not found.');
  }

  assertQuestionOwner(question, userId);

  await safeExecute(
    'UPDATE questions SET title = ?, content = ? WHERE question_hash = ?',
    [title, content, questionHash],
  );

  const { question: updated } = await getSingleQuestionService({
    questionHash,
  });
  return updated;
};

/**
 * Deletes a question owned by the current user.
 *
 * @param {Object} payload - The delete data.
 * @param {string} payload.questionHash - The question hash to delete.
 * @param {number} payload.userId - The authenticated user's ID.
 * @returns {Promise<void>}
 * @throws {NotFoundError} If the question does not exist.
 * @throws {ForbiddenError} If the user does not own the question.
 */
export const deleteQuestionService = async ({ questionHash, userId }) => {
  const question = await getQuestionOwnerRow(questionHash);
  if (!question) {
    throw new NotFoundError('Question not found.');
  }

  assertQuestionOwner(question, userId);

  await safeExecute('DELETE FROM questions WHERE question_hash = ?', [
    questionHash,
  ]);
};
