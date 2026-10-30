import jwt from 'jsonwebtoken';
import { UnauthenticatedError } from '../utils/errors/index.js';

/**
 * @typedef {import('../types/api.js').AuthJwtUser} AuthJwtUser
 */

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Reads `Authorization: Bearer <jwt>` and sets `req.user` to `{ id, firstName, lastName }`.
 *
 * @param {import('express').Request} req - Incoming request; `req.user` is set on success.
 * @param {import('express').Response} res - Unused; Express signature requires it.
 * @param {import('express').NextFunction} next - Called when the token is valid.
 * @returns {void}
 * @throws {UnauthenticatedError} When the header is missing or the token is invalid.
 */
export const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthenticatedError('Authentication invalid');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.purpose === '2fa') {
      throw new UnauthenticatedError('Authentication invalid');
    }
    req.user = {
      id: payload.id,
      firstName: payload.firstName,
      lastName: payload.lastName,
    };
    next();
  } catch (error) {
    throw new UnauthenticatedError('Authentication invalid');
  }
};
