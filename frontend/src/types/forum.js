/**
 * Shared JSDoc types for the forum frontend.
 * Import a name with:
 * `@typedef {import('../types/forum.js').ForumQuestion} ForumQuestion`
 * then hover shows the property list, not a blank `{Object}`.
 *
 * @module forumTypes
 */

/**
 * Signed-in user stored in auth context and localStorage.
 *
 * @typedef {Object} AuthUser
 * @property {number} id - Database user id.
 * @property {string} firstName - Given name.
 * @property {string} lastName - Family name.
 * @property {string} email - Login email.
 * @property {string} [avatar] - Optional avatar URL.
 */

/**
 * Registration payload sent to POST /api/auth/register.
 *
 * @typedef {Object} RegisterPayload
 * @property {string} firstName - Given name (min 3 characters).
 * @property {string} lastName - Family name (min 3 characters).
 * @property {string} email - Login email.
 * @property {string} password - Plain password (min 6 characters).
 */

/**
 * Login payload sent to POST /api/auth/login.
 *
 * @typedef {Object} LoginPayload
 * @property {string} email - Login email.
 * @property {string} password - Plain password.
 */

/**
 * Author nested on a question or answer from the API.
 *
 * @typedef {Object} ForumAuthor
 * @property {number} [id] - Author user id.
 * @property {string} [firstName] - Given name.
 * @property {string} [lastName] - Family name.
 * @property {string} [email] - Author email when the API includes it.
 */

/**
 * A question row from the questions API.
 *
 * @typedef {Object} ForumQuestion
 * @property {number} id - Numeric question id.
 * @property {string} questionHash - Public 16-character hash used in URLs.
 * @property {string} title - Question title.
 * @property {string} content - Question body (markdown).
 * @property {string} [createdAt] - ISO created timestamp.
 * @property {string} [updatedAt] - ISO updated timestamp.
 * @property {number} [answerCount] - Number of answers when listing.
 * @property {ForumAuthor} [author] - Nested author.
 * @property {number} [userId] - Owner user id.
 * @property {number} [score] - Cosine similarity when returned from AI search.
 */

/**
 * An answer row from the answers API.
 *
 * @typedef {Object} ForumAnswer
 * @property {number} id - Numeric answer id.
 * @property {number} [questionId] - Parent question id.
 * @property {string} content - Answer body (markdown).
 * @property {string} [createdAt] - ISO created timestamp.
 * @property {string} [updatedAt] - ISO updated timestamp.
 * @property {ForumAuthor} [author] - Nested author.
 */

/**
 * Payload from GET /api/questions/:questionHash.
 *
 * @typedef {Object} QuestionDetailPayload
 * @property {boolean} [success] - Whether the request succeeded.
 * @property {string} [message] - Server status message.
 * @property {ForumQuestion} question - The thread question.
 * @property {ForumAnswer[]} answers - Answers on the thread.
 * @property {{limit: number, total: number}} [answersMeta] - Answer list metadata.
 */

/**
 * Title and body for creating or coaching a question.
 *
 * @typedef {Object} QuestionFormData
 * @property {string} title - Question title.
 * @property {string} content - Question details.
 */

/**
 * Per-field validation messages on the ask form.
 *
 * @typedef {Object} FieldErrors
 * @property {string|null} title - Title error, or null when valid.
 * @property {string|null} content - Details error, or null when valid.
 */

/**
 * AI draft-coach response.
 *
 * @typedef {Object} DraftCoachFeedback
 * @property {string[]} tips - Suggestions for the draft.
 */

/**
 * AI answer-fit result from POST /api/questions/:hash/answer-fit.
 *
 * @typedef {Object} AnswerFitResult
 * @property {string} level - Fit level label (for example "strong" or "weak").
 * @property {string} note - Explanation of the score.
 */

/**
 * Filters for GET /api/questions.
 *
 * @typedef {Object} QuestionListOptions
 * @property {string} [search] - Keyword search.
 * @property {boolean} [mine] - When true, only the current user's questions.
 */

/**
 * A private PDF in the Knowledge Base.
 *
 * @typedef {Object} RagDocument
 * @property {number} documentId - Numeric document id.
 * @property {string} title - Original file name.
 * @property {string} [mimeType] - MIME type, usually application/pdf.
 * @property {number} [byteSize] - File size in bytes.
 * @property {string} status - `ready`, `processing`, `pending`, or `failed`.
 * @property {string|null} [errorMessage] - Indexing error when status is failed.
 * @property {string} [createdAt] - ISO created timestamp.
 * @property {string} [updatedAt] - ISO updated timestamp.
 */

/**
 * One ranked excerpt from semantic search.
 *
 * @typedef {Object} RagSearchHit
 * @property {number} [chunkId] - Chunk id.
 * @property {number} [chunkIndex] - Order of the chunk in the PDF.
 * @property {number} score - Cosine similarity.
 * @property {string} excerpt - Matching passage.
 */

/**
 * Ask AI payload for one document.
 *
 * @typedef {Object} RagQueryResult
 * @property {string} answer - Model answer grounded in retrieved chunks.
 * @property {Array<{ref: number, chunkIndex: number}>} [citations] - Source refs.
 * @property {number[]} [chunksUsed] - Chunk ids used as context.
 */

/**
 * Value provided by AuthProvider / useAuth().
 *
 * @typedef {Object} AuthContextValue
 * @property {AuthUser|null} user - Logged-in user, or null when signed out.
 * @property {boolean} loading - True while the session is restoring from localStorage.
 * @property {(userData: RegisterPayload) => Promise<{success: boolean, user: AuthUser}>} register - Creates an account; does not sign in.
 * @property {(credentials: LoginPayload) => Promise<{success: boolean, user: AuthUser} | {secondFactor: boolean, pendingToken: string, email: string}>} login - Signs in, or pauses for face unlock.
 * @property {(session: {user: AuthUser}) => void} completeLogin - Stores a session after the second step.
 * @property {(reason?: 'idle') => void} logout - Clears the session and goes to /auth. The tab stays open.
 * @property {boolean} isAuthenticated - True when `user` is set.
 */

export {};
