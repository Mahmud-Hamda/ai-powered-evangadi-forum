import { StatusCodes } from 'http-status-codes';

/**
 * Last Express error middleware. Maps known errors to `{ msg }` JSON.
 *
 * @param {Error & { statusCode?: number, code?: string }} err - Thrown error (often a CustomAPIError).
 * @param {import('express').Request} req - Unused; Express error-middleware signature.
 * @param {import('express').Response} res - Sends `{ msg: string }` with the mapped status.
 * @param {import('express').NextFunction} next - Unused; required by Express.
 * @returns {import('express').Response} The JSON error response.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let msg = err.message || 'Something went wrong. Try again later.';

  if (err?.code === 'ER_DUP_ENTRY') {
    statusCode = StatusCodes.BAD_REQUEST;
    msg = 'Duplicate value entered for a unique field';
  }

  if (statusCode >= StatusCodes.INTERNAL_SERVER_ERROR) {
    console.error('Request failed', err?.message ?? '');
    msg = 'Something went wrong. Try again later.';
  }

  return res.status(statusCode).json({ msg });
};
