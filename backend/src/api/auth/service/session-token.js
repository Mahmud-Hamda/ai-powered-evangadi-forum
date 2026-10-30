import jwt from 'jsonwebtoken';
import { UnauthenticatedError } from '../../../utils/errors/index.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Session token accepted by the forum API.
 *
 * @param {{ id: number, firstName: string, lastName: string }} user - Public user fields.
 * @returns {string} Signed JWT.
 */
export const signSessionToken = ({ id, firstName, lastName }) =>
  jwt.sign(
    { id, firstName, lastName, purpose: 'session' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

/**
 * Short-lived token that only allows the face-unlock or email-code step.
 * It is not a forum session.
 *
 * @param {{ id: number, firstName: string, lastName: string, email: string }} user - Account that passed the password check.
 * @returns {string} Signed JWT that expires in five minutes.
 */
export const signPendingToken = ({ id, firstName, lastName, email }) =>
  jwt.sign(
    { id, firstName, lastName, email, purpose: '2fa' },
    JWT_SECRET,
    { expiresIn: '5m' },
  );

/**
 * Reads a pending sign-in token.
 *
 * @param {string} token - Bearer token from the face-unlock step.
 * @returns {{ id: number, firstName: string, lastName: string, email: string, purpose: string }} Payload.
 * @throws {UnauthenticatedError} When the token is missing, expired, or not a pending sign-in.
 */
export const readPendingToken = token => {
  if (!token) {
    throw new UnauthenticatedError(
      'Sign in again. The face-unlock step expired.',
    );
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.purpose !== '2fa' || !payload.id || !payload.email) {
      throw new Error('Not a pending sign-in');
    }
    return payload;
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      throw error;
    }
    throw new UnauthenticatedError(
      'Sign in again. The face-unlock step expired.',
    );
  }
};
