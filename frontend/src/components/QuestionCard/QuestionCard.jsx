/**
 * QuestionCard: shared list row for Dashboard and My Questions.
 *
 * @typedef {import('../../types/forum.js').ForumAuthor} ForumAuthor
 * @typedef {import('../../types/forum.js').ForumQuestion} ForumQuestion
 */
import { MessageSquare } from 'lucide-react';
import {
  getAuthorAvatarColor,
  getAuthorInitials,
  timeAgo,
} from '../../lib/utils.js';
import styles from './QuestionCard.module.css';

/**
 * Display name used in the “by …” meta line.
 *
 * @param {ForumQuestion} question - The question payload from the API.
 * @param {boolean} isOwn - True when the signed-in user authored the thread.
 * @returns {string} "You", the author's name, or a fallback.
 */
const getBylineName = (question, isOwn) => {
  if (isOwn) return 'You';
  const name = `${question.author?.firstName ?? ''} ${
    question.author?.lastName ?? ''
  }`.trim();
  return name || 'a learner';
};

/**
 * Renders one question as a clickable feed row or standalone panel.
 *
 * @param {Object} props - Component props.
 * @param {ForumQuestion} props.question - The question payload from the API.
 * @param {() => void} props.onClick - Called when the card is activated (usually navigate to the thread).
 * @param {boolean} [props.isOwn=false] - True for the signed-in author's threads (accent + "Yours" badge).
 * @param {'row'|'panel'} [props.variant='row'] - `row` sits in the Home feed; `panel` is a standalone card on Your topics.
 * @returns {JSX.Element} Avatar, title, snippet, reply count, and relative time.
 */
export default function QuestionCard({
  question,
  onClick,
  isOwn = false,
  variant = 'row',
}) {
  const answerCount = question.answerCount ?? 0;
  const postedAgo = timeAgo(question.createdAt);

  return (
    <button
      type='button'
      className={`${styles.card} ${
        variant === 'panel' ? styles['card--panel'] : ''
      } ${isOwn ? styles['card--own'] : ''}`}
      onClick={onClick}
    >
      <span
        className={styles.card__avatar}
        style={{ backgroundColor: getAuthorAvatarColor(question.author) }}
        aria-hidden
      >
        {getAuthorInitials(question.author)}
      </span>

      <span className={styles.card__body}>
        <span className={styles.card__header}>
          <h4 className={styles.card__title}>{question.title}</h4>
          {isOwn ? <span className={styles.card__yours}>Yours</span> : null}
        </span>

        {question.content ? (
          <p className={styles.card__content}>{question.content}</p>
        ) : null}

        <p className={styles.card__meta}>
          <span className={styles.card__replies}>
            <MessageSquare size={13} strokeWidth={2} aria-hidden />
            {answerCount} {answerCount === 1 ? 'reply' : 'replies'}
          </span>
          {postedAgo ? (
            <>
              {' · '}
              {postedAgo} by {getBylineName(question, isOwn)}
            </>
          ) : null}
        </p>
      </span>
    </button>
  );
}
