import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, LogOut, Sparkles } from 'lucide-react';
import {
  getAuthorAvatarColor,
  getAuthorInitials,
} from '../../lib/utils.js';
import styles from './Navbar.module.css';

/**
 * Top bar: page title, debounced text search → `/dashboard?q=…`, optional AI semantic search.
 * The field starts from `q` or `semantic` on the dashboard. While semantic search is
 * active, typing does not replace `semantic` with `q`.
 * Search state is driven by the URL on the dashboard so bookmarks and refresh keep context.
 *
 * @typedef {import('../../types/forum.js').AuthUser} AuthUser
 */

/**
 * @param {Object} props - Navbar props from Layout.
 * @param {string} props.title - Page heading (for example "Home" or "Discussion").
 * @param {string} [props.subtitle] - One-line context under the title.
 * @param {AuthUser|null} [props.user] - Signed-in user for the name and avatar.
 * @param {() => void} props.onLogout - Clears the session.
 * @param {boolean} [props.questionOnly] - Hides search when a shared link may open only one question.
 * @returns {JSX.Element} The sticky top bar.
 */
export default function Navbar({ title, subtitle, user, onLogout, questionOnly = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchTerm, setSearchTerm] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('q') || params.get('semantic') || '';
  });
  const [searchMode, setSearchMode] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('semantic') ? 'semantic' : 'keyword';
  });

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      const params = new URLSearchParams(location.search);
      setSearchTerm(params.get('q') || params.get('semantic') || '');
      setSearchMode(params.get('semantic') ? 'semantic' : 'keyword');
    } else {
      setSearchTerm('');
      setSearchMode('keyword');
    }
  }, [location.search, location.pathname]);

  useEffect(() => {
    if (searchMode === 'semantic') {
      return undefined;
    }

    const delayDebounceFn = setTimeout(() => {
      const trimmed = searchTerm.trim();
      if (trimmed !== '') {
        navigate(`/dashboard?q=${encodeURIComponent(trimmed)}`);
      } else if (location.pathname === '/dashboard') {
        navigate('/dashboard');
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, searchMode, navigate, location.pathname]);

  /**
   * Runs AI semantic search from the current search box (`?semantic=`).
   *
   * @param {import('react').MouseEvent<HTMLButtonElement> | import('react').FormEvent} e - Click or submit event.
   * @returns {void} Navigates to `/dashboard?semantic=…` when the query is at least 5 characters.
   */
  const handleSemanticSearch = e => {
    e.preventDefault();
    const trimmed = searchTerm.trim();
    if (trimmed.length < 5) {
      return;
    }
    setSearchMode('semantic');
    navigate(`/dashboard?semantic=${encodeURIComponent(trimmed)}`);
  };

  /**
   * Runs keyword search from the search form (`?q=`).
   *
   * @param {import('react').FormEvent<HTMLFormElement>} e - The search form submit event.
   * @returns {void} Navigates to `/dashboard?q=…` when the box is not empty.
   */
  const handleSearchSubmit = e => {
    e.preventDefault();
    const trimmed = searchTerm.trim();
    if (trimmed) {
      setSearchMode('keyword');
      navigate(`/dashboard?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.navbar__titleBlock}>
        <h2 className={styles.navbar__pageTitle}>{title}</h2>
        {subtitle ? (
          <p className={styles.navbar__pageSubtitle}>{subtitle}</p>
        ) : null}
      </div>

      {questionOnly ? null : (
      <form className={styles.navbar__search} onSubmit={handleSearchSubmit}>
        <div className={styles['navbar__search-icon']}>
          <Search size={16} />
        </div>
        <input
          id='search'
          type='text'
          value={searchTerm}
          onChange={e => {
            setSearchMode('keyword');
            setSearchTerm(e.target.value);
          }}
          placeholder='Search questions by keyword…'
          className={styles['navbar__search-input']}
          aria-label='Search questions by keyword'
        />
        {searchTerm.trim().length >= 5 && (
          <button
            type='button'
            onClick={handleSemanticSearch}
            className={styles['navbar__semantic-button']}
            title='Use AI Semantic Search'
          >
            <Sparkles size={14} />
            <span className={styles['navbar__semantic-text']}>AI Search</span>
          </button>
        )}
      </form>
      )}

      <div className={styles.navbar__actions}>
        <div className={styles.navbar__user}>
          <span className={styles['navbar__user-name']}>
            {user ? `${user.firstName} ${user.lastName}` : 'Guest'}
          </span>
          <div
            className={styles['navbar__user-avatar']}
            style={{ backgroundColor: getAuthorAvatarColor(user) }}
            aria-hidden
          >
            {user?.avatar ? (
              <img src={user.avatar} alt='' referrerPolicy='no-referrer' />
            ) : (
              getAuthorInitials(user)
            )}
          </div>
        </div>
        {user && (
          <button
            type='button'
            className={styles.navbar__logout}
            onClick={onLogout}
            aria-label='Logout'
            title='Logout'
          >
            <LogOut size={20} />
          </button>
        )}
      </div>
    </header>
  );
}
