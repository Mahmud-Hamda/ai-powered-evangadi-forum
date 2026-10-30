import { apiClient } from '../core/api.client.js';

/**
 * @typedef {import('../../types/forum.js').AuthUser} AuthUser
 * @typedef {import('../../types/forum.js').RegisterPayload} RegisterPayload
 * @typedef {import('../../types/forum.js').LoginPayload} LoginPayload
 */

/**
 * Registers a new user (POST /api/auth/register).
 *
 * @param {RegisterPayload} userData - First name, last name, email, password.
 * @returns {Promise<{user: AuthUser}>} The created user (no session token).
 * @throws {Error} When registration fails.
 */
async function register(userData) {
  try {
    const response = await apiClient.post('/api/auth/register', userData);
    return { user: response.data.user };
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Logs in and stores the JWT plus user JSON in localStorage.
 *
 * @param {LoginPayload} credentials - Email and password.
 * @returns {Promise<{user: AuthUser, token: string}>} Session user and JWT.
 * @throws {Error} When login fails.
 */
async function login(credentials) {
  try {
    const response = await apiClient.post('/api/auth/login', credentials);

    if (response.data.secondFactor) {
      return {
        secondFactor: true,
        pendingToken: response.data.pendingToken,
        email: response.data.email,
        hasDevice: response.data.hasDevice,
      };
    }

    return storeSession(response.data);
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Saves a completed sign-in in localStorage.
 *
 * @param {{ user: AuthUser, token: string }} session - API session payload.
 * @returns {{ user: AuthUser, token: string }} The same session.
 */
function storeSession(session) {
  const { user, token } = session;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  return { user, token };
}

/**
 * @param {string} pendingToken - Token from a password check that still needs face unlock.
 * @returns {{ headers: { Authorization: string } }} Axios auth header.
 */
function pendingHeaders(pendingToken) {
  return { headers: { Authorization: `Bearer ${pendingToken}` } };
}

/**
 * Asks the server for the face-unlock prompt used at sign-in.
 *
 * @param {string} pendingToken - Token from the password step.
 * @returns {Promise<Object>} Options for `startAuthentication`.
 */
async function faceUnlockOptions(pendingToken) {
  try {
    const response = await apiClient.post(
      '/api/auth/webauthn/login/options',
      {},
      pendingHeaders(pendingToken),
    );
    return response.data.options;
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Finishes sign-in after the device accepts the face check.
 *
 * @param {string} pendingToken - Token from the password step.
 * @param {Object} assertion - Result from `startAuthentication`.
 * @returns {Promise<{ user: AuthUser, token: string }>} Stored session.
 */
async function verifyFaceUnlock(pendingToken, assertion) {
  try {
    const response = await apiClient.post(
      '/api/auth/webauthn/login/verify',
      { response: assertion },
      pendingHeaders(pendingToken),
    );
    return storeSession(response.data);
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Emails a backup sign-in code to the address that passed the password check.
 *
 * @param {string} pendingToken - Token from the password step.
 * @returns {Promise<{ message: string }>} Confirmation from the server.
 */
async function sendSignInCode(pendingToken) {
  try {
    const response = await apiClient.post(
      '/api/auth/webauthn/email-code',
      {},
      pendingHeaders(pendingToken),
    );
    return { message: response.data.message };
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Finishes sign-in with the emailed 6-digit code.
 *
 * @param {string} pendingToken - Token from the password step.
 * @param {string} code - Six digits from the email.
 * @returns {Promise<{ user: AuthUser, token: string }>} Stored session.
 */
async function verifySignInCode(pendingToken, code) {
  try {
    const response = await apiClient.post(
      '/api/auth/webauthn/email-code/verify',
      { code },
      pendingHeaders(pendingToken),
    );
    return storeSession(response.data);
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * @returns {Promise<Object>} Options for `startRegistration`.
 */
async function faceEnrollOptions() {
  try {
    const response = await apiClient.post(
      '/api/auth/webauthn/register/options',
      {},
    );
    return response.data.options;
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Stores this device after face unlock succeeds.
 *
 * @param {Object} attestation - Result from `startRegistration`.
 * @returns {Promise<Array<{ id: string, createdAt: string }>>} Updated device list.
 */
async function verifyFaceEnroll(attestation) {
  try {
    const response = await apiClient.post('/api/auth/webauthn/register/verify', {
      response: attestation,
    });
    return response.data.credentials;
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Records email as the method used after the password on later sign-ins.
 *
 * @returns {Promise<void>}
 */
async function enableEmailSignIn() {
  try {
    await apiClient.post('/api/auth/email-signin', {});
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Requests a password reset email (POST /api/auth/forgot-password).
 * The API succeeds whether or not the account exists.
 *
 * @param {string} email - The email address to reset.
 * @returns {Promise<{message: string}>} Confirmation message from the server.
 * @throws {Error} When the request fails.
 */
async function forgotPassword(email) {
  try {
    const response = await apiClient.post('/api/auth/forgot-password', {
      email,
    });
    return { message: response.data.message };
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Checks whether a reset link is still usable.
 *
 * @param {string} token - The reset token from the email link.
 * @returns {Promise<boolean>} True when the token can still be used.
 * @throws {Error} When the check fails.
 */
async function verifyResetToken(token) {
  try {
    const response = await apiClient.get(`/api/auth/reset-password/${token}`);
    return response.data.data.valid;
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Sets a new password using a reset token (POST /api/auth/reset-password).
 *
 * @param {Object} payload - The reset data.
 * @param {string} payload.token - The reset token from the email link.
 * @param {string} payload.password - The new password.
 * @returns {Promise<{message: string}>} Confirmation message from the server.
 * @throws {Error} When the token is invalid or the request fails.
 */
async function resetPassword({ token, password }) {
  try {
    const response = await apiClient.post('/api/auth/reset-password', {
      token,
      password,
    });
    return { message: response.data.message };
  } catch (error) {
    throw handleAuthError(error);
  }
}

/**
 * Clears the JWT and stored user from localStorage.
 *
 * @returns {void}
 */
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

/**
 * Reads the stored JWT, or null when signed out.
 *
 * @returns {string|null} The Bearer token value, without the "Bearer " prefix.
 */
function getStoredToken() {
  return localStorage.getItem('token');
}

/**
 * Reads the stored user object from localStorage.
 *
 * @returns {AuthUser|null} Parsed user, or null if missing/invalid JSON.
 */
function getStoredUser() {
  const userJson = localStorage.getItem('user');
  if (!userJson) return null;

  try {
    return JSON.parse(userJson);
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

/**
 * Whether a JWT is present in localStorage.
 *
 * @returns {boolean} True when a token string exists.
 */
function isAuthenticated() {
  return !!getStoredToken();
}

/**
 * Maps axios/auth failures to an Error the UI can display.
 *
 * @param {import('axios').AxiosError<{msg?: string, message?: string}> | Error} error - The caught request error.
 * @returns {Error} Always an Error instance (never a raw axios object).
 */
function handleAuthError(error) {
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return new Error('Request timed out. Please try again.');
    }
    return new Error(
      'Unable to connect to server. Please check your internet connection.',
    );
  }

  const status = error.response.status;
  const backendMessage =
    error.response.data?.msg || error.response.data?.message;

  switch (status) {
    case 400:
      return new Error(backendMessage || 'Invalid input data.');
    case 401:
      return new Error(backendMessage || 'Invalid email or password');
    case 409:
      return new Error(
        backendMessage || 'User already exists with this email.',
      );
    case 500:
      return new Error(
        'Something went wrong on our end. Please try again later.',
      );
    default:
      return new Error(backendMessage || 'An unexpected error occurred.');
  }
}

/**
 * Auth HTTP helpers used by AuthContext and password pages.
 */
export const authService = {
  register,
  login,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  logout,
  getStoredToken,
  getStoredUser,
  isAuthenticated,
  faceUnlockOptions,
  verifyFaceUnlock,
  sendSignInCode,
  verifySignInCode,
  faceEnrollOptions,
  verifyFaceEnroll,
  enableEmailSignIn,
};
