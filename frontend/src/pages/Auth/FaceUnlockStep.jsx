/**
 * Second sign-in step: this device's face unlock, or an emailed code.
 */
import { useRef, useState } from 'react';
import { Mail, ScanFace } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { authService } from '../../services/auth/auth.service';
import { confirmLiveFace } from './liveFace';
import SignInMethodIcons from './SignInMethodIcons';
import styles from './Auth.module.css';

/**
 * Turns a cancelled or unsupported face check into a short sentence.
 *
 * @param {Error & { name?: string, code?: string }} error - Browser or API error.
 * @returns {string} Message for the form.
 */
const faceUnlockMessage = error => {
  const name = error?.name || '';
  const code = String(error?.code || '');
  if (name === 'NotAllowedError' || code.includes('ABORT') || code.includes('CANCEL')) {
    return 'That check was cancelled. Try your face, your fingerprint, or an email code.';
  }
  if (name === 'NotSupportedError' || name === 'SecurityError') {
    return 'This browser cannot use face unlock here. Use an email code instead.';
  }
  return error?.message || 'Face unlock could not be completed.';
};

/**
 * @param {Object} props - Step inputs.
 * @param {string} props.email - Address that passed the password check.
 * @param {boolean} [props.hasDevice] - False when only email was chosen at signup.
 * @param {string} props.pendingToken - Short-lived token for this step only.
 * @param {(session: { user: Object, token: string }) => void} props.onSuccess - Called with the forum session.
 * @param {() => void} props.onBack - Returns to the password form.
 * @returns {JSX.Element} Face unlock and email-code controls.
 */
export default function FaceUnlockStep({
  email,
  pendingToken,
  hasDevice = true,
  onSuccess,
  onBack,
}) {
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [mode, setMode] = useState(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(!hasDevice);
  const videoRef = useRef(null);

  /**
   * Finishes sign-in with the key saved on this device.
   * Windows Hello asks for the face or the fingerprint it already has.
   *
   * @returns {Promise<void>}
   */
  const finishWithDevice = async () => {
    const options = await authService.faceUnlockOptions(pendingToken);
    const assertion = await startAuthentication({ optionsJSON: options });
    const session = await authService.verifyFaceUnlock(pendingToken, assertion);
    onSuccess(session);
  };

  /**
   * Requires a visible face, then asks this device to confirm it.
   *
   * @returns {Promise<void>}
   */
  const useFace = async () => {
    setError(null);
    setStatus('');
    setOptionsOpen(false);
    setMode('face');
    setBusy(true);
    setWatching(true);
    await new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    try {
      await confirmLiveFace(videoRef.current, { onStatus: setStatus });
      setStatus('Face seen. Confirming this device...');
      await finishWithDevice();
    } catch (err) {
      const covered = /covered/i.test(err?.message || '');
      setOptionsOpen(false);
      if (covered) {
        setStatus('');
        setError(null);
      } else {
        setStatus('');
        setError(faceUnlockMessage(err));
      }
    } finally {
      setWatching(false);
      setBusy(false);
      setMode(null);
    }
  };

  /**
   * Asks Windows Hello for the fingerprint saved on this device.
   * The camera is not required for this path.
   *
   * @returns {Promise<void>}
   */
  const useFingerprint = async () => {
    setError(null);
    setStatus('Waiting for your fingerprint...');
    setMode('finger');
    setBusy(true);
    setWatching(false);
    try {
      await finishWithDevice();
    } catch (err) {
      setStatus('');
      setError(faceUnlockMessage(err));
    } finally {
      setBusy(false);
      setMode(null);
    }
  };

  /**
   * Sends the backup code to the same address used for the password.
   *
   * @returns {Promise<void>}
   */
  const emailCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await authService.sendSignInCode(pendingToken);
      setCodeSent(true);
    } catch (err) {
      setError(err.message || 'The code could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * @param {import('react').FormEvent<HTMLFormElement>} event - Code form submit.
   * @returns {Promise<void>}
   */
  const submitCode = async event => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await authService.verifySignInCode(pendingToken, code);
      onSuccess(session);
    } catch (err) {
      setError(err.message || 'That code could not be checked.');
    } finally {
      setBusy(false);
    }
  };

  const prompt = watching
    ? status || 'Looking at the camera...'
    : 'Please remove anything that blocks your camera.';

  return (
    <div className={styles.auth__form}>
      <video
        ref={videoRef}
        className={
          watching ? styles.auth__camera : styles['auth__camera--idle']
        }
        autoPlay
        muted
        playsInline
      />

      {optionsOpen ? (
        <div className={styles.auth__hello}>
          <p className={styles.auth__helloTitle}>Sign-in options</p>
          <SignInMethodIcons
            disabled={busy}
            emailDisabled={codeSent}
            onFace={useFace}
            onFingerprint={useFingerprint}
            onEmail={emailCode}
            faceLabel='Use face unlock'
            fingerprintLabel='Use fingerprint'
            emailLabel='Email me a code'
          />
        </div>
      ) : (
        <div className={styles.auth__hello}>
          <button
            type='button'
            className={styles.auth__helloIcon}
            onClick={useFace}
            disabled={busy}
            aria-label='Use face unlock'
          >
            <ScanFace size={34} />
          </button>
          <p className={styles.auth__helloText}>{prompt}</p>
          <button
            type='button'
            className={styles.auth__signInOptions}
            onClick={() => setOptionsOpen(true)}
            disabled={busy}
          >
            Sign-in options
          </button>
        </div>
      )}

      {codeSent ? (
        <form className={styles.auth__form} onSubmit={submitCode}>
          <p className={styles.auth__formSubtitle}>
            A 6-digit code was sent to {email}. Open the message titled
            Reset your password. The code is the 6-digit number in that
            message. It expires in 10 minutes.
          </p>
          <div className={styles.auth__inputGroup}>
            <label htmlFor='signInCode' className={styles.auth__label}>
              Sign-in code
            </label>
            <input
              id='signInCode'
              inputMode='numeric'
              autoComplete='one-time-code'
              maxLength={6}
              className={styles.auth__input}
              value={code}
              onChange={event => setCode(event.target.value)}
            />
          </div>
          <div className={styles.auth__buttonContainer}>
            <button
              type='submit'
              className={`${styles.auth__button} ${styles['auth__button--primary']}`}
              disabled={busy || code.trim().length !== 6}
            >
              Confirm code
            </button>
          </div>
          <button
            type='button'
            className={`${styles.auth__button} ${styles['auth__button--social']}`}
            onClick={emailCode}
            disabled={busy}
          >
            <Mail size={18} aria-hidden />
            Send a new code
          </button>
        </form>
      ) : null}

      {error && <div className={styles.auth__error}>{error}</div>}

      <footer className={styles.auth__formFooter}>
        <p className={styles.auth__formFooterText}>
          Wrong account?
          <button
            type='button'
            onClick={onBack}
            className={styles.auth__formFooterLink}
          >
            Back to password
          </button>
        </p>
      </footer>
    </div>
  );
}
