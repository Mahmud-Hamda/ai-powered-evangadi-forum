import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, MessageSquare, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAuthorAvatarColor,
  getAuthorInitials,
} from '../../lib/utils.js';
import styles from './Sidebar.module.css';

/**
 * Primary navigation: paths must match `App.jsx` routes.
 * Add rows here when you ship new sections (e.g. Admin, Bookmarks).
 *
 * @typedef {{ icon: import('react').ComponentType<{size?: number, className?: string}>, label: string, path: string }} SidebarNavItem
 */

/** @type {SidebarNavItem[]} */
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Home', path: '/dashboard' },
  { icon: MessageSquare, label: 'Your Topics', path: '/my-questions' },
  { icon: FileText, label: 'Knowledge Base', path: '/rag-documents' },
];

/**
 * Left nav: brand, section links, "New Question", and the signed-in user.
 *
 * @param {boolean} [props.questionOnly] - Hides navigation when a shared link may open only one question.
 * @param {boolean} [props.open] - Drawer is open on a narrow screen.
 * @param {boolean} [props.mobileHidden] - Drawer is off-screen; keep it out of the tab order.
 * @param {() => void} [props.onNavigate] - Closes the drawer after a navigation choice.
 * @returns {JSX.Element} The fixed sidebar.
 */
export default function Sidebar({
  questionOnly = false,
  open = false,
  mobileHidden = false,
  onNavigate,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <aside
      id="app-sidebar"
      className={styles.sidebar + (open ? ' ' + styles['sidebar--open'] : '')}
      inert={mobileHidden ? true : undefined}
      aria-hidden={mobileHidden || undefined}
    >
      <div className={styles.sidebar__header}>
        <div
          className={styles.sidebar__branding}
          onClick={() => {
            onNavigate?.();
            navigate('/');
          }}
          title={questionOnly ? 'Public pages' : 'Go to Home'}
          role='button'
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate?.();
              navigate('/');
            }
          }}
        >
          <div className={styles.sidebar__logo} aria-hidden>
            <MessageSquare className={styles['sidebar__logo-icon']} size={20} />
          </div>
          <div className={styles.sidebar__brandCopy}>
            <p className={styles.sidebar__title}>Evangadi Forum</p>
            <p className={styles.sidebar__tagline}>
              Learn together. Ask with context.
            </p>
          </div>
        </div>
      </div>

      {questionOnly ? (
      <nav className={styles.sidebar__nav} aria-label='Public pages'>
        <p className={styles.sidebar__navLabel}>Public</p>
        <div className={styles['sidebar__nav-item-wrapper']}>
          <button
            type='button'
            className={`${styles.sidebar__link} ${styles['sidebar__link--inactive']}`}
            onClick={() => {
              onNavigate?.();
              navigate('/');
            }}
          >
            <span>Public pages</span>
          </button>
        </div>
      </nav>
      ) : (
      <nav className={styles.sidebar__nav} aria-label='Main navigation'>
        <p className={styles.sidebar__navLabel}>Navigate</p>
        {NAV_ITEMS.map(item => (
          <div key={item.path} className={styles['sidebar__nav-item-wrapper']}>
            <NavLink
              to={item.path}
              onClick={() => onNavigate?.()}
              className={({ isActive }) =>
                `${styles.sidebar__link} ${
                  isActive
                    ? styles['sidebar__link--active']
                    : styles['sidebar__link--inactive']
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={18}
                    className={`${styles.sidebar__icon} ${
                      isActive
                        ? styles['sidebar__icon--active']
                        : styles['sidebar__icon--inactive']
                    }`}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </div>
        ))}
      </nav>
      )}

      <div className={styles.sidebar__footer}>
        {questionOnly ? null : (
        <button
          type='button'
          onClick={() => {
            onNavigate?.();
            navigate('/questions/ask');
          }}
          className={styles.sidebar__button}
        >
          New Question
        </button>
        )}

        <div className={styles.sidebar__user}>
          <div className={styles.sidebar__profile}>
            <div
              className={styles.sidebar__avatar}
              style={{ backgroundColor: getAuthorAvatarColor(user) }}
              aria-hidden
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt=''
                  className={styles['sidebar__avatar-image']}
                  referrerPolicy='no-referrer'
                />
              ) : (
                getAuthorInitials(user)
              )}
            </div>
            <div className={styles.sidebar__info}>
              <p className={styles.sidebar__name}>
                {user?.firstName} {user?.lastName}
              </p>
              <p className={styles.sidebar__role}>Learner</p>
            </div>
          </div>

          <button
            type='button'
            onClick={logout}
            className={styles.sidebar__logout}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
