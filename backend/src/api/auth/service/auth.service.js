import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, safeExecute } from '../../../../db/config.js';
import {
  BadRequestError,
  UnauthenticatedError,
} from '../../../utils/errors/index.js';
import { sendPasswordResetEmail } from '../../../utils/email/mailer.js';
import { userHasFaceUnlock } from './webauthn.service.js';
import { signPendingToken, signSessionToken } from './session-token.js';

const PASSWORD_RESET_EXPIRES_MINUTES =
  Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES) || 30;

const normalizeEmail = email => email.trim().toLowerCase();

/**
 * Hashes a reset token so the database never holds the emailed value.
 *
 * @param {string} token - The plain reset token.
 * @returns {string} The SHA-256 hex digest.
 */
const hashResetToken = token =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Checks if a user exists by email.
 *
 * @param {string} email - The email to check.
 * @returns {Promise<boolean>} True if the user exists, false otherwise.
 */
export const checkUserExists = async email => {
  const normalizedEmail = normalizeEmail(email);
  const sql = 'SELECT user_id FROM users WHERE email = ? LIMIT 1';
  const rows = await safeExecute(sql, [normalizedEmail]);
  return rows.length > 0;
};

/**
 * Registers a new user in the database.
 *
 * @param {Object} userData - The user data.
 * @param {string} userData.firstName - The first name.
 * @param {string} userData.lastName - The last name.
 * @param {string} userData.email - The email address.
 * @param {string} userData.password - Plain password. Stored only as a bcrypt hash with a new salt.
 * @returns {Promise<Object>} The created user object (without password).
 */
export const registerService = async ({
  firstName,
  lastName,
  email,
  password,
}) => {
  const normalizedEmail = normalizeEmail(email);
  const userExists = await checkUserExists(normalizedEmail);
  if (userExists) {
    throw new BadRequestError('User already exists with this email.');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const sql =
    'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)';
  let result;
  try {
    result = await safeExecute(sql, [
      firstName,
      lastName,
      normalizedEmail,
      hashedPassword,
    ]);
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw new BadRequestError('User already exists with this email.');
    }
    throw error;
  }

  return {
    id: result.insertId,
    firstName,
    lastName,
    email: normalizedEmail,
  };
};

/**
 * Authenticates a user and generates a JWT token.
 *
 * @param {Object} credentials - The login credentials.
 * @param {string} credentials.email - The user's email.
 * @param {string} credentials.password - The user's plain text password.
 * @returns {Promise<Object>} An object containing the user and token.
 * @throws {UnauthenticatedError} If authentication fails.
 */
export const loginService = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const sql =
    'SELECT user_id, first_name, last_name, email, password_hash, email_signin FROM users WHERE email = ? LIMIT 1';
  const rows = await safeExecute(sql, [normalizedEmail]);

  if (rows.length === 0) {
    throw new UnauthenticatedError('Invalid email or password');
  }

  const user = rows[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    throw new UnauthenticatedError('Invalid email or password');
  }

  const publicUser = {
    id: user.user_id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
  };

  const hasDevice = await userHasFaceUnlock(user.user_id);
  if (hasDevice || Number(user.email_signin) === 1) {
    return {
      secondFactor: true,
      pendingToken: signPendingToken(publicUser),
      email: user.email,
      hasDevice,
    };
  }

  return {
    user: publicUser,
    token: signSessionToken(publicUser),
  };
};

/**
 * Issues a password reset token and emails the reset link.
 *
 * Resolves the same way for unknown emails so the endpoint cannot be used to
 * discover which addresses have accounts. A new request marks older unused
 * links used. Expiry uses the database clock so it matches later checks.
 *
 * @param {Object} payload - The request data.
 * @param {string} payload.email - The email address to reset.
 * @returns {Promise<void>}
 */
export const forgotPasswordService = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
  const rows = await safeExecute(
    'SELECT user_id, first_name, email FROM users WHERE email = ? LIMIT 1',
    [normalizedEmail],
  );

  const user = rows[0];
  if (!user) {
    return;
  }

  await safeExecute(
    'UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [user.user_id],
  );

  const token = crypto.randomBytes(32).toString('hex');

  await safeExecute(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
    [user.user_id, hashResetToken(token), PASSWORD_RESET_EXPIRES_MINUTES],
  );

  await sendPasswordResetEmail({
    email: user.email,
    firstName: user.first_name,
    token,
    expiresInMinutes: PASSWORD_RESET_EXPIRES_MINUTES,
  });
};

/**
 * Reports whether a reset token is still usable.
 *
 * @param {Object} payload - The request data.
 * @param {string} payload.token - The plain reset token from the email link.
 * @returns {Promise<boolean>} True when the token is unused and unexpired.
 */
export const verifyResetTokenService = async ({ token }) => {
  const rows = await safeExecute(
    'SELECT reset_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1',
    [hashResetToken(token)],
  );

  return rows.length > 0;
};

/**
 * Sets a new password for the user who owns a valid reset token.
 * The password update and the token use commit in one transaction.
 *
 * @param {Object} payload - The request data.
 * @param {string} payload.token - The plain reset token from the email link.
 * @param {string} payload.password - The new plain text password.
 * @returns {Promise<void>}
 * @throws {BadRequestError} If the token is unknown, used, or expired.
 */
export const resetPasswordService = async ({ token, password }) => {
  const rows = await safeExecute(
    'SELECT reset_id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1',
    [hashResetToken(token)],
  );

  const resetRow = rows[0];
  if (!resetRow) {
    throw new BadRequestError('This reset link is invalid or has expired.');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'UPDATE users SET password_hash = ? WHERE user_id = ?',
      [hashedPassword, resetRow.user_id],
    );
    await connection.execute(
      'UPDATE password_resets SET used_at = NOW() WHERE reset_id = ?',
      [resetRow.reset_id],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Marks email codes as this account's sign-in method.
 *
 * @param {number} userId - Signed-in account id.
 * @returns {Promise<void>}
 */
export const enableEmailSignInService = async userId => {
  await safeExecute('UPDATE users SET email_signin = 1 WHERE user_id = ?', [
    userId,
  ]);
};
