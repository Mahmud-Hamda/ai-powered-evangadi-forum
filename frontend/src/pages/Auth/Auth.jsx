/**
 * Auth page at `/auth`. The orange column introduces the forum.
 * The form signs in, creates an account, or continues with the saved sign-in method.
 */
import { useEffect, useState } from 'react';

import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Sparkles,
  Code,
  ArrowRight,
  Eye,
  EyeOff,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import FaceUnlockStep from './FaceUnlockStep';
import FaceSetup from './FaceSetup';
import { questionOnlyPath, takeAuthReturnTo } from '../../lib/utils.js';
import styles from './Auth.module.css';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, login, completeLogin } = useAuth();
  const [isLogin, setIsLogin] = useState(
    () => location.state?.mode !== 'register',
  );
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(() =>
    location.state?.mode === 'register'
      ? ''
      : localStorage.getItem('rememberedEmail') || '',
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    () => !!localStorage.getItem('rememberedEmail'),
  );

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(() =>
    sessionStorage.getItem('signedOutReason') === 'idle'
      ? 'Signed out after 15 minutes with no activity. This page stays open.'
      : null,
  );
  const [secondFactor, setSecondFactor] = useState(null);
  const [setupFace, setSetupFace] = useState(false);

  /**
   * Leaves the sign-in page for the forum after the session is stored.
   *
   * @returns {Promise<void>}
   */
  const finishSignIn = async () => {
    setLoading(false);
    setSuccessMessage('Sign-in successful. Redirecting...');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const nextParam = new URLSearchParams(location.search).get('next') || '';
    const sharedQuestion = questionOnlyPath(nextParam);
    if (sharedQuestion) {
      navigate(sharedQuestion, { replace: true });
      return;
    }
    const fromLocation = location.state?.from;
    const fromState = fromLocation
      ? `${fromLocation.pathname || ''}${fromLocation.search || ''}${fromLocation.hash || ''}`
      : '';
    const saved = takeAuthReturnTo();
    const safe = path =>
      path.startsWith('/') && !path.startsWith('//') && path !== '/auth'
        ? path
        : '';
    const from = safe(fromState) || safe(saved) || '/dashboard';
    navigate(from, { replace: true });
  };

  /**
   * Stores the session from face unlock or the email code, then opens the forum.
   *
   * @param {{ user: Object }} session - Session already written to localStorage.
   * @returns {Promise<void>}
   */
  const finishSecondFactor = async session => {
    completeLogin(session);
    await finishSignIn();
  };

  /**
   * Validates the form, then calls `login` or `register`.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} e - Auth form submit event.
   * @returns {Promise<void>} Redirects after login, or switches to login after register.
   */
  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail) {
      setError('Email is required.');
      return;
    }

    if (!emailPattern.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password.trim()) {
      setError('Password is required.');
      return;
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!isLogin) {
      if (!trimmedFirstName) {
        setError('First name is required.');
        return;
      }
      if (trimmedFirstName.length < 3) {
        setError('First name must be at least 3 characters long.');
        return;
      }
      if (!trimmedLastName) {
        setError('Last name is required.');
        return;
      }
      if (trimmedLastName.length < 3) {
        setError('Last name must be at least 3 characters long.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const result = await login({ email: normalizedEmail, password });

        if (rememberMe) {
          localStorage.setItem('rememberedEmail', normalizedEmail);
        } else {
          localStorage.removeItem('rememberedEmail');
        }

        if (result.secondFactor) {
          setLoading(false);
          setSecondFactor({
            pendingToken: result.pendingToken,
            email: result.email,
            hasDevice: result.hasDevice,
          });
          return;
        }

        await finishSignIn();
        return;
      } else {
        await register({
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email: normalizedEmail,
          password,
        });
        const signedIn = await login({
          email: normalizedEmail,
          password,
        });
        setPassword('');
        setShowPassword(false);
        if (signedIn.secondFactor) {
          setLoading(false);
          setSecondFactor({
            pendingToken: signedIn.pendingToken,
            email: signedIn.email,
            hasDevice: signedIn.hasDevice,
          });
          return;
        }
        setLoading(false);
        setSetupFace(true);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Opens the register form with empty fields. Create free account navigates
   * here with `state.mode === 'register'`.
   *
   * @returns {void}
   */
  const clearRegisterFields = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setError(null);
    setSuccessMessage(null);
  };

  useEffect(() => {
    sessionStorage.removeItem('signedOutReason');
  }, []);

  useEffect(() => {
    if (location.state?.mode !== 'register') {
      return;
    }
    setIsLogin(false);
    clearRegisterFields();
  }, [location.key, location.state]);

  /**
   * Toggles login/register and clears banners.
   * Create an account starts from empty boxes. Sign in can restore a remembered email.
   *
   * @returns {void}
   */
  const switchMode = () => {
    setError(null);
    setSuccessMessage(null);
    setFirstName('');
    setLastName('');
    setPassword('');
    setShowPassword(false);
    if (isLogin) {
      setEmail('');
    } else {
      setEmail(localStorage.getItem('rememberedEmail') || '');
    }
    setIsLogin(wasLogin => !wasLogin);
  };

  return (
    <div className={styles.auth}>
      {/* Left: Info Section */}
      <section className={styles.auth__info}>
        <div className={styles.auth__infoContent}>
          <header className={styles.auth__infoHeader}>
            <div
              className={styles.auth__infoBranding}
              onClick={() => navigate('/')}
              title='Go to Home'
              role='button'
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/');
                }
              }}
            >
              <div className={styles.auth__infoLogo} aria-hidden>
                <MessageSquare
                  className={styles.auth__infoLogoIcon}
                  size={22}
                />
              </div>
              <div className={styles.auth__infoBrandCopy}>
                <p className={styles.auth__infoTitle}>Evangadi Forum</p>
                <p className={styles.auth__infoTagline}>
                  Learn together. Ask with context.
                </p>
              </div>
            </div>
            <p className={styles.auth__infoDescription}>
              Sign in to post technical questions, follow threads, and search
              the forum with both keyword and AI similarity modes, built for
              Evangadi coursework and peer review.
            </p>
          </header>

          <div className={styles.auth__features}>
            <div className={styles.auth__feature}>
              <div className={styles.auth__featureIcon}>
                <Sparkles size={16} />
              </div>
              <div className={styles.auth__featureContent}>
                <h3 className={styles.auth__featureTitle}>Visible reasoning</h3>
                <p className={styles.auth__featureDescription}>
                  Threads stay readable: markdown, code blocks, and replies
                  build a mini knowledge base your cohort can revisit before
                  exams.
                </p>
              </div>
            </div>
            <div className={styles.auth__feature}>
              <div className={styles.auth__featureIcon}>
                <Code size={16} />
              </div>
              <div className={styles.auth__featureContent}>
                <h3 className={styles.auth__featureTitle}>
                  Low-friction workflow
                </h3>
                <p className={styles.auth__featureDescription}>
                  One layout for asking, answering, and scanning search results,
                  so you spend energy on the problem, not on hunting controls.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.auth__infoFooter}>
            <div className={styles.auth__infoFooterContent}>
              <div className={styles.auth__infoAvatars} aria-hidden>
                {[
                  { name: 'A+K', bg: 'c2410c' },
                  { name: 'N+U', bg: '0f766e' },
                  { name: 'E+S', bg: '15803d' },
                ].map(person => (
                  <img
                    key={person.name}
                    src={`https://ui-avatars.com/api/?name=${person.name}&background=${person.bg}&color=fff&size=64`}
                    className={styles.auth__infoAvatar}
                    alt=''
                    referrerPolicy='no-referrer'
                  />
                ))}
              </div>
              <span className={styles.auth__infoBadge}>
                Evangadi cohorts · weekly stand-ups · office-hour style help
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Right: Auth Forms */}
      <section className={styles.auth__formSection}>
        <div className={styles.auth__formContainer}>
          <AnimatePresence mode='wait'>
            <Motion.div
              key={
                setupFace
                  ? 'setup'
                  : secondFactor
                    ? 'face'
                    : isLogin
                      ? 'login'
                      : 'register'
              }
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {!secondFactor && !setupFace && (
                <div className={styles.auth__formHeader}>
                  <h2 className={styles.auth__formTitle}>
                    {isLogin
                      ? 'Sign in to your account'
                      : 'Create an account'}
                  </h2>
                  <p className={styles.auth__formSubtitle}>
                    {isLogin
                      ? 'Enter your email and password. Then confirm with the method you chose.'
                      : 'After your password, choose how you will sign in next time.'}
                  </p>
                </div>
              )}

              {setupFace ? (
                <FaceSetup onDone={finishSignIn} />
              ) : secondFactor ? (
                <FaceUnlockStep
                  email={secondFactor.email}
                  pendingToken={secondFactor.pendingToken}
                  hasDevice={secondFactor.hasDevice}
                  onSuccess={finishSecondFactor}
                  onBack={() => {
                    setSecondFactor(null);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                />
              ) : (
              <form
                className={styles.auth__form}
                onSubmit={handleSubmit}
                autoComplete={isLogin ? 'on' : 'off'}
              >
                {!isLogin && (
                  <>
                    <div className={styles.auth__inputGroup}>
                      <label htmlFor='firstName' className={styles.auth__label}>
                        First Name
                      </label>
                      <input
                        id='firstName'
                        name='firstName'
                        type='text'
                        autoComplete='given-name'
                        placeholder='First name'
                        className={styles.auth__input}
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                      />
                    </div>

                    <div className={styles.auth__inputGroup}>
                      <label htmlFor='lastName' className={styles.auth__label}>
                        Last Name
                      </label>
                      <input
                        id='lastName'
                        name='lastName'
                        type='text'
                        autoComplete='family-name'
                        placeholder='Last name'
                        className={styles.auth__input}
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className={styles.auth__inputGroup}>
                  <label htmlFor='email' className={styles.auth__label}>
                    Email Address
                  </label>
                  <input
                    id='email'
                    name='email'
                    type='email'
                    autoComplete={isLogin ? 'email' : 'off'}
                    placeholder='Enter your email address'
                    className={styles.auth__input}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>

                <div className={styles.auth__inputGroup}>
                  <div className={styles.auth__labelRow}>
                    <label htmlFor='password' className={styles.auth__label}>
                      Password
                    </label>
                  </div>
                  <div className={styles.auth__passwordWrap}>
                    <input
                      id='password'
                      name='password'
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={
                        isLogin ? 'current-password' : 'new-password'
                      }
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

                {isLogin && (
                  <div className={styles.auth__options}>
                    <label className={styles.auth__remember}>
                      <input
                        type='checkbox'
                        className={styles.auth__checkbox}
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                      />
                      Remember my email
                    </label>
                    <Link
                      to='/forgot-password'
                      className={styles.auth__labelLink}
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}

                {successMessage && (
                  <div className={styles.auth__success}>{successMessage}</div>
                )}

                {error && <div className={styles.auth__error}>{error}</div>}

                <div className={styles.auth__buttonContainer}>
                  <button
                    type='submit'
                    className={`${styles.auth__button} ${styles['auth__button--primary']}`}
                    disabled={loading}
                    aria-busy={loading}
                  >
                    {loading
                      ? 'Processing...'
                      : isLogin
                        ? 'Sign In'
                        : 'Create Account'}
                    {!loading ? (
                      <ArrowRight
                        size={16}
                        className={styles.auth__buttonIcon}
                      />
                    ) : null}
                  </button>
                </div>

                <div className={styles.auth__divider}>
                  <div className={styles.auth__dividerLine}>
                    <div className={styles.auth__dividerBorder}></div>
                  </div>
                  <div className={styles.auth__dividerText}>
                    Additional options
                  </div>
                </div>
              </form>
              )}

              {!secondFactor && !setupFace && (
              <footer className={styles.auth__formFooter}>
                <p className={styles.auth__formFooterText}>
                  {isLogin
                    ? "Don't have an account?"
                    : 'Already have an account?'}
                  <button
                    type='button'
                    onClick={switchMode}
                    className={styles.auth__formFooterLink}
                  >
                    {isLogin ? 'Create an account' : 'Back to sign in'}
                  </button>
                </p>
              </footer>
              )}
            </Motion.div>
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
