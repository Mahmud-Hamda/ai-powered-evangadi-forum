/**
 * Shared JSDoc types for the forum backend.
 * Import with `@typedef {import('../types/api.js').AuthJwtUser} AuthJwtUser`.
 *
 * @module apiTypes
 */

/**
 * User fields attached to `req.user` after JWT authentication.
 *
 * @typedef {Object} AuthJwtUser
 * @property {number} id - Database user id from the token.
 * @property {string} firstName - Given name from the token.
 * @property {string} lastName - Family name from the token.
 */

/**
 * Authenticated Express request (`req.user` is set by authenticateUser).
 *
 * @typedef {import('express').Request & { user: AuthJwtUser }} AuthedRequest
 */

/**
 * Question row returned from question services.
 *
 * @typedef {Object} QuestionRow
 * @property {number} id
 * @property {string} questionHash
 * @property {string} title
 * @property {string} content
 * @property {number} userId
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/**
 * Answer row returned from answer services.
 *
 * @typedef {Object} AnswerRow
 * @property {number} id
 * @property {number} questionId
 * @property {number} userId
 * @property {string} content
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

export {};
