import { safeExecute } from '../../../../db/config.js';
import {
  NotFoundError,
  ServiceUnavailableError,
} from '../../../utils/errors/index.js';
import {
  GEMINI_TEXT_MODEL,
  getGeminiClient,
} from '../../../utils/gemini/gemini.js';

const FIT_LEVELS = new Set(['strong', 'partial', 'weak']);

/**
 * Builds the rubric prompt for scoring a draft against a question.
 *
 * @param {Object} payload - The prompt inputs.
 * @param {string} payload.questionTitle - The question title.
 * @param {string} payload.questionContent - The question body.
 * @param {string} payload.answerDraft - The unpublished answer draft.
 * @returns {string} The full prompt sent to Gemini.
 */
const buildAnswerFitPrompt = ({
  questionTitle,
  questionContent,
  answerDraft,
}) => `You are a programming-forum coach.
Judge how well DRAFT addresses QUESTION.
Do not write a full solution. Do not invent APIs.
Ignore minor typos unless they hide meaning.
This is relevance only, not grading correctness.

Levels:
- strong: answers the asked problem with enough steps or code
- partial: on-topic but missing the core issue or a key step
- weak: off-topic, too vague, or does not answer the question

Return ONLY JSON with this shape:
{"level":"strong"|"partial"|"weak","note":"1-3 sentences"}

QUESTION TITLE:
${questionTitle}

QUESTION BODY:
${questionContent}

DRAFT ANSWER:
${answerDraft}`;

/**
 * Parses JSON from a model string, including fenced markdown.
 *
 * @param {string} rawText - The raw model output.
 * @returns {Object} The parsed object.
 * @throws {ServiceUnavailableError} If the output is not valid JSON.
 */
const parseJsonFromModelText = rawText => {
  const trimmed = String(rawText ?? '').trim();
  if (!trimmed) {
    throw new ServiceUnavailableError('Answer fit could not be assessed.');
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = (fenced?.[1] ?? trimmed).trim();

  try {
    return JSON.parse(jsonText);
  } catch {
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(jsonText.slice(firstBrace, lastBrace + 1));
    }
    throw new ServiceUnavailableError('Answer fit could not be assessed.');
  }
};

/**
 * Normalizes Gemini output into { level, note }.
 *
 * @param {string} rawText - The raw model output.
 * @returns {{level: string, note: string}} The fit result.
 * @throws {ServiceUnavailableError} If level is missing or invalid.
 */
const parseFitResult = rawText => {
  let parsed;
  try {
    parsed = parseJsonFromModelText(rawText);
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }
    throw new ServiceUnavailableError('Answer fit could not be assessed.');
  }

  const level = String(parsed?.level ?? '').toLowerCase();
  const note = String(parsed?.note ?? '').trim();
  if (!FIT_LEVELS.has(level) || !note) {
    throw new ServiceUnavailableError('Answer fit could not be assessed.');
  }

  return {
    level,
    note,
  };
};

/**
 * Asks Gemini how well a draft answer addresses a question.
 *
 * @param {Object} payload - The texts to compare.
 * @param {string} payload.questionTitle - The question title.
 * @param {string} payload.questionContent - The question body.
 * @param {string} payload.answerDraft - The unpublished answer draft.
 * @returns {Promise<{level: string, note: string}>} Fit level and coach note.
 * @throws {ServiceUnavailableError} If Gemini is not configured or fails.
 */
export const assessAnswerFit = async ({
  questionTitle,
  questionContent,
  answerDraft,
}) => {
  const client = getGeminiClient(
    'Answer fit is unavailable. GEMINI_API_KEY is not configured.',
  );

  let response;
  try {
    response = await client.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: buildAnswerFitPrompt({
        questionTitle,
        questionContent,
        answerDraft,
      }),
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });
  } catch {
    throw new ServiceUnavailableError(
      'Answer fit is unavailable. Please try again later.',
    );
  }

  return parseFitResult(response?.text);
};

/**
 * Loads a question by hash, then scores a draft against it with Gemini.
 *
 * @param {Object} payload - The assessment data.
 * @param {string} payload.questionHash - The 16-character question hash.
 * @param {string} payload.answerDraft - The unpublished answer draft.
 * @returns {Promise<{level: string, note: string}>} Fit level and coach note.
 * @throws {NotFoundError} If the question does not exist.
 * @throws {ServiceUnavailableError} If Gemini is not configured or fails.
 */
export const assessAnswerAgainstQuestionService = async ({
  questionHash,
  answerDraft,
}) => {
  const rows = await safeExecute(
    'SELECT title, content FROM questions WHERE question_hash = ? LIMIT 1',
    [questionHash],
  );

  if (!rows[0]) {
    throw new NotFoundError('Question not found.');
  }

  return assessAnswerFit({
    questionTitle: rows[0].title,
    questionContent: rows[0].content,
    answerDraft,
  });
};

/**
 * Builds the prompt that asks Gemini for question-draft tips.
 *
 * @param {Object} payload - The draft to review.
 * @param {string} [payload.title] - Optional question title.
 * @param {string} payload.content - The question body.
 * @returns {string} The prompt sent to Gemini.
 */
const buildDraftCoachPrompt = ({ title, content }) => `You are a programming-forum coach.
Review this unpublished question draft for clarity, formatting, and completeness.
Do not write a full solution. Do not invent APIs. Do not grade homework.

QUESTION TITLE:
${title || '(none)'}

QUESTION BODY (markdown allowed):
${content}

Reply with ONLY valid JSON, exactly this shape:
{"feedback":"...","suggestions":["...","..."]}

Rules:
- feedback: 1-2 sentences on overall clarity and whether a peer could reproduce the problem.
- suggestions: array of 3 to 5 short strings (each under 120 characters).
- Cover missing context (error message, expected vs actual), formatting (code blocks), and a sharper title if needed.
- Give constructive checklist-style tips only.`;

/**
 * Asks Gemini for short tips on a question draft before it is posted.
 *
 * @param {Object} payload - The draft to review.
 * @param {string} [payload.title] - Optional question title.
 * @param {string} payload.content - The question body.
 * @returns {Promise<{feedback: string, suggestions: string[], tips: string[]}>} Coach note and tips.
 * @throws {ServiceUnavailableError} If Gemini is not configured or fails.
 */
export const generateQuestionDraftCoachService = async ({ title, content }) => {
  const client = getGeminiClient(
    'Draft coaching is unavailable. GEMINI_API_KEY is not configured.',
  );

  let response;
  try {
    response = await client.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: buildDraftCoachPrompt({ title, content }),
      config: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    });
  } catch {
    throw new ServiceUnavailableError(
      'Draft coaching is unavailable. Please try again later.',
    );
  }

  let parsed;
  try {
    parsed = parseJsonFromModelText(response?.text);
  } catch {
    parsed = {};
  }

  const rawTips = Array.isArray(parsed?.suggestions)
    ? parsed.suggestions
    : Array.isArray(parsed?.tips)
      ? parsed.tips
      : [];

  let tips = rawTips
    .filter(tip => typeof tip === 'string' && tip.trim())
    .map(tip => tip.trim())
    .slice(0, 5);

  if (tips.length === 0) {
    tips = [
      'Add any error messages or exact behavior you see.',
      'Say what you already tried and what you expected instead.',
    ];
  }

  const feedback = String(parsed?.feedback ?? '').trim();

  return {
    feedback:
      feedback ||
      'Review the suggestions below before posting so peers can reproduce the issue.',
    suggestions: tips,
    tips,
  };
};

/**
 * Alias required by TEAM_TASKS for the draft-coach Gemini helper.
 *
 * @param {Object} payload - The draft to review.
 * @param {string} [payload.title] - Optional question title.
 * @param {string} payload.content - The question body.
 * @returns {Promise<{feedback: string, suggestions: string[], tips: string[]}>} Coach note and tips.
 */
export const coachQuestionDraft = generateQuestionDraftCoachService;
