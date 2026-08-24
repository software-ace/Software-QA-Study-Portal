/**
 * testids.js — The locator contract for this portal.
 *
 * THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR ELEMENT LOCATORS.
 *
 * Every interactive element renders a `data-testid` built from these values, so
 * a UI refactor cannot silently rename a locator in one place and not another.
 * Rules we hold ourselves to:
 *
 *   1. Names are stable, lowercase, hyphen-separated, and describe PURPOSE.
 *   2. Dynamic locators key off the question's official number (`question-12`),
 *      never its position on screen -- question order can be shuffled.
 *   3. State is exposed via `data-*` attributes, never via CSS classes, so
 *      assertions never depend on styling.
 *   4. A container's id never shares a naming prefix with the ids it contains,
 *      so a `[data-testid^="question-"]` sweep cannot accidentally match the
 *      list wrapper. Containers are named `*-panel` / `*-table`; items are not.
 *      (`certification-list` alongside `certification-{id}` was exactly this
 *      bug: the sweep matched the container too.)
 */

/** Static, page-level locators. */
export const TID = {
  // Shell -------------------------------------------------------------------
  app: 'app',
  appError: 'app-error',
  siteHeader: 'site-header',
  siteNav: 'site-nav',
  siteFooter: 'site-footer',
  attribution: 'istqb-attribution',
  credit: 'developed-by',

  // Home / catalog ----------------------------------------------------------
  trackList: 'tracks-panel',
  certificationList: 'certifications-panel',

  // Certification chooser ---------------------------------------------------
  chooser: 'chooser-panel',
  chooserHeading: 'chooser-heading',

  // Certification hub -------------------------------------------------------
  examList: 'exams-panel',
  practiceLink: 'practice-link',
  studyLink: 'study-link',
  progressLink: 'progress-link',

  // Candidate gate ----------------------------------------------------------
  resumeNotice: 'resume-notice',
  storageWarning: 'storage-warning',
  nameGate: 'name-gate',
  nameForm: 'candidate-name-form',
  nameInput: 'candidate-name-input',
  nameError: 'candidate-name-error',
  durationSelect: 'exam-duration-select',
  shuffleToggle: 'shuffle-toggle',
  beginExamButton: 'begin-exam-button',

  // Exam runner -------------------------------------------------------------
  examRoot: 'exam-root',
  examTitle: 'exam-title',
  candidateName: 'candidate-name',
  timer: 'exam-timer',
  timeRemaining: 'time-remaining',
  progressText: 'exam-progress',
  answeredCount: 'answered-count',
  questionList: 'questions-panel',
  navigator: 'paper-navigator',
  submitButton: 'submit-exam-button',
  submitDialog: 'submit-confirm-dialog',
  submitConfirm: 'submit-confirm-button',
  submitCancel: 'submit-cancel-button',
  unansweredWarning: 'unanswered-warning',
  timeUpNotice: 'time-up-notice',
  abandonButton: 'abandon-exam-button',

  // Results -----------------------------------------------------------------
  resultsRoot: 'results-root',
  resultCandidate: 'result-candidate-name',
  resultScore: 'result-score',
  resultPoints: 'result-points',
  resultPercent: 'result-percent',
  resultVerdict: 'result-verdict',
  resultDuration: 'result-duration',
  resultPassMark: 'result-pass-mark',
  resultCorrectCount: 'result-correct-count',
  resultIncorrectCount: 'result-incorrect-count',
  resultUnansweredCount: 'result-unanswered-count',
  resultExpiredNote: 'result-expired-note',
  resultsEmpty: 'results-empty',
  chapterBreakdown: 'chapters-breakdown',
  reviewList: 'reviews-panel',
  reviewFilter: 'reviews-filter',
  retakeButton: 'retake-button',
  exportButton: 'export-results-button',

  // Practice ----------------------------------------------------------------
  practiceRoot: 'practice-root',
  practiceFilters: 'practice-filters',
  filterChapter: 'filter-chapter',
  filterKLevel: 'filter-k-level',
  filterSet: 'filter-set',
  filterPool: 'filter-pool',
  practiceCount: 'practice-count',
  practiceHost: 'practice-question-host',
  practicePosition: 'practice-position',
  practiceVerdict: 'practice-verdict',
  practiceStart: 'practice-start-button',
  revealButton: 'reveal-answer-button',
  nextButton: 'next-question-button',
  prevButton: 'prev-question-button',

  // Study / syllabus --------------------------------------------------------
  studyRoot: 'study-root',
  chapterList: 'chapters-panel',
  studySearch: 'study-search',

  // Progress ----------------------------------------------------------------
  progressRoot: 'progress-root',
  attemptList: 'attempts-table',
  attemptEmpty: 'attempts-empty',
  clearHistoryButton: 'clear-history-button',
  weakAreaList: 'weak-areas-table',
};

/**
 * Builders for per-item locators. `ref` is the question's official reference
 * ("12", "A7"), which is stable across shuffling.
 */
export const tid = {
  cert: (id) => `certification-${id}`,
  chooserCard: (id) => `choose-${id}`,
  track: (id) => `track-${id}`,
  navLink: (key) => `nav-${key}`,
  hubCard: (key) => `card-${key}`,
  stat: (key) => `stat-${key}`,
  examCard: (id) => `exam-card-${id}`,
  examStart: (id) => `exam-start-${id}`,

  question: (ref) => `question-${ref}`,
  questionStem: (ref) => `question-${ref}-stem`,
  questionOptions: (ref) => `question-${ref}-options`,
  option: (ref, key) => `question-${ref}-option-${key}`,
  optionInput: (ref, key) => `question-${ref}-option-${key}-input`,
  optionLabel: (ref, key) => `question-${ref}-option-${key}-label`,
  navItem: (ref) => `navigator-${ref}`,
  limitNote: (ref) => `question-${ref}-limit-note`,

  review: (ref) => `review-${ref}`,
  reviewVerdict: (ref) => `review-${ref}-verdict`,
  reviewChosen: (ref) => `review-${ref}-chosen`,
  reviewCorrect: (ref) => `review-${ref}-correct`,
  reviewRationale: (ref, key) => `review-${ref}-rationale-${key}`,

  chapter: (n) => `chapter-${n}`,
  chapterRow: (n) => `chapter-row-${n}`,
  chapterToggle: (n) => `chapter-${n}-toggle`,
  section: (num) => `section-${String(num).replace(/\./g, '-')}`,
  lo: (id) => `lo-${String(id).toLowerCase()}`,
  attempt: (id) => `attempt-${id}`,
  weakArea: (n) => `weak-area-${n}`,
};

/** Values used in `data-state` / `data-verdict` attributes. Assert on these. */
export const STATE = {
  idle: 'idle',
  running: 'running',
  submitted: 'submitted',
  expired: 'expired',
  answered: 'answered',
  unanswered: 'unanswered',
  correct: 'correct',
  incorrect: 'incorrect',
  partial: 'partial',
  passed: 'passed',
  failed: 'failed',
};
