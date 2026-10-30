/**
 * After the password, the new account picks one method for later sign-in.
 * Face and fingerprint store a device key. Email records the inbox as the method.
 */
import { useRef, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { authService } from '../../services/auth/auth.service';
import { confirmLiveFace } from './liveFace';
import SignInMethodIcons from './SignInMethodIcons';
import styles from './Auth.module.css';

/**
 * @param {Object} props - Setup inputs.
 * @param {() => void} props.onDone - Called after one method is saved.
 * @returns {JSX.Element} Choice of face, fingerprint, or email.
 */
export default function FaceSetup({ onDone }) {
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const videoRef = useRef(null);

  /**
   * Stores this device's public key on the new account.
   *
   * @returns {Promise<void>}
   */
  const storeDevice = async () => {
    const options = await authService.faceEnrollOptions();
    const attestation = await startRegistration({ optionsJSON: options });
    await authService.verifyFaceEnroll(attestation);
    onDone();
  };

  /**
   * Confirms a face is in view, then stores the device key.
   *
   * @returns {Promise<void>}
   */
  const saveFace = async () => {
    setError(null);
    setStatus('');
    setBusy(true);
    setWatching(true);
    await new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    try {
      await confirmLiveFace(videoRef.current, { onStatus: setStatus });
      setStatus('Saving this sign-in method...');
      await storeDevice();
    } catch (err) {
      const covered = /covered/i.test(err?.message || '');
      setStatus('');
      setError(
        covered
          ? 'Please remove anything that blocks your camera.'
          : err?.name === 'NotAllowedError'
            ? 'That check was cancelled. Choose a method to continue.'
            : err.message || 'Face could not be saved. Try again.',
      );
    } finally {
      setWatching(false);
      setBusy(false);
    }
  };

  /**
   * Asks Windows for a fingerprint and stores the device key.
   *
   * @returns {Promise<void>}
   */
  const saveFingerprint = async () => {
    setError(null);
    setStatus('Waiting for your fingerprint...');
    setBusy(true);
    try {
      await storeDevice();
    } catch (err) {
      setStatus('');
      setError(
        err?.name === 'NotAllowedError'
          ? 'That check was cancelled. Choose a method to continue.'
          : err.message || 'Fingerprint could not be saved. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * Records the account email as the method used on the next sign-in.
   *
   * @returns {Promise<void>}
   */
  const saveEmail = async () => {
    setError(null);
    setStatus('');
    setBusy(true);
    try {
      await authService.enableEmailSignIn();
      onDone();
    } catch (err) {
      setError(err.message || 'Email could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.auth__form}>
      <video
        ref={videoRef}
        className={watching ? styles.auth__camera : styles['auth__camera--idle']}
        autoPlay
        muted
        playsInline
      />
      <div
        className={styles.auth__setupDialog}
        role='dialog'
        aria-labelledby='signin-options-title'
      >
        <h2 id='signin-options-title' className={styles.auth__setupTitle}>
          Sign-in options
        </h2>
        <p className={styles.auth__setupText}>
          {watching
            ? status || 'Looking for your face...'
            : status ||
              'Choose one method. You will use it the next time you sign in.'}
        </p>
        <SignInMethodIcons
          disabled={busy}
          lead='fingerprint'
          onFingerprint={saveFingerprint}
          onFace={saveFace}
          onEmail={saveEmail}
          fingerprintLabel='Use fingerprint the next time you sign in'
          faceLabel='Use face the next time you sign in'
          emailLabel='Use email the next time you sign in'
        />
      </div>
      {error && <div className={styles.auth__error}>{error}</div>}
    </div>
  );
}
