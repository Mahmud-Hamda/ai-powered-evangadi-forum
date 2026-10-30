/**
 * QuestionDetail: thread view for one question and its answers.
 * Route: `/questions/:questionHash`.
 *
 * @typedef {import('../../types/forum.js').ForumAuthor} ForumAuthor
 * @typedef {import('../../types/forum.js').ForumQuestion} ForumQuestion
 * @typedef {import('../../types/forum.js').ForumAnswer} ForumAnswer
 * @typedef {import('../../types/forum.js').AnswerFitResult} AnswerFitResult
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  Bold,
  Check,
  Code,
  Italic,
  Link2,
  MessageSquare,
  Pencil,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAuthorAvatarColor,
  getAuthorInitials,
} from '../../lib/utils.js';
import {
  assessAnswerFit,
  deleteQuestion,
  generateQuestionDraftCoach,
  getSimilarQuestions,
  getSingleQuestion,
  updateQuestion,
} from '../../services/question/question.service.js';
import {
  deleteAnswer,
  postAnswer,
  updateAnswer,
} from '../../services/answer/answer.service.js';
import styles from './QuestionDetail.module.css';

/** Minimum trimmed answer length required before posting or checking fit. */
const ANSWER_MIN = 20;

/**
 * Formats a posted-on date like the design mock (M/D/YYYY).
 *
 * @param {string|Date} [value] - A `createdAt` value from the API.
 * @returns {string} A numeric locale date, or an empty string when missing.
 */
const formatPostedDate = value => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US');
};

const QUESTION_SECTIONS = [
  "What I'm trying to do",
  'Expected',
  'Actual',
  'Code',
  'Environment',
];

const CODE_LANGUAGES = new Set([
  'javascript',
  'js',
  'typescript',
  'ts',
  'python',
  'java',
  'css',
  'html',
  'json',
  'bash',
  'sql',
]);

/**
 * Marks code-like spans in plain question and answer text.
 * Tags, paths, calls, filenames, route params, and camelCase identifiers.
 * Spans that are already inside backticks are left alone.
 */
const INLINE_CODE_PATTERN =
  /<[A-Za-z][^>\n]{0,160}>|\/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.:{}*-]*[A-Za-z0-9_:{}*-]|\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\b|\b[A-Za-z_$][\w$]*\(\)|\b[\w.-]+\.(?:html|jsx|js|tsx|ts|css|json|py|md|sql)\b|:[A-Za-z_][\w]*|\b[a-z][\w]*[A-Z][\w]*\b|\bbasename\b/g;

/**
 * Wraps code-like spans in backticks, skipping text that is already inline code.
 *
 * @param {string} value - Plain question or answer text.
 * @returns {string} The same text with inline code marked.
 */
const markInlineCode = value => {
  const text = String(value || '');
  let result = '';
  let index = 0;

  while (index < text.length) {
    if (text[index] === '`') {
      const end = text.indexOf('`', index + 1);
      if (end === -1) {
        result += text.slice(index);
        break;
      }
      result += text.slice(index, end + 1);
      index = end + 1;
      continue;
    }

    const fence = text.indexOf('`', index);
    const regionEnd = fence === -1 ? text.length : fence;
    const region = text.slice(index, regionEnd);
    INLINE_CODE_PATTERN.lastIndex = 0;

    let last = 0;
    let match = INLINE_CODE_PATTERN.exec(region);
    while (match) {
      result += region.slice(last, match.index);
      result += `\`${match[0]}\``;
      last = match.index + match[0].length;
      match = INLINE_CODE_PATTERN.exec(region);
    }

    result += region.slice(last);
    index = regionEnd;
  }

  return result;
};

/**
 * Removes a wrapping backtick the author used in place of a code fence.
 *
 * @param {string} line - One line of question or answer text.
 * @returns {string} The line without a leading or trailing backtick.
 */
const stripEdgeBacktick = line => line.replace(/^(\s*)`/, '$1').replace(/`(\s*)$/, '$1');

/**
 * True when a line is a code statement rather than a sentence.
 * A bare name counts when the next line continues it with `.then` or similar.
 *
 * @param {string} line - One line of question or answer text.
 * @param {string[]} [lines] - The full text, split into lines.
 * @param {number} [index] - Index of `line` in `lines`.
 * @returns {boolean} Whether the line should sit in a fenced block.
 */
const isCodeLine = (line, lines = [], index = 0) => {
  const trimmed = stripEdgeBacktick(line).trim();
  if (!trimmed) return false;
  if (
    /^(?:const|let|var|function|class|import|export|async)\b/.test(trimmed) ||
    /^(?:if|else|for|while|switch|try|catch|throw)\b/.test(trimmed) ||
    /=>/.test(trimmed) ||
    /^\./.test(trimmed) ||
    /[;{}]\s*$/.test(trimmed)
  ) {
    return true;
  }

  if (!/^[A-Za-z_$][\w$]*$/.test(trimmed)) return false;
  const next = lines.slice(index + 1).find(item => stripEdgeBacktick(item).trim() !== '');
  return Boolean(next && /^\./.test(stripEdgeBacktick(next).trim()));
};

/**
 * True when a line can open a shaded code block.
 *
 * @param {string} line - One line of question or answer text.
 * @param {string[]} lines - The full text, split into lines.
 * @param {number} index - Index of `line` in `lines`.
 * @returns {boolean} Whether a fenced block should start here.
 */
const startsCodeBlock = (line, lines, index) => {
  if (isCodeLine(line, lines, index)) return true;
  const trimmed = stripEdgeBacktick(line).trim();
  return /^[A-Za-z_$][\w$]*(?:\?\.[\w$]+)*\s*\(/.test(trimmed);
};

/**
 * True when a line still belongs to the code block already in progress.
 * Indented lines and quoted arguments stay inside the block.
 *
 * @param {string} line - One line of question or answer text.
 * @param {string[]} lines - The full text, split into lines.
 * @param {number} index - Index of `line` in `lines`.
 * @returns {boolean} Whether the line stays in the current fence.
 */
const staysInCodeBlock = (line, lines, index) => {
  if (startsCodeBlock(line, lines, index)) return true;
  const trimmed = stripEdgeBacktick(line).trim();
  if (!trimmed) return false;
  if (/^\s+\S/.test(line)) return true;
  if (/^['"`]/.test(trimmed)) return true;
  if (/\?\./.test(trimmed) || /\?\?/.test(trimmed)) return true;
  if (/^[)\]}]+/.test(trimmed)) return true;
  return false;
};

/**
 * Puts runs of code lines in a fenced block so they render in the shaded area.
 * A blank line between two code lines stays inside the block. Other lines stay prose.
 *
 * @param {string} text - Plain question or answer text.
 * @returns {string} Markdown with fenced code where the lines are code.
 */
const fenceCodeLines = text => {
  const lines = String(text || '').split('\n');
  const out = [];
  let index = 0;

  while (index < lines.length) {
    if (!startsCodeBlock(lines[index], lines, index)) {
      out.push(markInlineCode(lines[index]));
      index += 1;
      continue;
    }

    const code = [];
    while (index < lines.length) {
      if (lines[index].trim() === '') {
        let look = index + 1;
        while (look < lines.length && lines[look].trim() === '') look += 1;
        if (look >= lines.length || !staysInCodeBlock(lines[look], lines, look)) break;
        code.push('');
        index += 1;
        continue;
      }
      if (!staysInCodeBlock(lines[index], lines, index)) break;
      const cleaned = stripEdgeBacktick(lines[index]);
      if (cleaned.trim() !== '') code.push(cleaned);
      index += 1;
    }

    if (code.length) out.push('```js', ...code, '```', '');
  }

  return out.join('\n').trim();
};

/**
 * Turns section labels into headings, a Code section into a fence, and an
 * Environment section into a list. Prose between those labels is formatted too.
 *
 * @param {string} text - Plain question or answer text.
 * @returns {string} Markdown for one segment that has no existing fence.
 */
const formatSectionBody = text => {
  const lines = text.split('\n');
  const out = [];
  let index = 0;
  let prose = [];

  const flushProse = () => {
    if (!prose.length) return;
    const formatted = fenceCodeLines(prose.join('\n'));
    if (formatted) out.push(formatted);
    prose = [];
  };

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (!QUESTION_SECTIONS.includes(trimmed)) {
      prose.push(lines[index]);
      index += 1;
      continue;
    }

    flushProse();
    out.push('', `**${trimmed}**`, '');
    index += 1;

    if (trimmed === 'Code') {
      let language = '';
      if (CODE_LANGUAGES.has(lines[index]?.trim().toLowerCase())) {
        language = lines[index].trim().toLowerCase() === 'javascript' ? 'js' : lines[index].trim().toLowerCase();
        index += 1;
      }

      const code = [];
      while (index < lines.length && !QUESTION_SECTIONS.includes(lines[index].trim())) {
        code.push(lines[index]);
        index += 1;
      }
      while (code.length && code[code.length - 1].trim() === '') code.pop();
      out.push(`\`\`\`${language}`, ...code, '```', '');
      continue;
    }

    if (trimmed === 'Environment') {
      while (index < lines.length) {
        const item = lines[index].trim();
        if (!item) {
          index += 1;
          continue;
        }
        if (item.endsWith('?')) break;
        out.push(`- ${item}`);
        index += 1;
      }
      out.push('');
    }
  }

  flushProse();
  return out.join('\n').trim();
};

/**
 * Formats one slice of a question or answer that is not already inside a fence.
 *
 * @param {string} segment - Text outside an existing fenced block.
 * @returns {string} Markdown for that slice.
 */
const formatPlainSegment = segment => {
  if (!String(segment || '').trim()) return segment;
  const withBreaks = segment.replace(/\. {2,}(?=[A-Z])/g, '.\n\n');
  const lines = withBreaks.split('\n');
  const hasSection = lines.some(line => QUESTION_SECTIONS.includes(line.trim()));
  if (!hasSection) return fenceCodeLines(withBreaks);
  return formatSectionBody(withBreaks);
};

/**
 * Turns every question and answer into the markdown the detail page renders.
 * Existing fenced blocks stay as written. The rest gets headings, inline code,
 * and a shaded block wherever the lines are code.
 *
 * @param {string} raw - Question or answer text from the API.
 * @returns {string} Markdown for `ReactMarkdown`.
 */
const formatQuestionMarkdown = raw => {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const fencePattern = /```[\s\S]*?```/g;
  const pieces = [];
  let last = 0;

  for (const match of text.matchAll(fencePattern)) {
    pieces.push(formatPlainSegment(text.slice(last, match.index)));
    pieces.push(match[0]);
    last = match.index + match[0].length;
  }

  pieces.push(formatPlainSegment(text.slice(last)));
  return pieces
    .map(piece => String(piece || '').trim())
    .filter(Boolean)
    .join('\n\n');
};

/**
 * Renders one question or answer body as Markdown.
 *
 * @param {Object} props - Component props.
 * @param {string} [props.content] - Raw question or answer text.
 * @returns {JSX.Element} The formatted body.
 */
function MarkdownBody({ content }) {
  return (
    <div className={styles.detail__markdown}>
      <ReactMarkdown>{formatQuestionMarkdown(content ?? '')}</ReactMarkdown>
    </div>
  );
}

/**
 * Wraps the current textarea selection with markdown markers.
 * `mousedown` on the toolbar is cancelled so the selection is not lost.
 *
 * @param {string} value - The current field text.
 * @param {(next: string) => void} onChange - Replaces the field text.
 * @param {import('react').RefObject<HTMLTextAreaElement | null>} inputRef - The textarea being edited.
 * @param {string} before - Opening markdown (for example `**`).
 * @param {string} [after] - Closing markdown; defaults to `before`.
 * @returns {void}
 */
const applyMarkdown = (value, onChange, inputRef, before, after = before) => {
  const el = inputRef.current;
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  const selected = value.slice(start, end) || 'text';
  const next =
    value.slice(0, start) + before + selected + after + value.slice(end);
  onChange(next);
  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  requestAnimationFrame(() => {
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(cursorStart, cursorEnd);
  });
};

/**
 * Textarea with the same Bold, Italic, Code, and Link toolbar as the reply box.
 *
 * @param {Object} props - Editor props.
 * @param {string} [props.id] - Textarea id.
 * @param {string} props.value - Current markdown text.
 * @param {(next: string) => void} props.onChange - Called with the next text.
 * @param {string} [props.placeholder] - Empty-state hint.
 * @param {number} [props.rows] - Textarea row count.
 * @param {boolean} [props.disabled] - Disables typing and the toolbar.
 * @param {string} [props.ariaLabel] - Accessible name when there is no visible label.
 * @param {import('react').RefObject<HTMLTextAreaElement | null>} props.inputRef - Textarea ref used by the toolbar.
 * @returns {JSX.Element} The toolbar and textarea.
 */
function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder,
  rows = 8,
  disabled = false,
  ariaLabel,
  inputRef,
}) {
  const format = (before, after) => {
    if (disabled) return;
    applyMarkdown(value, onChange, inputRef, before, after);
  };

  return (
    <div className={styles.detail__editor}>
      <div className={styles.detail__toolbar}>
        <div className={styles.detail__toolbarGroup}>
          <button
            type='button'
            className={styles.detail__tool}
            onMouseDown={event => event.preventDefault()}
            onClick={() => format('**')}
            title='Bold'
            disabled={disabled}
          >
            <Bold size={15} />
          </button>
          <button
            type='button'
            className={styles.detail__tool}
            onMouseDown={event => event.preventDefault()}
            onClick={() => format('*')}
            title='Italic'
            disabled={disabled}
          >
            <Italic size={15} />
          </button>
          <span className={styles.detail__toolDivider} />
          <button
            type='button'
            className={styles.detail__tool}
            onMouseDown={event => event.preventDefault()}
            onClick={() => format('\n```js\n', '\n```\n')}
            title='Code block'
            disabled={disabled}
          >
            <Code size={15} />
          </button>
          <button
            type='button'
            className={styles.detail__tool}
            onMouseDown={event => event.preventDefault()}
            onClick={() => format('[', '](url)')}
            title='Link'
            disabled={disabled}
          >
            <Link2 size={15} />
          </button>
        </div>
        <span className={styles.detail__charCount}>{value.length} characters</span>
      </div>
      <textarea
        id={id}
        ref={inputRef}
        className={styles.detail__textarea}
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
  );
}

/**
 * Renders one question thread: body, answers, related topics, and the reply form.
 *
 * @returns {JSX.Element} Loading, error, empty, or the full discussion UI.
 */
export default function QuestionDetail() {
  const { questionHash } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const editContentRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const editAnswerRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const [question, setQuestion] = useState(
    /** @type {ForumQuestion | null} */ (null),
  );
  const [answers, setAnswers] = useState(/** @type {ForumAnswer[]} */ ([]));
  const [related, setRelated] = useState(/** @type {ForumQuestion[]} */ ([]));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState(/** @type {string | null} */ (null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingFit, setIsCheckingFit] = useState(false);
  const [fitResult, setFitResult] = useState(
    /** @type {AnswerFitResult | null} */ (null),
  );
  const [copied, setCopied] = useState(false);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editAnswerId, setEditAnswerId] = useState(/** @type {number | null} */ (null));
  const [editAnswerContent, setEditAnswerContent] = useState('');
  const [actionError, setActionError] = useState(/** @type {string | null} */ (null));
  const [isCoachingEdit, setIsCoachingEdit] = useState(false);
  const [editCoachTips, setEditCoachTips] = useState(
    /** @type {string[]} */ ([]),
  );
  const [isCheckingEditFit, setIsCheckingEditFit] = useState(false);
  const [editFitResult, setEditFitResult] = useState(
    /** @type {AnswerFitResult | null} */ (null),
  );

  /**
   * Loads the question, answers, and up to four related topics.
   *
   * @returns {Promise<void>} Updates `question`, `answers`, and `related` (or `error`).
   */
  const loadQuestion = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSingleQuestion(questionHash);
      setQuestion(data.question);
      setAnswers(Array.isArray(data.answers) ? data.answers : []);

      try {
        const similar = await getSimilarQuestions(questionHash);
        setRelated(Array.isArray(similar) ? similar : []);
      } catch {
        setRelated([]);
      }
    } catch (err) {
      setError(err.message);
      setQuestion(null);
      setAnswers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestion();
  }, [questionHash]);

  const trimmedReply = reply.trim();
  const isAuthor =
    user?.id != null &&
    question?.author?.id != null &&
    Number(user.id) === Number(question.author.id);

  /**
   * Whether the signed-in user wrote this answer.
   *
   * @param {ForumAnswer} answer - One answer on the thread.
   * @returns {boolean} True when `user.id` matches `answer.author.id`.
   */
  const isAnswerOwner = answer =>
    user?.id != null &&
    answer?.author?.id != null &&
    Number(user.id) === Number(answer.author.id);

  /**
   * Copies a sign-in link for this thread. Opening it is left to the user.
   * The link starts on `/auth` and continues to this question after sign-in.
   * The button stays on Copied once the copy succeeds.
   *
   * @param {import('react').MouseEvent<HTMLButtonElement>} event - The share click.
   * @returns {Promise<void>} Sets `copied` true when the link is on the clipboard.
   */
  const handleShare = async event => {
    const url = `${window.location.origin}/auth?next=${encodeURIComponent(`/questions/${questionHash}`)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      event.currentTarget?.blur();
    } catch {
      setCopied(false);
    }
  };

  /**
   * Opens the question edit fields with the current title and body.
   *
   * @returns {void}
   */
  const startEditQuestion = () => {
    setActionError(null);
    setEditCoachTips([]);
    setEditTitle(question.title);
    setEditContent(question.content);
    setIsEditingQuestion(true);
  };

  /**
   * Asks the AI coach for tips on the question being edited.
   *
   * @returns {Promise<void>} Sets `editCoachTips` or `actionError`.
   */
  const handleEditCoach = async () => {
    setActionError(null);
    setEditCoachTips([]);
    if (editTitle.trim().length < 5 || editContent.trim().length < 10) {
      setActionError('Title needs 5+ characters and details need 10+.');
      return;
    }

    setIsCoachingEdit(true);
    try {
      const data = await generateQuestionDraftCoach({
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      setEditCoachTips(Array.isArray(data?.tips) ? data.tips : []);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsCoachingEdit(false);
    }
  };

  /**
   * Saves the edited question title and body.
   *
   * @returns {Promise<void>} Updates `question` or sets `actionError`.
   */
  const handleSaveQuestion = async () => {
    setActionError(null);
    if (editTitle.trim().length < 5 || editContent.trim().length < 10) {
      setActionError('Title needs 5+ characters and details need 10+.');
      return;
    }
    try {
      const updated = await updateQuestion({
        questionHash,
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      setQuestion(updated);
      setEditCoachTips([]);
      setIsEditingQuestion(false);
    } catch (err) {
      setActionError(err.message);
    }
  };

  /**
   * Deletes this question after confirm, then goes to the dashboard.
   *
   * @returns {Promise<void>} Navigates away on success.
   */
  const handleDeleteQuestion = async () => {
    if (!window.confirm('Delete this question? Answers will be removed too.')) {
      return;
    }
    setActionError(null);
    try {
      await deleteQuestion(questionHash);
      navigate('/dashboard');
    } catch (err) {
      setActionError(err.message);
    }
  };

  /**
   * Saves the edited answer body.
   *
   * @param {number} answerId - The answer being saved.
   * @returns {Promise<void>} Replaces that answer in `answers` or sets `actionError`.
   */
  const handleSaveAnswer = async answerId => {
    setActionError(null);
    if (editAnswerContent.trim().length < 3) {
      setActionError('Answer must be at least 3 characters.');
      return;
    }
    try {
      const updated = await updateAnswer({
        answerId,
        content: editAnswerContent.trim(),
      });
      setAnswers(answers =>
        answers.map(answer => (answer.id === answerId ? updated : answer)),
      );
      setEditAnswerId(null);
      setEditAnswerContent('');
    } catch (err) {
      setActionError(err.message);
    }
  };

  /**
   * Deletes an answer after confirm.
   *
   * @param {number} answerId - The answer to remove.
   * @returns {Promise<void>} Drops it from `answers` or sets `actionError`.
   */
  const handleDeleteAnswer = async answerId => {
    if (!window.confirm('Delete this answer?')) {
      return;
    }
    setActionError(null);
    try {
      await deleteAnswer(answerId);
      setAnswers(answers => answers.filter(answer => answer.id !== answerId));
      if (editAnswerId === answerId) {
        setEditAnswerId(null);
      }
    } catch (err) {
      setActionError(err.message);
    }
  };

  /**
   * Asks the AI how well the answer being edited fits this question.
   *
   * @returns {Promise<void>} Sets `editFitResult` or `actionError`.
   */
  const handleCheckEditFit = async () => {
    setActionError(null);
    setEditFitResult(null);
    const trimmed = editAnswerContent.trim();
    if (trimmed.length < ANSWER_MIN) {
      setActionError(`Answer must be at least ${ANSWER_MIN} characters.`);
      return;
    }

    setIsCheckingEditFit(true);
    try {
      const result = await assessAnswerFit(questionHash, trimmed);
      setEditFitResult(result);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsCheckingEditFit(false);
    }
  };

  /**
   * Asks the AI how well the draft reply fits this question.
   *
   * @returns {Promise<void>} Sets `fitResult` (`{ level, note }`) or `replyError`.
   */
  const handleCheckFit = async () => {
    setReplyError(null);
    setFitResult(null);

    if (trimmedReply.length < ANSWER_MIN) {
      setReplyError(`Answer must be at least ${ANSWER_MIN} characters.`);
      return;
    }

    setIsCheckingFit(true);
    try {
      const result = await assessAnswerFit(questionHash, trimmedReply);
      setFitResult(result);
    } catch (err) {
      setReplyError(err.message);
    } finally {
      setIsCheckingFit(false);
    }
  };

  /**
   * Posts the reply as a new answer on this question.
   *
   * @param {import('react').FormEvent<HTMLFormElement>} event - The reply form submit event.
   * @returns {Promise<void>} Appends the created answer or reloads the thread.
   */
  const handleReply = async event => {
    event.preventDefault();
    setReplyError(null);

    if (trimmedReply.length < ANSWER_MIN) {
      setReplyError(`Answer must be at least ${ANSWER_MIN} characters.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await postAnswer({
        questionId: question.id,
        content: trimmedReply,
      });
      if (created) {
        setAnswers(answers => [...answers, created]);
      } else {
        await loadQuestion();
      }
      setReply('');
      setFitResult(null);
    } catch {
      setReplyError('Failed to post answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <p className={styles.detail__pageLoading}>Loading question details...</p>
    );
  }

  if (error || !question) {
    return (
      <div className={styles.detail__pageError}>
        <p role='alert'>Failed to load question details.</p>
        <button
          type='button'
          className={styles.detail__pageErrorButton}
          onClick={() => navigate('/dashboard')}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const fitLevel = fitResult?.level?.toLowerCase();
  const editFitLevel = editFitResult?.level?.toLowerCase();
  const answerCount = answers.length;
  const authorName = [question.author?.firstName, question.author?.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.detail}>
      <button
        type='button'
        className={styles.detail__back}
        onClick={() => navigate('/dashboard')}
      >
        <ArrowLeft size={16} />
        Back to feed
      </button>

      <div className={styles.detail__grid}>
        <div className={styles.detail__main}>
          <article className={styles.detail__question}>
            <div className={styles.detail__authorRow}>
              <div
                className={styles.detail__avatar}
                style={{
                  backgroundColor: getAuthorAvatarColor(question.author),
                }}
                aria-hidden
              >
                {getAuthorInitials(question.author)}
              </div>
              <div>
                <p className={styles.detail__authorName}>{authorName}</p>
                <p className={styles.detail__posted}>
                  Posted {formatPostedDate(question.createdAt)}
                </p>
              </div>
            </div>

            {actionError ? (
              <p className={styles.detail__error} role='alert'>
                {actionError}
              </p>
            ) : null}

            {isEditingQuestion ? (
              <div className={styles.detail__editBox}>
                <input
                  className={styles.detail__editTitle}
                  value={editTitle}
                  onChange={event => {
                    setEditTitle(event.target.value);
                    setEditCoachTips([]);
                  }}
                  aria-label='Question title'
                />
                <MarkdownEditor
                  id='edit-question-content'
                  value={editContent}
                  onChange={next => {
                    setEditContent(next);
                    setEditCoachTips([]);
                  }}
                  rows={8}
                  ariaLabel='Question details'
                  inputRef={editContentRef}
                  placeholder='Describe the problem. You can use Markdown.'
                />
                {editCoachTips.length > 0 ? (
                  <section
                    className={styles.detail__coach}
                    aria-live='polite'
                    aria-label='AI draft feedback'
                  >
                    <h3 className={styles.detail__coachTitle}>AI Feedback</h3>
                    <ul className={styles.detail__coachList}>
                      {editCoachTips.map(tip => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                <div className={styles.detail__editActions}>
                  <button
                    type='button'
                    className={styles.detail__fitButton}
                    onClick={handleEditCoach}
                    disabled={isCoachingEdit}
                  >
                    <Sparkles size={14} />
                    {isCoachingEdit ? 'Getting…' : 'AI suggestions'}
                  </button>
                  <div className={styles.detail__editActionEnd}>
                    <button
                      type='button'
                      className={styles.detail__pill}
                      onClick={() => {
                        setEditCoachTips([]);
                        setIsEditingQuestion(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type='button'
                      className={styles.detail__submit}
                      onClick={handleSaveQuestion}
                      disabled={isCoachingEdit}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h1 className={styles.detail__title}>{question.title}</h1>
                <MarkdownBody content={question.content} />
              </>
            )}

            <div className={styles.detail__pills}>
              <span className={styles.detail__share}>
                <button
                  type='button'
                  className={`${styles.detail__pill} ${
                    copied ? styles.detail__pillCopied : ''
                  }`}
                  onClick={handleShare}
                  aria-label={
                    copied
                      ? 'Copied!'
                      : 'Copy the page link to share this question'
                  }
                >
                  {copied ? <Check size={14} /> : <Share2 size={14} />}
                  {copied ? 'Copied!' : 'Share'}
                </button>
                {copied ? null : (
                  <span className={styles.detail__shareTip} role='tooltip'>
                    Copy the page link to share this question
                  </span>
                )}
              </span>
              <span className={styles.detail__pill}>
                <MessageSquare size={14} />
                {answerCount} {answerCount === 1 ? 'Answer' : 'Answers'}
              </span>
              {isAuthor ? (
                <>
                  <button
                    type='button'
                    className={styles.detail__pill}
                    onClick={startEditQuestion}
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button
                    type='button'
                    className={styles.detail__pillDanger}
                    onClick={handleDeleteQuestion}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          </article>

          <section>
            <h2 className={styles.detail__sectionTitle}>
              Community Answers ({answerCount})
            </h2>

            {answerCount === 0 ? (
              isAuthor ? (
                <p className={styles.detail__ownQuestion}>
                  You asked this question, so you cannot post an answer here.
                </p>
              ) : (
                <div className={styles.detail__empty}>
                  <MessageSquare size={28} />
                  <p className={styles.detail__emptyTitle}>
                    Be the first to help!
                  </p>
                  <p className={styles.detail__emptyCopy}>
                    This question is waiting for an expert like you. Share your
                    knowledge and earn reputation points.
                  </p>
                </div>
              )
            ) : (
              <ul className={styles.detail__list}>
                {answers.map(answer => (
                  <li key={answer.id} className={styles.detail__answer}>
                    <div className={styles.detail__authorRow}>
                      <div
                        className={styles.detail__avatar}
                        style={{
                          backgroundColor: getAuthorAvatarColor(answer.author),
                        }}
                        aria-hidden
                      >
                        {getAuthorInitials(answer.author)}
                      </div>
                      <div>
                        <p className={styles.detail__authorName}>
                          {answer.author?.firstName} {answer.author?.lastName}
                        </p>
                        <p className={styles.detail__posted}>
                          {formatPostedDate(answer.createdAt)}
                        </p>
                      </div>
                    </div>
                    {editAnswerId === answer.id ? (
                      <div className={styles.detail__editBox}>
                        <MarkdownEditor
                          id={`edit-answer-${answer.id}`}
                          value={editAnswerContent}
                          onChange={next => {
                            setEditAnswerContent(next);
                            setEditFitResult(null);
                          }}
                          rows={8}
                          ariaLabel='Edit answer'
                          inputRef={editAnswerRef}
                          placeholder='Type your answer here… You can use Markdown to format your code!'
                          disabled={isCheckingEditFit}
                        />
                        {editFitResult ? (
                          <div
                            className={`${styles.detail__fit} ${
                              styles[`detail__fit--${editFitLevel}`] ?? ''
                            }`}
                          >
                            <p className={styles.detail__fitLevel}>
                              Answer fit: {editFitResult.level}
                            </p>
                            {editFitResult.note ? (
                              <p>{editFitResult.note}</p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className={styles.detail__editActions}>
                          <button
                            type='button'
                            className={styles.detail__fitButton}
                            onClick={handleCheckEditFit}
                            disabled={isCheckingEditFit}
                          >
                            <Sparkles size={14} />
                            {isCheckingEditFit
                              ? 'Checking…'
                              : 'Check draft fit'}
                          </button>
                          <div className={styles.detail__editActionEnd}>
                            <button
                              type='button'
                              className={styles.detail__pill}
                              onClick={() => {
                                setEditFitResult(null);
                                setEditAnswerId(null);
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type='button'
                              className={styles.detail__submit}
                              onClick={() => handleSaveAnswer(answer.id)}
                              disabled={isCheckingEditFit}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <MarkdownBody content={answer.content} />
                    )}
                    {isAnswerOwner(answer) ? (
                      <div className={styles.detail__pills}>
                        <button
                          type='button'
                          className={styles.detail__pill}
                          onClick={() => {
                            setActionError(null);
                            setEditFitResult(null);
                            setEditAnswerId(answer.id);
                            setEditAnswerContent(answer.content);
                          }}
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type='button'
                          className={styles.detail__pillDanger}
                          onClick={() => handleDeleteAnswer(answer.id)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!isAuthor && (
            <form
              className={styles.detail__form}
              onSubmit={handleReply}
              aria-busy={isSubmitting || isCheckingFit}
            >
              <h2 className={styles.detail__formTitle}>Contribute an answer</h2>

              {replyError ? (
                <p className={styles.detail__replyError} role='alert'>
                  {replyError}
                </p>
              ) : null}

              <MarkdownEditor
                id='answer-content'
                value={reply}
                onChange={next => {
                  setReply(next);
                  setFitResult(null);
                }}
                rows={8}
                disabled={isSubmitting || isCheckingFit}
                inputRef={textareaRef}
                placeholder='Type your answer here… You can use Markdown to format your code!'
              />

              {fitResult ? (
                <div
                  className={`${styles.detail__fit} ${
                    styles[`detail__fit--${fitLevel}`] ?? ''
                  }`}
                >
                  <p className={styles.detail__fitLevel}>
                    Answer fit: {fitResult.level}
                  </p>
                  {fitResult.note ? <p>{fitResult.note}</p> : null}
                </div>
              ) : null}

              <div className={styles.detail__formFooter}>
                <div className={styles.detail__fitRow}>
                  <button
                    type='button'
                    className={styles.detail__fitButton}
                    onClick={handleCheckFit}
                    disabled={isSubmitting || isCheckingFit}
                  >
                    <Sparkles size={14} />
                    {isCheckingFit ? 'Checking…' : 'Check draft fit'}
                  </button>
                  <p className={styles.detail__fitHint}>
                    Relevance only. Not grading correctness. You need at least{' '}
                    {ANSWER_MIN} characters.
                  </p>
                </div>
                <button
                  type='submit'
                  className={styles.detail__submit}
                  disabled={isSubmitting || isCheckingFit}
                >
                  {isSubmitting ? 'Posting...' : 'Post Your Answer'}
                </button>
              </div>
            </form>
          )}
        </div>

        <aside className={styles.detail__related}>
          <h2 className={styles.detail__relatedTitle}>Related Questions</h2>
          {related.length === 0 ? (
            <p className={styles.detail__relatedEmpty}>
              No related questions yet.
            </p>
          ) : (
            <ul className={styles.detail__relatedList}>
              {related.map(item => (
                <li key={item.id}>
                  <Link
                    to={`/questions/${item.questionHash}`}
                    className={styles.detail__relatedCard}
                  >
                    <p className={styles.detail__relatedQuestion}>
                      {item.title}
                    </p>
                    <p className={styles.detail__relatedMeta}>
                      <span>
                        {[item.author?.firstName, item.author?.lastName]
                          .filter(Boolean)
                          .join(' ') || 'a learner'}
                      </span>
                      <span>{formatPostedDate(item.createdAt)}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
