import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../Navbar/Navbar.jsx';
import Sidebar from '../Sidebar/Sidebar.jsx';
import styles from './Layout.module.css';

/**
 * Authenticated shell: fixed sidebar + scrollable main column + footer.
 * Add new `pathname` branches below when you introduce more protected routes.
 *
 * @returns {JSX.Element} Sidebar, Navbar, `<Outlet />`, and footer.
 */
const NARROW_NAV = '(max-width: 899px)';

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(NARROW_NAV).matches
  );

  useEffect(() => {
    const query = window.matchMedia(NARROW_NAV);
    const onChange = () => {
      setNarrow(query.matches);
      if (!query.matches) setMenuOpen(false);
    };
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  /**
   * Navbar title: keep in sync with routes in `App.jsx`.
   *
   * @returns {string} Short page name for the top bar.
   */
  const getTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Home';
    if (path === '/my-questions') return 'Your topics';
    if (path === '/questions/ask') return 'Ask a question';
    if (path.startsWith('/questions/')) return 'Discussion';
    if (path === '/rag-documents') return 'Knowledge base';
    return 'Forum';
  };

  /**
   * One-line context under the title (helps students orient on each screen).
   *
   * @returns {string} Subtitle for the current path, or empty.
   */
  const getSubtitle = () => {
    const path = location.pathname;
    if (path === '/dashboard')
      return 'Browse the feed, search by keyword, or run AI similarity search.';
    if (path === '/my-questions')
      return 'Questions you have posted. Open any thread to read replies or edit context.';
    if (path === '/questions/ask')
      return 'A clear title and reproducible steps get faster, more accurate answers.';
    if (path.startsWith('/questions/'))
      return 'Read the thread, review related topics, and reply with markdown if you can help.';
    if (path === '/rag-documents')
      return 'Private PDF library: reader, semantic search, and AI answers with citations per document.';
    return '';
  };

  const mobileHidden = narrow && !menuOpen;

  return (
    <div className={styles.layout + (menuOpen && narrow ? ' ' + styles.layout__navOpen : '')}>
      {narrow && menuOpen ? (
        <button
          type="button"
          className={styles.layout__backdrop}
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <Sidebar
        open={menuOpen}
        mobileHidden={mobileHidden}
        onNavigate={() => setMenuOpen(false)}
      />
      <div className={styles.layout__content}>
        <Navbar
          title={getTitle()}
          subtitle={getSubtitle()}
          user={user}
          onLogout={logout}
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((open) => !open)}
        />
        <main className={styles.layout__main}>
          <div className={styles.layout__mainInner}>
            <Outlet />
          </div>
        </main>

        <footer className={styles.layout__footer}>
          <div className={styles['layout__footer-content']}>
            <div className={styles['layout__footer-branding']}>
              <h4 className={styles['layout__footer-title']}>Evangadi Forum</h4>
              <p className={styles['layout__footer-tagline']}>
                A practice space for technical Q&A, peer feedback, and
                AI-assisted search, built for Evangadi learners and mentors.
              </p>
              <p className={styles['layout__footer-copyright']}>
                © 2026 Evangadi Forum. For educational use.
              </p>
            </div>
            <nav className={styles['layout__footer-nav']}>
              <a href='#' className={styles['layout__footer-link']}>
                About
              </a>
              <a href='#' className={styles['layout__footer-link']}>
                Privacy
              </a>
              <a href='#' className={styles['layout__footer-link']}>
                Terms
              </a>
              <a href='#' className={styles['layout__footer-link']}>
                Contact
              </a>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
