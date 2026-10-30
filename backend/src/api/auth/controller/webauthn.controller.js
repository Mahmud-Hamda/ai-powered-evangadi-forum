import { StatusCodes } from 'http-status-codes';
import { BadRequestError } from '../../../utils/errors/index.js';
import { readPendingToken } from '../service/session-token.js';
import {
  createLoginOptions,
  createRegistrationOptions,
  listFaceDevices,
  removeFaceDevice,
  sendLoginEmailCode,
  verifyLogin,
  verifyLoginEmailCode,
  verifyRegistration,
} from '../service/webauthn.service.js';

/**
 * Allows only the five-minute token issued after a correct password.
 *
 * @param {import('express').Request} req - Request whose Authorization bearer is a pending sign-in.
 * @param {import('express').Response} res - Unused.
 * @param {import('express').NextFunction} next - Called with `req.pendingLogin` set.
 * @returns {void}
 * @throws {UnauthenticatedError} When the pending sign-in is missing or expired.
 */
export const requirePendingLogin = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  req.pendingLogin = readPendingToken(token);
  next();
};

/**
 * @param {import('express').Request} req - Signed-in request.
 * @param {import('express').Response} res - Device list.
 * @param {import('express').NextFunction} next - Error forwarder.
 * @returns {Promise<void>}
 */
export const listFaceDevicesController = async (req, res, next) => {
  try {
    const credentials = await listFaceDevices(req.user.id);
    res.status(StatusCodes.OK).json({ success: true, credentials });
  } catch (error) {
    next(error);
  }
};

/**
 * @param {import('express').Request} req - Signed-in request.
 * @param {import('express').Response} res - Registration options for the browser.
 * @param {import('express').NextFunction} next - Error forwarder.
 * @returns {Promise<void>}
 */
export const registrationOptionsController = async (req, res, next) => {
  try {
    const options = await createRegistrationOptions(req.user.id);
    res.status(StatusCodes.OK).json({ success: true, options });
  } catch (error) {
    next(error);
  }
};

/**
 * @param {import('express').Request} req - Body `response` is the browser registration result.
 * @param {import('express').Response} res - Updated device list.
 * @param {import('express').NextFunction} next - Error forwarder.
 * @returns {Promise<void>}
 */
export const verifyRegistrationController = async (req, res, next) => {
  try {
    if (!req.body?.response || typeof req.body.response !== 'object') {
      throw new BadRequestError('Face unlock did not return a result.');
    }
    const credentials = await verifyRegistration(req.user.id, req.body.response);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Face unlock is on for this device.',
      credentials,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @param {import('express').Request} req - Pending sign-in.
 * @param {import('express').Response} res - Authentication options for the browser.
 * @param {import('express').NextFunction} next - Error forwarder.
 * @returns {Promise<void>}
 */
export const loginOptionsController = async (req, res, next) => {
  try {
    const options = await createLoginOptions(req.pendingLogin.id);
    res.status(StatusCodes.OK).json({ success: true, options });
  } catch (error) {
    next(error);
  }
};

/**
 * @param {import('express').Request} req - Body `response` is the browser authentication result.
 * @param {import('express').Response} res - Forum session.
 * @param {import('express').NextFunction} next - Error forwarder.
 * @returns {Promise<void>}
 */
export const verifyLoginController = async (req, res, next) => {
  try {
    if (!req.body?.response || typeof req.body.response !== 'object') {
      throw new BadRequestError('Face unlock did not return a result.');
    }
    const session = await verifyLogin(req.pendingLogin, req.body.response);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Login successful.',
      user: session.user,
      token: session.token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @param {import('express').Request} req - Credential id in the path.
 * @param {import('express').Response} res - Remaining devices.
 * @param {import('express').NextFunction} next - Error forwarder.
 * @returns {Promise<void>}
 */
export const removeFaceDeviceController = async (req, res, next) => {
  try {
    const credentials = await removeFaceDevice(
      req.user.id,
      req.params.credentialId,
    );
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Face unlock was removed from that device.',
      credentials,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @param {import('express').Request} req - Pending sign-in.
 * @param {import('express').Response} res - Confirmation that the code was emailed.
 * @param {import('express').NextFunction} next - Error forwarder.
 * @returns {Promise<void>}
 */
export const sendLoginEmailCodeController = async (req, res, next) => {
  try {
    await sendLoginEmailCode(req.pendingLogin);
    res.status(StatusCodes.OK).json({
      success: true,
      message: `A sign-in code was sent to ${req.pendingLogin.email}.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @param {import('express').Request} req - Body `code` is the six-digit email code.
 * @param {import('express').Response} res - Forum session.
 * @param {import('express').NextFunction} next - Error forwarder.
 * @returns {Promise<void>}
 */
export const verifyLoginEmailCodeController = async (req, res, next) => {
  try {
    const session = await verifyLoginEmailCode(
      req.pendingLogin,
      req.body?.code,
    );
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Login successful.',
      user: session.user,
      token: session.token,
    });
  } catch (error) {
    next(error);
  }
};
