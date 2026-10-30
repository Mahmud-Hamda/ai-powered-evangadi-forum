import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { rememberAuthReturnTo } from '../../lib/utils.js';
import styles from './ProtectedRoute.module.css';

/**
 * Wraps protected pages and redirects unauthenticated users to `/auth`,
 * preserving the original URL in `location.state.from` for post-login redirect.
 *
 * @param {{ children: import('react').ReactNode }} props - The page to show after the session is confirmed.
 * @returns {JSX.Element} Loader, `<Navigate to="/auth">`, or `children`.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className={styles.protectedRoute__screen} role='status'>
        <div className={styles.protectedRoute__spinner} aria-hidden />
        <span>Checking your session…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    rememberAuthReturnTo(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to='/auth' state={{ from: location }} replace />;
  }

  return children;
}
