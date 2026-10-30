import { StatusCodes } from 'http-status-codes';

/**
 * Base API error. Subclasses set `statusCode` for `errorHandler`.
 */
class CustomAPIError extends Error {
  /**
   * @param {string} message - Human-readable error shown as `{ msg }`.
   */
  constructor(message) {
    super(message);
  }
}

/**
 * 400 Bad Request.
 */
export class BadRequestError extends CustomAPIError {
  /**
   * @param {string} message - Validation or bad-input message.
   */
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.BAD_REQUEST; // 400
  }
}

/**
 * 404 Not Found.
 */
export class NotFoundError extends CustomAPIError {
  /**
   * @param {string} message - Missing-resource message.
   */
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.NOT_FOUND; // 404
  }
}

/**
 * 401 Unauthorized.
 */
export class UnauthenticatedError extends CustomAPIError {
  /**
   * @param {string} message - Missing/invalid token or login failure.
   */
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.UNAUTHORIZED; // 401
  }
}

/**
 * 403 Forbidden.
 */
export class ForbiddenError extends CustomAPIError {
  /**
   * @param {string} message - Authenticated but not allowed.
   */
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.FORBIDDEN; // 403
  }
}

/**
 * 503 Service Unavailable.
 */
export class ServiceUnavailableError extends CustomAPIError {
  /**
   * @param {string} message - Downstream/AI/database unavailable.
   */
  constructor(message) {
    super(message);
    this.statusCode = StatusCodes.SERVICE_UNAVAILABLE; // 503
  }
}

export default CustomAPIError;
