import { StatusCodes } from 'http-status-codes';
import {
  registerService,
  loginService,
  forgotPasswordService,
  resetPasswordService,
  verifyResetTokenService,
  enableEmailSignInService,
} from '../service/auth.service.js';

/**
 * Handles user registration requests.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>} Sends 201 `{ success, message, user }`.
 */
export const registerController = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const newUser = await registerService({
      firstName,
      lastName,
      email,
      password,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'User registered successfully.',
      user: newUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles user login requests.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>} Sends 200 `{ success, message, user, token }`.
 */
export const loginController = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const authResult = await loginService({ email, password });

    if (authResult.secondFactor) {
      res.status(StatusCodes.OK).json({
        success: true,
        secondFactor: true,
        pendingToken: authResult.pendingToken,
        email: authResult.email,
        hasDevice: authResult.hasDevice,
      });
      return;
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Login successful.',
      user: authResult.user,
      token: authResult.token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles password reset requests by emailing a reset link.
 *
 * Always answers the same way so the response cannot reveal whether an
 * account exists for the submitted address.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>} Sends 200 `{ success, message }` (always, to avoid email enumeration).
 */
export const forgotPasswordController = async (req, res, next) => {
  try {
    const { email } = req.body;

    await forgotPasswordService({ email });

    res.status(StatusCodes.OK).json({
      success: true,
      message:
        'If an account exists for that email, a reset link is on its way.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reports whether a reset link is still usable, so the form can say so early.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {string} req.params.token - The reset token from the email link.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
export const verifyResetTokenController = async (req, res, next) => {
  try {
    const valid = await verifyResetTokenService({ token: req.params.token });

    res.status(StatusCodes.OK).json({
      success: true,
      message: valid ? 'Reset link is valid.' : 'Reset link is not valid.',
      data: { valid },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sets a new password for the holder of a valid reset token.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {string} req.body.token - The reset token from the email link.
 * @param {string} req.body.password - The new password.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 * @returns {Promise<void>}
 */
export const resetPasswordController = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    await resetPasswordService({ token, password });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Password updated successfully. Please sign in.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Records email as the method this account will use after the password.
 *
 * @param {import('express').Request} req - Signed-in request.
 * @param {import('express').Response} res - Confirmation.
 * @param {import('express').NextFunction} next - Error forwarder.
 * @returns {Promise<void>}
 */
export const enableEmailSignInController = async (req, res, next) => {
  try {
    await enableEmailSignInService(req.user.id);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Email can be used the next time you sign in.',
    });
  } catch (error) {
    next(error);
  }
};
