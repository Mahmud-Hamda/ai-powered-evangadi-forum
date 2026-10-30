/**
 * Dashboard: signed-in home (`/dashboard`). Welcome panel, feed snapshot, and
 * discussion list. Keyword search lives in the Navbar and arrives here as `?q=`.
 * AI Search uses `?semantic=` and GET `/api/questions/search`.
 *
 * Data: `getQuestions` / `searchQuestionsSemantic` from question.service.js.
 *
 * @typedef {import('../../types/forum.js').ForumQuestion} ForumQuestion
 * @typedef {import('../../types/forum.js').AuthUser} AuthUser
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, BookOpen, PenSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import QuestionCard from '../../components/QuestionCard/QuestionCard.jsx';
import { isAuthoredByUser } from '../../lib/utils.js';
import { getQuestions, searchQuestionsSemantic } from '../../services/question/question.service.js';
import styles from './Dashboard.module.css';

/**
 * Counts derived from the threads currently in the feed.
 *
 * @typedef {Object} FeedSnapshot
 * @property {number} questionCount - Threads in this response (API cap is 100).
 * @property {number} replyCount - Sum of `answerCount` across those threads.
 * @property {number} unansweredCount - Threads with zero replies.
 * @property {number} yoursCount - Threads authored by the signed-in user.
 */

/**
 * One shortcut tile under the welcome copy.
 *
 * @typedef {Object} HomeShortcut
 * @property {string} to - In-app path.
 * @property {string} title - Tile heading.
 * @property {string} description - One-line hint.
 * @property {import('react').ComponentType<{size?: number, strokeWidth?: number}>} icon - Lucide icon.
 */

/** @type {HomeShortcut[]} */
const HOME_SHORTCUTS = [
  {
    to: '/questions/ask',
    title: 'New question',
    description: 'Share context, errors, and what you already tried',
    icon: PenSquare,
  },
  {
    to: '/my-questions',
    title: 'Your topics',
    description: 'Filtered list of threads you authored',
    icon: BarChart3,
  },
  {
    to: '/rag-documents',
    title: 'Knowledge base',
    description: 'Course library, uploads, and retrieval-backed context for threads',
    icon: BookOpen,
  },
];

/**
 * Builds snapshot figures from the loaded feed.
 *
 * @param {ForumQuestion[]} questions - Threads currently shown.
 * @param {AuthUser|null} user - Signed-in user from `useAuth()`.
 * @returns {FeedSnapshot} Counts for the four snapshot tiles.
 */
const buildFeedSnapshot = (questions, user) => {
  return questions.reduce(
    (snapshot, question) => {
      const replies = question.answerCount ?? 0;
      snapshot.questionCount += 1;
      snapshot.replyCount += replies;
      if (replies === 0) snapshot.unansweredCount += 1;
      if (isAuthoredByUser(question, user)) snapshot.yoursCount += 1;
      return snapshot;
    },
    {
      questionCount: 0,
      replyCount: 0,
      unansweredCount: 0,
      yoursCount: 0,
    },
  );
};

/**
 * Home after login: welcome shortcuts, feed snapshot, and discussion cards.
 *
 * @returns {JSX.Element} The dashboard page.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [questions, setQuestions] = useState(/** @type {ForumQuestion[]} */ ([]));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  const keywordTerm = (searchParams.get('q') || '').trim();
  const semanticTerm = (searchParams.get('semantic') || '').trim();
  const isSemanticSearch = Boolean(semanticTerm);
  const isSearching = Boolean(keywordTerm || semanticTerm);

  const firstName = user?.firstName?.trim();
  const welcomeLine = firstName
    ? `Good to see you, ${firstName}.`
    : 'Welcome to the forum.';

  const snapshot = useMemo(
    () => buildFeedSnapshot(questions, user),
    [questions, user],
  );

  useEffect(() => {
    /**
     * Loads the newest threads, optionally filtered by the Navbar search term.
     *
     * @returns {Promise<void>} Sets `questions` or `error`.
     */
    const loadQuestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = isSemanticSearch
          ? await searchQuestionsSemantic(semanticTerm)
          : await getQuestions({
              search: keywordTerm || undefined,
            });
        setQuestions(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(
          err.message ||
            (isSemanticSearch
              ? 'Failed to run AI search.'
              : 'Failed to load questions.'),
        );
        setQuestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadQuestions();
  }, [isSemanticSearch, keywordTerm, semanticTerm]);

  return (
    <div className={styles.dashboard}>
      {isSearching ? null : (
      <section className={styles.dashboard__hero} aria-labelledby='dashboard-welcome'>
        <p className={styles.dashboard__eyebrow}>Forum home</p>
        <h3 id='dashboard-welcome' className={styles.dashboard__welcome}>
          {welcomeLine}
        </h3>
        <p className={styles.dashboard__lede}>
          Start a topic, revisit your own threads, or skim the live feed. Search
          above works from any page once you are back on Home.
        </p>

        <div className={styles.dashboard__shortcuts}>
          {HOME_SHORTCUTS.map(shortcut => (
            <Link
              key={shortcut.to}
              to={shortcut.to}
              className={styles.dashboard__shortcut}
            >
              <span className={styles.dashboard__shortcutIcon} aria-hidden>
                <shortcut.icon size={18} strokeWidth={2} />
              </span>
              <span className={styles.dashboard__shortcutText}>
                <span className={styles.dashboard__shortcutTitle}>
                  {shortcut.title}
                </span>
                <span className={styles.dashboard__shortcutCopy}>
                  {shortcut.description}
                </span>
              </span>
            </Link>
          ))}
        </div>

        {isLoading ? (
          <p className={styles.dashboard__snapshotNote}>
            Loading snapshot for the list below...
          </p>
        ) : null}

        {!isLoading && !error ? (
          <>
            <p className={styles.dashboard__snapshotNote}>
              {isSemanticSearch
                ? 'Figures below describe the similar threads from AI search.'
                : 'Figures below describe the newest threads in this feed (up to 100 from the API).'}
            </p>
            <div className={styles.dashboard__stats}>
              <div className={styles.dashboard__stat}>
                <p className={styles.dashboard__statLabel}>Questions</p>
                <p className={styles.dashboard__statValue}>
                  {snapshot.questionCount}
                </p>
              </div>
              <div className={styles.dashboard__stat}>
                <p className={styles.dashboard__statLabel}>Replies</p>
                <p className={styles.dashboard__statValue}>
                  {snapshot.replyCount}
                </p>
              </div>
              <div className={styles.dashboard__stat}>
                <p className={styles.dashboard__statLabel}>Unanswered</p>
                <p className={styles.dashboard__statValue}>
                  {snapshot.unansweredCount}
                </p>
              </div>
              <div className={styles.dashboard__stat}>
                <p className={styles.dashboard__statLabel}>Yours</p>
                <p className={styles.dashboard__statValue}>
                  {snapshot.yoursCount}
                </p>
              </div>
            </div>
          </>
        ) : null}
      </section>
      )}

      <section className={styles.dashboard__feed} aria-labelledby='dashboard-feed'>
        <div className={styles.dashboard__feedHeader}>
          <div>
            <h4 id='dashboard-feed' className={styles.dashboard__feedTitle}>
              Discussion feed
            </h4>
            <p className={styles.dashboard__feedCopy}>
              {isSemanticSearch
                ? 'Ranked by meaning, not exact keywords.'
                : 'Your threads use a slim left accent in this list.'}
            </p>
          </div>
          <span className={styles.dashboard__feedBadge}>
            {isSemanticSearch ? 'AI similar' : 'Newest threads'}
          </span>
        </div>

        {isLoading ? (
          <div className={styles.dashboard__feedBody}>
            <p className={styles['dashboard__state--loading']}>
              {isSemanticSearch
                ? 'Finding similar threads...'
                : 'Loading recent questions...'}
            </p>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className={styles.dashboard__feedBody}>
            <p className={styles['dashboard__state--error']} role='alert'>
              {isSemanticSearch
                ? 'Failed to run AI search.'
                : 'Failed to load questions.'}
            </p>
          </div>
        ) : null}

        {!isLoading && !error && questions.length === 0 ? (
          <div className={styles.dashboard__feedBody}>
            <p className={styles['dashboard__state--empty']}>
              {isSemanticSearch
                ? 'No similar threads found.'
                : 'No questions found. Be the first to ask!'}
            </p>
          </div>
        ) : null}

        {!isLoading && !error && questions.length > 0 ? (
          <ul className={styles.dashboard__list}>
            {questions.map(question => (
              <li key={question.id}>
                <QuestionCard
                  question={question}
                  isOwn={isAuthoredByUser(question, user)}
                  onClick={() =>
                    navigate(`/questions/${question.questionHash}`)
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
