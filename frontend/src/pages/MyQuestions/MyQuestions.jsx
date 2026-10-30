/**
 * MyQuestions: signed-in author's threads (`/my-questions`).
 * Data: `getQuestions({ mine: true })` from question.service.js.
 *
 * @typedef {import('../../types/forum.js').ForumQuestion} ForumQuestion
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import QuestionCard from '../../components/QuestionCard/QuestionCard.jsx';
import { getQuestions } from '../../services/question/question.service.js';
import styles from './MyQuestions.module.css';

/**
 * Lists only the signed-in user's questions.
 *
 * @returns {JSX.Element} Workspace header plus loading, error, empty, or a card list.
 */
export default function MyQuestions() {
  const navigate = useNavigate();
  const [myQuestions, setMyQuestions] = useState(
    /** @type {ForumQuestion[]} */ ([]),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    /**
     * Loads threads authored by the current user.
     *
     * @returns {Promise<void>} Sets `myQuestions` or `error`.
     */
    const loadMyQuestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getQuestions({ mine: true });
        setMyQuestions(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to fetch questions.');
        setMyQuestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMyQuestions();
  }, []);

  return (
    <div className={styles.myQuestions}>
      <section
        className={styles.myQuestions__hero}
        aria-labelledby='my-questions-heading'
      >
        <div className={styles.myQuestions__intro}>
          <p className={styles.myQuestions__eyebrow}>Your workspace</p>
          <h3 id='my-questions-heading' className={styles.myQuestions__heading}>
            Your topics
          </h3>
          <p className={styles.myQuestions__lede}>
            Only questions you created. Open one to read answers or add
            follow-ups. Rows use the same left accent as your threads on Home.
          </p>
        </div>
        <Link to='/questions/ask' className={styles.myQuestions__ask}>
          <Plus size={16} strokeWidth={2.25} aria-hidden />
          New question
        </Link>
      </section>

      {isLoading ? (
        <section className={styles.myQuestions__panel} aria-busy='true'>
          <p className={styles['myQuestions__state--loading']}>
            Loading your questions...
          </p>
        </section>
      ) : null}

      {!isLoading && error ? (
        <section className={styles.myQuestions__panel}>
          <p className={styles['myQuestions__state--error']} role='alert'>
            Failed to fetch questions.
          </p>
        </section>
      ) : null}

      {!isLoading && !error && myQuestions.length === 0 ? (
        <section className={styles.myQuestions__panel}>
          <p className={styles['myQuestions__state--empty']}>
            You have not asked any questions yet. Use Ask a Question in the
            sidebar to start.
          </p>
        </section>
      ) : null}

      {!isLoading && !error && myQuestions.length > 0 ? (
        <ul className={styles.myQuestions__list}>
          {myQuestions.map(question => (
            <li key={question.id}>
              <QuestionCard
                question={question}
                isOwn
                variant='panel'
                onClick={() =>
                  navigate(`/questions/${question.questionHash}`)
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
