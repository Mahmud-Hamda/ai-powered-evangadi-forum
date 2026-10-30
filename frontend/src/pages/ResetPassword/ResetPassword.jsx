/**
 * ResetPassword: sets a new password from the token in the emailed link.
 */
import { useEffect, useState } from 'react';

import { motion as Motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/auth/auth.service';
import styles from '../Auth/Auth.module.css';

/** Minimum password length required by the API. */
const PASSWORD_MIN = 6;

/**
 * Completes password reset using `:token` from the URL.
 * The link is checked before the form is shown.
 *
 * @returns {JSX.Element} Checking, invalid-link, or the new-password form.
 */
export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [linkState, setLinkState] = useState('checking');

  useEffect(() => {
    let active = true;

    authService
      .verifyResetToken(token)
      .then(valid => {
        if (active) {
          setLinkState(valid ? 'valid' : 'invalid');
        }
      })
      .catch(() => {
        if (active) {
          setLinkState('invalid');
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  /**
   * Saves the new password when the token is still valid.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} e - Form submit event.
   * @returns {Promise<void>} Redirects to `/auth` after a short success pause.
   */
  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);

    if (password.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters long.`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword({ token, password });
      setSuccessMessage('Password updated. Redirecting to sign in...');
      setPassword('');
      setConfirmPassword('');
      await new Promise(resolve => setTimeout(resolve, 1500));
      navigate('/auth', { replace: true });
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.auth}>
      <section className={styles.auth__formSection}>
        <div className={styles.auth__formContainer}>
          <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className={styles.auth__formHeader}>
              <h2 className={styles.auth__formTitle}>Choose a new password</h2>
              <p className={styles.auth__formSubtitle}>
                {linkState === 'invalid'
                  ? 'This link cannot be used anymore.'
                  : 'Pick a password you have not used on this account before.'}
              </p>
            </div>

            {linkState === 'checking' && (
              <p className={styles.auth__formSubtitle}>Checking your link...</p>
            )}

            {linkState === 'invalid' && (
              <div className={styles.auth__error}>
                This reset link is invalid or has expired. Request a new one to
                try again.
              </div>
            )}

            {linkState === 'valid' && (
              <form className={styles.auth__form} onSubmit={handleSubmit}>
                <div className={styles.auth__inputGroup}>
                  <label htmlFor='password' className={styles.auth__label}>
                    New Password
                  </label>
                  <div className={styles.auth__passwordWrap}>
                    <input
                      id='password'
                      type={showPassword ? 'text' : 'password'}
                      placeholder='••••••••'
                      className={`${styles.auth__input} ${styles.auth__inputPassword}`}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button
                      type='button'
                      className={styles.auth__passwordToggle}
                      onClick={() => setShowPassword(isVisible => !isVisible)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <EyeOff size={18} aria-hidden />
                      ) : (
                        <Eye size={18} aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                <div className={styles.auth__inputGroup}>
                  <label
                    htmlFor='confirmPassword'
                    className={styles.auth__label}
                  >
                    Confirm New Password
                  </label>
                  <input
                    id='confirmPassword'
                    type={showPassword ? 'text' : 'password'}
                    placeholder='••••••••'
                    className={styles.auth__input}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>

                {successMessage && (
                  <div className={styles.auth__success}>{successMessage}</div>
                )}

                {error && <div className={styles.auth__error}>{error}</div>}

                <div className={styles.auth__buttonContainer}>
                  <button
                    type='submit'
                    className={`${styles.auth__button} ${styles['auth__button--primary']}`}
                    disabled={loading}
                  >
                    {loading ? 'Updating...' : 'Update password'}
                    {!loading && (
                      <ArrowRight
                        size={16}
                        className={styles.auth__buttonIcon}
                      />
                    )}
                  </button>
                </div>
              </form>
            )}

            <footer className={styles.auth__formFooter}>
              <p className={styles.auth__formFooterText}>
                {linkState === 'invalid'
                  ? 'Need another link?'
                  : 'Changed your mind?'}
                <Link
                  to={linkState === 'invalid' ? '/forgot-password' : '/auth'}
                  className={styles.auth__formFooterLink}
                >
                  {linkState === 'invalid'
                    ? 'Request a new link'
                    : 'Back to sign in'}
                </Link>
              </p>
            </footer>
          </Motion.div>
        </div>
      </section>
    </div>
  );
}
