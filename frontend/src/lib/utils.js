/**
 * Formats a date as a relative time string, such as "5 mins ago".
 * A missing or invalid date returns an empty string. A future date returns "just now".
 *
 * @param {Date|string|number} dateInput - The date to format.
 * @returns {string} Relative time string.
 */
export function timeAgo(dateInput) {
  if (!dateInput) return '';

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds} sec${seconds !== 1 ? 's' : ''} ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours !== 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

/**
 * Whether a question was created by the signed-in user (IDs compared as strings).
 *
 * @param {{ author?: { id?: string | number } } | null | undefined} question - Question with nested `author.id`.
 * @param {{ id?: string | number } | null | undefined} user - Signed-in user from `useAuth()`.
 * @returns {boolean} True when both ids exist and match.
 */
export function isAuthoredByUser(question, user) {
  if (!question || !user) return false;
  const authorId = question.author?.id;
  const userId = user.id;
  if (authorId == null || userId == null) return false;
  return String(authorId) === String(userId);
}

/**
 * Distinct initials colors, matching the dashboard mock (orange, teal, green, …).
 *
 * @type {string[]}
 */
export const AUTHOR_AVATAR_COLORS = [
  '#c2410c',
  '#0f766e',
  '#15803d',
  '#1d4ed8',
  '#7c3aed',
  '#be123c',
  '#0e7490',
  '#a16207',
];

/**
 * Builds initials from a user or nested author.
 *
 * @param {{ firstName?: string, lastName?: string } | null | undefined} person - Author or signed-in user.
 * @returns {string} One or two uppercase letters, or "?" when the name is missing.
 */
export function getAuthorInitials(person) {
  const first = person?.firstName?.trim()?.[0] ?? '';
  const last = person?.lastName?.trim()?.[0] ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

/**
 * Picks a stable avatar color from id + name so different people get different chips.
 *
 * @param {{ id?: string | number, firstName?: string, lastName?: string } | null | undefined} person - Author or signed-in user.
 * @returns {string} A hex color from `AUTHOR_AVATAR_COLORS`.
 */
export function getAuthorAvatarColor(person) {
  const key = `${person?.id ?? ''}:${person?.firstName ?? ''}:${person?.lastName ?? ''}`;
  let hash = 5381;
  for (const char of key) {
    hash = Math.imul(hash, 33) + char.charCodeAt(0);
  }
  const index = Math.abs(hash) % AUTHOR_AVATAR_COLORS.length;
  return AUTHOR_AVATAR_COLORS[index];
}

const AUTH_RETURN_KEY = 'authReturnTo';
const QUESTION_ONLY_PATH = /^\/questions\/[a-f0-9]{16}$/;

/**
 * Accepts only a single question path. Any other route is rejected.
 *
 * @param {string} path - A path that may include a query or hash.
 * @returns {string} `/questions/<hash>`, or an empty string.
 */
export function questionOnlyPath(path) {
  if (typeof path !== 'string') return '';
  const pathname = path.split('?')[0].split('#')[0];
  return QUESTION_ONLY_PATH.test(pathname) ? pathname : '';
}


/**
 * Keeps an in-app path so sign-in can open that page afterward.
 * Ignores empty paths, `/auth`, and anything that is not a local path.
 *
 * @param {string} path - Path, query, and hash to restore after login.
 * @returns {void}
 */
export function rememberAuthReturnTo(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return;
  if (path === '/auth' || path.startsWith('/auth?')) return;
  sessionStorage.setItem(AUTH_RETURN_KEY, path);
}

/**
 * Reads and clears the page saved for after sign-in.
 *
 * @returns {string} A local path, or an empty string when nothing was saved.
 */
export function takeAuthReturnTo() {
  const path = sessionStorage.getItem(AUTH_RETURN_KEY) || '';
  sessionStorage.removeItem(AUTH_RETURN_KEY);
  if (!path.startsWith('/') || path.startsWith('//') || path === '/auth') return '';
  return path;
}
