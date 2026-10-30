/**
 * Fingerprint, face, and email as icon buttons.
 * The row is the only control; each button names its method for assistive tech.
 */
import { FingerprintPattern, Mail, ScanFace } from 'lucide-react';
import styles from './Auth.module.css';

/**
 * @param {Object} props - Icon actions.
 * @param {boolean} props.disabled - Disables the row while a check is running.
 * @param {boolean} [props.emailDisabled] - Disables only the email icon.
 * @param {'face' | 'fingerprint'} [props.lead] - Face leads at sign-in. Fingerprint leads when the account is created.
 * @param {string} [props.faceLabel] - Accessible name for the face icon.
 * @param {string} [props.fingerprintLabel] - Accessible name for the fingerprint icon.
 * @param {string} [props.emailLabel] - Accessible name for the email icon.
 * @param {() => void} props.onFace - Starts the camera check.
 * @param {() => void} props.onFingerprint - Starts the fingerprint check.
 * @param {() => void} props.onEmail - Starts the email check.
 * @returns {JSX.Element} The three icons.
 */
export default function SignInMethodIcons({
  disabled,
  emailDisabled = false,
  lead = 'face',
  faceLabel = 'Use face',
  fingerprintLabel = 'Use fingerprint',
  emailLabel = 'Use email',
  onFace,
  onFingerprint,
  onEmail,
}) {
  const face = (
    <button
      key='face'
      type='button'
      className={styles.auth__optionIcon}
      onClick={onFace}
      disabled={disabled}
      aria-label={faceLabel}
      title='Face'
    >
      <ScanFace size={28} />
    </button>
  );
  const fingerprint = (
    <button
      key='fingerprint'
      type='button'
      className={styles.auth__optionIcon}
      onClick={onFingerprint}
      disabled={disabled}
      aria-label={fingerprintLabel}
      title='Fingerprint'
    >
      <FingerprintPattern size={28} />
    </button>
  );
  const email = (
    <button
      key='email'
      type='button'
      className={styles.auth__optionIcon}
      onClick={onEmail}
      disabled={disabled || emailDisabled}
      aria-label={emailLabel}
      title='Email'
    >
      <Mail size={28} />
    </button>
  );

  const icons =
    lead === 'fingerprint' ? [fingerprint, face, email] : [face, fingerprint, email];

  return <div className={styles.auth__optionIcons}>{icons}</div>;
}
