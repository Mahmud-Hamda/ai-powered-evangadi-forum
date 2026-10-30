import { GoogleGenAI } from '@google/genai';
import { ServiceUnavailableError } from '../errors/index.js';

const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const TEXT_MODELS = [
  process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
].filter((model, index, models) => models.indexOf(model) === index);
export const GEMINI_TEXT_MODEL = TEXT_MODELS[0];

let geminiClient;

/**
 * Returns a Gemini client, creating it on first use.
 *
 * @param {string} [missingKeyMessage] - Error shown when GEMINI_API_KEY is missing.
 * @returns {GoogleGenAI} The shared Gemini client.
 * @throws {ServiceUnavailableError} If GEMINI_API_KEY is missing.
 */
export const getGeminiClient = (
  missingKeyMessage = 'Gemini is unavailable. GEMINI_API_KEY is not configured.',
) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ServiceUnavailableError(missingKeyMessage);
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }

  return geminiClient;
};

/**
 * Calls Gemini text generation, then retries with the next model if the call fails.
 *
 * @param {GoogleGenAI} client - The shared Gemini client.
 * @param {Object} request - `generateContent` options, without `model`.
 * @returns {Promise<Object>} The first successful model response.
 */
export const generateTextContent = async (client, request) => {
  let lastError;
  for (const model of TEXT_MODELS) {
    try {
      return await client.models.generateContent({ ...request, model });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

/**
 * Reads numeric embedding values from a Gemini embedContent response.
 *
 * @param {Object} response - The SDK response.
 * @returns {number[]} The embedding vector.
 */
const extractEmbeddingValues = response => {
  const fromList = response?.embeddings?.[0]?.values;
  if (Array.isArray(fromList) && fromList.length) {
    return fromList.map(Number);
  }

  const single = response?.embedding?.values;
  if (Array.isArray(single) && single.length) {
    return single.map(Number);
  }

  return [];
};

/**
 * Turns text into a Gemini embedding vector.
 *
 * @param {string} text - Source text to embed.
 * @param {string} [taskType='RETRIEVAL_DOCUMENT'] - Gemini embedding task type.
 * @returns {Promise<number[]>} The embedding values.
 * @throws {ServiceUnavailableError} If Gemini is not configured or fails.
 */
export const generateEmbedding = async (
  text,
  taskType = 'RETRIEVAL_DOCUMENT',
) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new ServiceUnavailableError(
      'Semantic search is unavailable. Please try again later.',
    );
  }

  const client = getGeminiClient(
    'Semantic search is unavailable. GEMINI_API_KEY is not configured.',
  );

  try {
    const response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: trimmed,
      config: { taskType },
    });

    const values = extractEmbeddingValues(response);
    if (!values.length) {
      throw new Error('empty embedding');
    }

    return values;
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    throw new ServiceUnavailableError(
      'Semantic search is unavailable. Please try again later.',
    );
  }
};

/**
 * Writes an answer grounded only in the retrieved chunks.
 *
 * @param {Object} payload - The question and the passages to use.
 * @param {string} payload.question - The user's question.
 * @param {string|string[]} payload.context - One chunk or the top matches.
 * @returns {Promise<string>} The generated answer text.
 * @throws {ServiceUnavailableError} If Gemini is not configured or fails.
 */
export const generateAnswer = async ({ question, context }) => {
  const contextChunks = (Array.isArray(context) ? context : [context]).filter(
    Boolean,
  );
  const contextBlock = contextChunks
    .map((chunk, index) => `[${index + 1}] ${chunk}`)
    .join('\n\n');

  const prompt = `You are a friendly Evangadi assistant.
Your role is to help users find accurate information from the organization's knowledge base.

Answer the user's question using ONLY the retrieved context below.

Rules:
- Be warm, approachable, and conversational — like a helpful front-desk assistant.
- Ground every fact in the numbered passages. Do not use outside knowledge.
- If the context does not fully answer the question:
  - Say so politely in your own words (do not use a fixed phrase).
  - Gently steer the user back: suggest 1–2 related topics you can help with, based on the retrieved passages.
  - Invite them to ask about Evangadi — courses, programs, team, location, and similar topics.
  - Never invent facts to fill the gap.
- If the context is partial, share what is supported and kindly note what is unavailable.
- If passages conflict, note the conflict and prefer the most specific passage.
- Keep answers short, clear, and easy to read.
- Do not invent names, dates, numbers, or policies.

Retrieved context:
${contextBlock}

User question: ${question}

Answer:`;

  const client = getGeminiClient(
    'The assistant is unavailable. GEMINI_API_KEY is not configured.',
  );

  try {
    const result = await generateTextContent(client, { contents: prompt });
    const text = String(result.text || '').trim();
    if (!text) {
      throw new Error('empty answer');
    }

    return text;
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    throw new ServiceUnavailableError(
      'The assistant is unavailable. Please try again later.',
    );
  }
};
