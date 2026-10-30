import { validationResult } from 'express-validator';
import { BadRequestError } from '../utils/errors/index.js';

/**
 * Turns express-validator failures into a single `BadRequestError`.
 *
 * @param {import('express').Request} req - Request whose validation results are checked.
 * @param {import('express').Response} res - Unused; Express signature requires it.
 * @param {import('express').NextFunction} next - Called when there are no validation errors.
 * @returns {void}
 * @throws {BadRequestError} When any validator failed (messages joined with ". ").
 */
export const validationErrorHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    throw new BadRequestError(errorMessages.join('. '));
  }
  next();
};
