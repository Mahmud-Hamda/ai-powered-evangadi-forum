/**
 * Outgoing email through EmailJS.
 *
 * The private key stays in the backend environment. The Forgot Password page
 * never sees the reset token; this module is what puts it in the email.
 *
 * EmailJS template fields:
 * - To Email: {{to_email}}
 * - Subject: {{subject}}
 * - Body may use {{first_name}}, {{reset_url}}, {{link}}, {{expires_in_minutes}}, and {{message}}
 */

import emailjs from '@emailjs/nodejs';
import { ServiceUnavailableError } from '../errors/index.js';

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(
  /\/$/,
  '',
);

/**
 * Reads the EmailJS settings required to send from this server.
 *
 * @returns {{ serviceId: string, templateId: string, publicKey: string, privateKey: string }}
 * @throws {ServiceUnavailableError} When any required setting is missing.
 */
const readEmailJsConfig = () => {
  const settings = {
    EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID?.trim() ?? '',
    EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID?.trim() ?? '',
    EMAILJS_PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY?.trim() ?? '',
    EMAILJS_PRIVATE_KEY: process.env.EMAILJS_PRIVATE_KEY?.trim() ?? '',
  };
  const missing = Object.entries(settings)
    .filter(([, value]) => value.length === 0)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new ServiceUnavailableError(
      'Password reset email is not configured.',
    );
  }

  return {
    serviceId: settings.EMAILJS_SERVICE_ID,
    templateId: settings.EMAILJS_TEMPLATE_ID,
    publicKey: settings.EMAILJS_PUBLIC_KEY,
    privateKey: settings.EMAILJS_PRIVATE_KEY,
  };
};

/**
 * Sends one message through the EmailJS template.
 *
 * @param {Object} message - The message to send.
 * @param {string} message.to - The recipient email address.
 * @param {string} message.subject - The subject line.
 * @param {string} message.text - The plain text body.
 * @param {Object} [message.templateParams] - Extra template variables.
 * @returns {Promise<void>}
 * @throws {ServiceUnavailableError} When EmailJS is not configured or the send fails.
 */
const deliverEmail = async ({ to, subject, text, templateParams = {} }) => {
  const { serviceId, templateId, publicKey, privateKey } = readEmailJsConfig();

  try {
    await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: to,
        subject,
        message: text,
        ...templateParams,
      },
      {
        publicKey,
        privateKey,
      },
    );
  } catch (error) {
    console.error(
      'EmailJS reset email failed',
      error?.status ?? '',
      error?.text ?? error?.message ?? '',
    );
    throw new ServiceUnavailableError(
      'The email could not be sent. Please try again later.',
    );
  }
};

/**
 * Emails a password reset link containing the single-use token.
 *
 * @param {Object} payload - The email inputs.
 * @param {string} payload.email - The recipient email address.
 * @param {string} payload.firstName - The recipient's first name.
 * @param {string} payload.token - The plain reset token (never stored).
 * @param {number} payload.expiresInMinutes - Minutes until the link expires.
 * @returns {Promise<void>}
 */
export const sendPasswordResetEmail = async ({
  email,
  firstName,
  token,
  expiresInMinutes,
}) => {
  const resetUrl = `${FRONTEND_URL}/reset-password/${token}`;

  await deliverEmail({
    to: email,
    subject: 'Reset your Evangadi Forum password',
    text: [
      `Hi ${firstName},`,
      '',
      'Use the link below to choose a new password:',
      resetUrl,
      '',
      `This link expires in ${expiresInMinutes} minutes and can only be used once.`,
      'If you did not request a reset, you can ignore this email.',
    ].join('\n'),
    templateParams: {
      first_name: firstName,
      reset_url: resetUrl,
      link: resetUrl,
      expires_in_minutes: String(expiresInMinutes),
    },
  });
};

/**
 * Emails a 6-digit sign-in code. The template shows `{{link}}`, so the
 * code sentence is placed there as well as in `{{message}}`.
 *
 * @param {Object} payload - The email inputs.
 * @param {string} payload.email - The recipient email address.
 * @param {string} payload.firstName - The recipient's first name.
 * @param {string} payload.code - The six-digit code. Never stored in plain text.
 * @returns {Promise<void>}
 */
export const sendSignInCodeEmail = async ({ email, firstName, code }) => {
  const text = [
    `Hi ${firstName},`,
    '',
    `Your sign-in code is ${code}.`,
    'It expires in 10 minutes and can only be used once.',
    'If you did not try to sign in, you can ignore this email.',
  ].join('\n');

  await deliverEmail({
    to: email,
    subject: 'Your Evangadi Forum sign-in code',
    text,
    templateParams: {
      first_name: firstName,
      link: `Your sign-in code is ${code}`,
      reset_url: `Your sign-in code is ${code}`,
      expires_in_minutes: '10',
    },
  });
};
