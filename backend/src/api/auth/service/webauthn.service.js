import crypto from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { safeExecute } from '../../../../db/config.js';
import {
  BadRequestError,
  NotFoundError,
  UnauthenticatedError,
} from '../../../utils/errors/index.js';
import { sendSignInCodeEmail } from '../../../utils/email/mailer.js';
import { signSessionToken } from './session-token.js';

const RP_NAME = 'Evangadi Forum';
const CODE_ATTEMPT_LIMIT = 5;

const rpID = () => process.env.WEBAUTHN_RP_ID?.trim() || 'localhost';

const expectedOrigin = () => {
  const configured = (
    process.env.WEBAUTHN_ORIGIN ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173'
  )
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return configured.length === 1 ? configured[0] : configured;
};

/**
 * @param {string | null} transports - Comma-separated authenticator transports.
 * @returns {string[] | undefined} Transport list for WebAuthn options.
 */
const parseTransports = transports => {
  if (!transports) {
    return undefined;
  }
  return transports.split(',').filter(Boolean);
};

/**
 * @param {number} userId - Account id.
 * @returns {Promise<Array<{ credential_id: string, public_key: Buffer, counter: number, transports: string | null, created_at: Date }>>} Stored device keys.
 */
const listCredentialRows = async userId =>
  safeExecute(
    `SELECT credential_id, public_key, counter, transports, created_at
     FROM webauthn_credentials
     WHERE user_id = ?
     ORDER BY created_at ASC`,
    [userId],
  );

/**
 * Whether this account must pass face unlock after the password.
 *
 * @param {number} userId - Account id.
 * @returns {Promise<boolean>} True when at least one device key is stored.
 */
export const userHasFaceUnlock = async userId => {
  const rows = await safeExecute(
    'SELECT credential_id FROM webauthn_credentials WHERE user_id = ? LIMIT 1',
    [userId],
  );
  return rows.length > 0;
};

/**
 * Devices the account can use at sign-in. Public keys stay off this list.
 *
 * @param {number} userId - Account id.
 * @returns {Promise<Array<{ id: string, createdAt: Date }>>} Enrolled devices.
 */
export const listFaceDevices = async userId => {
  const rows = await listCredentialRows(userId);
  return rows.map(row => ({
    id: row.credential_id,
    createdAt: row.created_at,
  }));
};

/**
 * @param {number} userId - Account id.
 * @param {string} challenge - Base64url challenge from WebAuthn options.
 * @param {'register' | 'login'} purpose - Which ceremony the challenge belongs to.
 * @returns {Promise<void>}
 */
const saveChallenge = async (userId, challenge, purpose) => {
  await safeExecute(
    'DELETE FROM webauthn_challenges WHERE user_id = ? AND purpose = ?',
    [userId, purpose],
  );
  await safeExecute(
    `INSERT INTO webauthn_challenges (user_id, challenge, purpose, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
    [userId, challenge, purpose],
  );
};

/**
 * Reads and deletes the latest unexpired challenge so it cannot be reused.
 *
 * @param {number} userId - Account id.
 * @param {'register' | 'login'} purpose - Which ceremony to consume.
 * @returns {Promise<string>} The expected challenge.
 * @throws {BadRequestError} When the challenge is missing or expired.
 */
const takeChallenge = async (userId, purpose) => {
  const rows = await safeExecute(
    `SELECT challenge_id, challenge
     FROM webauthn_challenges
     WHERE user_id = ? AND purpose = ? AND expires_at > NOW()
     ORDER BY challenge_id DESC
     LIMIT 1`,
    [userId, purpose],
  );

  if (rows.length === 0) {
    throw new BadRequestError('That check expired. Start it again.');
  }

  await safeExecute('DELETE FROM webauthn_challenges WHERE challenge_id = ?', [
    rows[0].challenge_id,
  ]);
  return rows[0].challenge;
};

/**
 * @param {number} userId - Account id.
 * @returns {Promise<{ email: string, firstName: string, lastName: string }>} Account names.
 * @throws {NotFoundError} When the account is gone.
 */
const loadAccount = async userId => {
  const rows = await safeExecute(
    'SELECT email, first_name, last_name FROM users WHERE user_id = ? LIMIT 1',
    [userId],
  );
  if (rows.length === 0) {
    throw new NotFoundError('Account not found.');
  }
  return {
    email: rows[0].email,
    firstName: rows[0].first_name,
    lastName: rows[0].last_name,
  };
};

/**
 * Options that ask this device to save a face-unlock key.
 *
 * @param {number} userId - Signed-in account id.
 * @returns {Promise<import('@simplewebauthn/server').PublicKeyCredentialCreationOptionsJSON>} Browser registration options.
 */
export const createRegistrationOptions = async userId => {
  const account = await loadAccount(userId);
  const existing = await listCredentialRows(userId);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(),
    userName: account.email,
    userDisplayName: `${account.firstName} ${account.lastName}`.trim(),
    userID: new TextEncoder().encode(String(userId)),
    attestationType: 'none',
    excludeCredentials: existing.map(row => ({
      id: row.credential_id,
      transports: parseTransports(row.transports),
    })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
    preferredAuthenticatorType: 'localDevice',
  });

  await saveChallenge(userId, options.challenge, 'register');
  return options;
};

/**
 * Stores the device public key after the face check succeeds.
 *
 * @param {number} userId - Signed-in account id.
 * @param {import('@simplewebauthn/server').RegistrationResponseJSON} response - Browser registration result.
 * @returns {Promise<Array<{ id: string, createdAt: Date }>>} Updated device list.
 * @throws {BadRequestError} When the device proof does not verify.
 */
export const verifyRegistration = async (userId, response) => {
  const expectedChallenge = await takeChallenge(userId, 'register');
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpID(),
      requireUserVerification: true,
    });
  } catch (error) {
    console.error('Face unlock enrollment failed', error?.message ?? '');
    throw new BadRequestError(
      'This device could not turn on face unlock. Try again.',
    );
  }

  if (!verification.verified || !verification.registrationInfo.userVerified) {
    throw new BadRequestError(
      'This device could not turn on face unlock. Try again.',
    );
  }

  const { credential } = verification.registrationInfo;
  const transports = credential.transports?.length
    ? credential.transports.join(',')
    : 'internal';

  try {
    await safeExecute(
      `INSERT INTO webauthn_credentials
         (credential_id, user_id, public_key, counter, transports)
       VALUES (?, ?, ?, ?, ?)`,
      [
        credential.id,
        userId,
        Buffer.from(credential.publicKey),
        credential.counter,
        transports,
      ],
    );
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw new BadRequestError('This device is already enrolled.');
    }
    throw error;
  }

  return listFaceDevices(userId);
};

/**
 * Options that ask an enrolled device to unlock with the saved face.
 *
 * @param {number} userId - Account that already passed the password check.
 * @returns {Promise<import('@simplewebauthn/server').PublicKeyCredentialRequestOptionsJSON>} Browser authentication options.
 * @throws {BadRequestError} When the account has no enrolled device.
 */
export const createLoginOptions = async userId => {
  const existing = await listCredentialRows(userId);
  if (existing.length === 0) {
    throw new BadRequestError('Face unlock is not turned on for this account.');
  }

  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    allowCredentials: existing.map(row => ({
      id: row.credential_id,
      transports: parseTransports(row.transports),
    })),
    userVerification: 'required',
  });

  await saveChallenge(userId, options.challenge, 'login');
  return options;
};

/**
 * Checks the device signature and returns a forum session token.
 *
 * @param {{ id: number, firstName: string, lastName: string, email: string }} pending - Pending sign-in payload.
 * @param {import('@simplewebauthn/server').AuthenticationResponseJSON} response - Browser authentication result.
 * @returns {Promise<{ user: { id: number, firstName: string, lastName: string, email: string }, token: string }>} Session.
 * @throws {UnauthenticatedError} When the face check or signature fails.
 */
export const verifyLogin = async (pending, response) => {
  const expectedChallenge = await takeChallenge(pending.id, 'login');
  const rows = await safeExecute(
    `SELECT credential_id, user_id, public_key, counter, transports
     FROM webauthn_credentials
     WHERE credential_id = ?
     LIMIT 1`,
    [response?.id ?? ''],
  );
  const credential = rows[0];

  if (!credential || credential.user_id !== pending.id) {
    throw new UnauthenticatedError(
      'This device is not enrolled for your account.',
    );
  }

  const publicKey = new Uint8Array(credential.public_key);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpID(),
      requireUserVerification: true,
      credential: {
        id: credential.credential_id,
        publicKey,
        counter: Number(credential.counter),
        transports: parseTransports(credential.transports),
      },
    });
  } catch (error) {
    console.error('Face unlock sign-in failed', error?.message ?? '');
    throw new UnauthenticatedError(
      'Face unlock could not be confirmed. Try again or use an email code.',
    );
  }

  if (!verification.verified || !verification.authenticationInfo.userVerified) {
    throw new UnauthenticatedError(
      'Face unlock could not be confirmed. Try again or use an email code.',
    );
  }

  await safeExecute(
    'UPDATE webauthn_credentials SET counter = ? WHERE credential_id = ?',
    [verification.authenticationInfo.newCounter, credential.credential_id],
  );

  return sessionFor(pending);
};

/**
 * Removes one enrolled device. The account returns to password-only sign-in
 * when no devices remain.
 *
 * @param {number} userId - Signed-in account id.
 * @param {string} credentialId - Device credential id.
 * @returns {Promise<Array<{ id: string, createdAt: Date }>>} Remaining devices.
 * @throws {NotFoundError} When that device is not on the account.
 */
export const removeFaceDevice = async (userId, credentialId) => {
  const result = await safeExecute(
    'DELETE FROM webauthn_credentials WHERE credential_id = ? AND user_id = ?',
    [credentialId, userId],
  );
  if (!result.affectedRows) {
    throw new NotFoundError('That device is not enrolled.');
  }
  return listFaceDevices(userId);
};

/**
 * Emails a 6-digit backup code after the password has already been accepted.
 *
 * @param {{ id: number, firstName: string, email: string }} pending - Pending sign-in payload.
 * @returns {Promise<void>}
 */
export const sendLoginEmailCode = async pending => {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');

  await safeExecute(
    'UPDATE login_email_codes SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [pending.id],
  );
  await safeExecute(
    `INSERT INTO login_email_codes (user_id, code_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [pending.id, codeHash],
  );

  await sendSignInCodeEmail({
    email: pending.email,
    firstName: pending.firstName,
    code,
  });
};

/**
 * Accepts the emailed code and returns a forum session token.
 *
 * @param {{ id: number, firstName: string, lastName: string, email: string }} pending - Pending sign-in payload.
 * @param {string} code - Six digits from the email.
 * @returns {Promise<{ user: { id: number, firstName: string, lastName: string, email: string }, token: string }>} Session.
 * @throws {BadRequestError} When the code is expired or tried too many times.
 * @throws {UnauthenticatedError} When the code does not match.
 */
export const verifyLoginEmailCode = async (pending, code) => {
  const normalized = String(code ?? '').trim();
  if (!/^\d{6}$/.test(normalized)) {
    throw new BadRequestError('Enter the 6-digit code from the email.');
  }

  const rows = await safeExecute(
    `SELECT code_id, code_hash, attempts
     FROM login_email_codes
     WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY code_id DESC
     LIMIT 1`,
    [pending.id],
  );
  if (rows.length === 0) {
    throw new BadRequestError('That code expired. Send a new one.');
  }

  const row = rows[0];
  if (row.attempts >= CODE_ATTEMPT_LIMIT) {
    await safeExecute(
      'UPDATE login_email_codes SET used_at = NOW() WHERE code_id = ?',
      [row.code_id],
    );
    throw new BadRequestError('Too many attempts. Send a new code.');
  }

  const codeHash = crypto.createHash('sha256').update(normalized).digest('hex');
  if (codeHash !== row.code_hash) {
    await safeExecute(
      'UPDATE login_email_codes SET attempts = attempts + 1 WHERE code_id = ?',
      [row.code_id],
    );
    throw new UnauthenticatedError('That code does not match.');
  }

  await safeExecute(
    'UPDATE login_email_codes SET used_at = NOW() WHERE code_id = ?',
    [row.code_id],
  );
  return sessionFor(pending);
};

/**
 * @param {{ id: number, firstName: string, lastName: string, email: string }} pending - Account that finished the second step.
 * @returns {{ user: { id: number, firstName: string, lastName: string, email: string }, token: string }} Forum session.
 */
const sessionFor = pending => ({
  user: {
    id: pending.id,
    firstName: pending.firstName,
    lastName: pending.lastName,
    email: pending.email,
  },
  token: signSessionToken(pending),
});
