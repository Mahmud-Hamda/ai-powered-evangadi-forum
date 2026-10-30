import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth/auth.service.js';

/**
 * @typedef {import('../types/forum.js').AuthUser} AuthUser
 * @typedef {import('../types/forum.js').AuthContextValue} AuthContextValue
 * @typedef {import('../types/forum.js').RegisterPayload} RegisterPayload
 * @typedef {import('../types/forum.js').LoginPayload} LoginPayload
 */

/**
 * React context that holds the signed-in user and auth methods.
 *
 * @type {import('react').Context<AuthContextValue | undefined>}
 */
const AuthContext = createContext(undefined);

/** Minutes with no clicks, typing, or scrolling before the open tab signs out. */
const IDLE_SIGN_OUT_MINUTES = 15;

/** How often the open tab checks that idle limit. */
const IDLE_CHECK_MS = 15000;

/** Session flag so the sign-in page can explain an idle sign-out. */
const IDLE_NOTICE_KEY = 'signedOutReason';

/**
 * Wraps the app so any child can call `useAuth()`.
 *
 * @param {{ children: import('react').ReactNode }} props - Tree that needs the session.
 * @returns {JSX.Element} Provider that supplies user, loading, login, register, logout.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(/** @type {AuthUser | null} */ (null));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = authService.getStoredToken();
    const storedUser = authService.getStoredUser();

    if (token && storedUser) {
      setUser(storedUser);
    }

    setLoading(false);
  }, []);

  /**
   * Creates an account. Does not sign the user in.
   *
   * @param {RegisterPayload} userData - First name, last name, email, password.
   * @returns {Promise<{success: boolean, user: AuthUser}>} The created user from the API.
   */
  const register = async userData => {
    setLoading(true);
    try {
      const { user: createdUser } = await authService.register(userData);
      return { success: true, user: createdUser };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Signs in, stores the session, and sets `user`.
   *
   * @param {LoginPayload} credentials - Email and password.
   * @returns {Promise<{success: boolean}>} Resolves when the session is stored.
   */
  const login = async credentials => {
    setLoading(true);
    try {
      const result = await authService.login(credentials);
      if (result.secondFactor) {
        return result;
      }
      setUser(result.user);
      return { success: true, user: result.user };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Stores a session that finished face unlock or an email code.
   *
   * @param {{ user: AuthUser }} session - Session already written to localStorage.
   * @returns {void}
   */
  const completeLogin = session => {
    setUser(session.user);
  };

  /**
   * Clears localStorage and sends the browser to `/auth`.
   * The tab stays open. An idle sign-out leaves a short note on the sign-in page.
   *
   * @param {'idle' | undefined} reason - `idle` when the open tab had no activity.
   * @returns {void}
   */
  const logout = useCallback(
    reason => {
      authService.logout();
      setUser(null);
      if (reason === 'idle') {
        sessionStorage.setItem(IDLE_NOTICE_KEY, 'idle');
      }
      navigate('/auth', { replace: true });
    },
    [navigate],
  );

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let lastActivity = Date.now();
    let signedOut = false;
    const markActive = () => {
      lastActivity = Date.now();
    };
    const signOutIfIdle = () => {
      if (signedOut) {
        return;
      }
      if (Date.now() - lastActivity < IDLE_SIGN_OUT_MINUTES * 60 * 1000) {
        return;
      }
      signedOut = true;
      logout('idle');
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        signOutIfIdle();
      }
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart'];
    events.forEach(name =>
      window.addEventListener(name, markActive, { passive: true, capture: true }),
    );
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(signOutIfIdle, IDLE_CHECK_MS);

    return () => {
      events.forEach(name =>
        window.removeEventListener(name, markActive, { capture: true }),
      );
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [user, logout]);

  /** @type {AuthContextValue} */
  const value = {
    user,
    loading,
    register,
    login,
    completeLogin,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Reads the auth session. Must be used under `AuthProvider`.
 *
 * @returns {AuthContextValue} `user`, `loading`, `register`, `login`, `logout`, `isAuthenticated`.
 * @throws {Error} If called outside `AuthProvider`.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
