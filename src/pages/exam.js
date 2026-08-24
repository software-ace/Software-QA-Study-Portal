/**
 * exam.js — The timed exam runner.
 *
 * Flow: name gate -> timed question paper -> confirm -> score -> results page.
 *
 * Two deliberate design choices:
 *
 *  - The clock is derived from a stored deadline (`startedAt + duration`), never
 *    from counting ticks. Browsers throttle timers in background tabs, so a
 *    tick-counted clock would silently hand candidates extra minutes.
 *  - The in-flight session is persisted on every answer, so a refresh or a
 *    closed tab does not destroy an attempt. Reloading resumes with the real
 *    remaining time rather than restarting the clock.
 */
import { el, mount, byTestId, markReady, markError, params, formatClock } from '../core/dom.js';
import { renderShell, renderQuestionCard, renderError, href } from '../core/render.js';
import { TID, tid, STATE } from '../core/testids.js';
import { getManifest, getExam } from '../core/data.js';
import { ExamEngine } from '../core/engine.js';
import { randomSeed } from '../core/rng.js';
import {
  saveSession, loadSession, clearSession, saveAttempt,
  rememberName, recallName, storageAvailable,
} from '../core/store.js';

const MIN_NAME = 2;
const MAX_NAME = 80;

let engine = null;
let timerHandle = null;
let page = null;
let manifest = null;

const newAttemptId = () =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

// --- name gate -------------------------------------------------------------

function renderNameGate(exam) {
  const rules = exam.rules;

  const input = el('input', {
    type: 'text',
    id: TID.nameInput,
    testid: TID.nameInput,
    name: 'candidateName',
    value: recallName(),
    placeholder: 'e.g. Ada Lovelace',
    autocomplete: 'name',
    required: true,
    maxlength: String(MAX_NAME),
    'aria-describedby': `${TID.nameInput}-hint ${TID.nameError}`,
  });

  const error = el('p', { class: 'field-error', id: TID.nameError, testid: TID.nameError, role: 'alert' });

  const duration = el('select', { id: TID.durationSelect, testid: TID.durationSelect, name: 'duration' }, [
    el('option', { value: String(rules.durationMinutes), text: `${rules.durationMinutes} minutes (standard)` }),
    el('option', { value: String(rules.extendedDurationMinutes), text: `${rules.extendedDurationMinutes} minutes (+25%, non-native language)` }),
  ]);

  const shuffleBox = el('input', { type: 'checkbox', id: TID.shuffleToggle, testid: TID.shuffleToggle, name: 'shuffle' });

  const form = el(
    'form',
    { testid: TID.nameForm, novalidate: true, autocomplete: 'off' },
    [
      el('div', { class: 'field' }, [
        el('label', { for: TID.nameInput, text: 'Full name' }),
        input,
        el('p', {
          class: 'field-hint',
          id: `${TID.nameInput}-hint`,
          text: 'Shown on your result and stored only in this browser. Nothing is uploaded anywhere.',
        }),
        error,
      ]),
      el('div', { class: 'field' }, [
        el('label', { for: TID.durationSelect, text: 'Time allowed' }),
        duration,
      ]),
      el('div', { class: 'field checkbox-row' }, [
        shuffleBox,
        el('label', { for: TID.shuffleToggle, text: 'Shuffle question order' }),
      ]),
      el('button', {
        type: 'submit',
        testid: TID.beginExamButton,
        'data-variant': 'primary',
        text: `Begin exam — ${exam.set}`,
      }),
    ],
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = input.value.trim().replace(/\s+/g, ' ');

    if (name.length < MIN_NAME) {
      error.textContent = 'Please enter your full name to start the exam.';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    rememberName(name);

    startExam(exam, {
      candidateName: name,
      durationMinutes: Number(duration.value),
      shuffleQuestions: shuffleBox.checked,
      seed: params.has('seed') ? Number(params.get('seed')) : randomSeed(),
    });
  });

  mount(
    page,
    el('h1', { text: exam.title }),
    el('p', { class: 'lede', text: `${exam.counts.exam} questions · ${rules.totalPoints} points · pass mark ${rules.passPoints}/${rules.totalPoints} (${rules.passPercent}%). The clock starts as soon as you begin.` }),
    !storageAvailable
      ? el('div', { class: 'notice', 'data-tone': 'warn', testid: TID.storageWarning }, [
          el('strong', { text: 'Storage unavailable. ' }),
          'Your browser is blocking local storage, so this attempt cannot be saved or resumed after a refresh.',
        ])
      : null,
    el('div', { class: 'card', testid: TID.nameGate, style: 'max-width:560px' }, [form]),
  );

  input.focus();
  markReady({ page: 'exam', state: STATE.idle, examId: exam.id });
}

// --- exam paper ------------------------------------------------------------

function startExam(exam, opts) {
  engine = new ExamEngine(exam, opts);
  exam.__file = exam.__file ?? null;
  persist();
  renderPaper(exam);
}

function persist() {
  if (!engine) return;
  const session = engine.toSession();
  session.examFile = engine.exam.__file;
  saveSession(session);
}

function navigatorStrip() {
  return el(
    'nav',
    { class: 'navigator', testid: TID.navigator, 'aria-label': 'Question navigator' },
    engine.questions.map((q, i) => {
      const size = engine.getSelection(q.ref).size;
      const state = size === 0 ? STATE.unanswered : size === q.selectCount ? STATE.answered : STATE.partial;
      return el('a', {
        href: `#${tid.question(q.ref)}`,
        testid: tid.navItem(q.ref),
        text: String(i + 1),
        dataset: { state, questionRef: q.ref },
        'aria-label': `Question ${i + 1}, ${state}`,
      });
    }),
  );
}

function refreshProgress() {
  const complete = engine.completeCount;
  const total = engine.questions.length;

  const answered = byTestId(TID.answeredCount);
  if (answered) {
    answered.textContent = `${complete} of ${total} answered`;
    answered.dataset.answered = String(complete);
    answered.dataset.total = String(total);
  }

  const nav = byTestId(TID.navigator);
  if (nav) nav.replaceWith(navigatorStrip());

  document.body.dataset.answeredCount = String(complete);
}

function onToggle(ref, key) {
  const result = engine.toggle(ref, key);
  const note = byTestId(tid.limitNote(ref));

  if (!result.changed && result.reason === 'limit-reached') {
    const q = engine.questions.find((x) => x.ref === ref);
    if (note) note.textContent = `You may only select ${q.selectCount} options. Deselect one first.`;
    return;
  }
  if (note) note.textContent = '';

  // Re-render just this question so option state stays in sync with the engine.
  const card = byTestId(tid.question(ref));
  const q = engine.questions.find((x) => x.ref === ref);
  const index = engine.questions.indexOf(q) + 1;
  if (card && q) {
    card.replaceWith(
      renderQuestionCard(q, {
        index,
        total: engine.questions.length,
        selected: engine.getSelection(ref),
        onToggle,
      }),
    );
  }
  refreshProgress();
  persist();
}

function renderPaper(exam) {
  const dialog = el('dialog', { testid: TID.submitDialog }, [
    el('h2', { style: 'margin-top:0', text: 'Submit your exam?' }),
    el('p', { class: 'muted', testid: TID.unansweredWarning }),
    el('div', { class: 'row' }, [
      el('button', { testid: TID.submitConfirm, 'data-variant': 'primary', text: 'Submit and see results' }),
      el('button', { testid: TID.submitCancel, text: 'Keep working' }),
    ]),
  ]);

  const submitButton = el('button', {
    testid: TID.submitButton,
    'data-variant': 'primary',
    text: 'Submit exam',
  });

  const bar = el('div', { class: 'exam-bar', testid: TID.examRoot, dataset: { state: STATE.running, examId: exam.id } }, [
    el('div', { class: 'spread' }, [
      el('div', {}, [
        el('div', { class: 'row' }, [
          el('strong', { testid: TID.candidateName, text: engine.candidateName }),
          el('span', { class: 'badge', 'data-tone': 'accent', text: `Set ${exam.set}` }),
        ]),
        el('div', { class: 'faint', testid: TID.progressText }, [
          el('span', { testid: TID.answeredCount, text: `0 of ${engine.questions.length} answered` }),
        ]),
      ]),
      el('div', { class: 'row' }, [
        el('div', { style: 'text-align:right' }, [
          el('div', { class: 'faint', text: 'Time remaining' }),
          el('div', {
            class: 'timer',
            testid: TID.timer,
            role: 'timer',
            'aria-live': 'off',
          }, [el('span', { testid: TID.timeRemaining, text: formatClock(engine.secondsRemaining()) })]),
        ]),
        submitButton,
      ]),
    ]),
    navigatorStrip(),
  ]);

  mount(
    page,
    el('h1', { class: 'sr-only', testid: TID.examTitle, text: exam.title }),
    bar,
    el('div', { class: 'notice', testid: TID.timeUpNotice, 'data-tone': 'bad', hidden: true }, [
      el('strong', { text: "Time is up. " }),
      'Your exam was submitted automatically.',
    ]),
    el(
      'div',
      { testid: TID.questionList },
      engine.questions.map((q, i) =>
        renderQuestionCard(q, {
          index: i + 1,
          total: engine.questions.length,
          selected: engine.getSelection(q.ref),
          onToggle,
        }),
      ),
    ),
    el('div', { class: 'row', style: 'margin-top:20px' }, [
      el('button', { testid: TID.abandonButton, 'data-variant': 'danger', text: 'Abandon exam' }),
    ]),
    dialog,
  );

  // --- submission wiring ---------------------------------------------------
  submitButton.addEventListener('click', () => {
    // "Blank" and "partly answered" are different problems and both score zero,
    // so report them separately rather than lumping them together.
    const blank = engine.questions.filter((q) => engine.getSelection(q.ref).size === 0);
    const partial = engine.questions.filter((q) => {
      const n = engine.getSelection(q.ref).size;
      return n > 0 && n < q.selectCount;
    });

    const parts = [];
    if (blank.length) parts.push(`${blank.length} unanswered (${blank.map((q) => q.label).join(', ')})`);
    if (partial.length) {
      parts.push(
        `${partial.length} only partly answered (${partial
          .map((q) => `${q.label} needs ${q.selectCount}`)
          .join(', ')})`,
      );
    }

    const warning = byTestId(TID.unansweredWarning);
    warning.textContent = parts.length
      ? `${parts.join('; ')}. Both score zero.`
      : 'All questions are fully answered.';
    warning.dataset.unanswered = String(blank.length);
    warning.dataset.partial = String(partial.length);
    warning.dataset.incomplete = String(blank.length + partial.length);
    dialog.showModal();
  });

  byTestId(TID.submitCancel).addEventListener('click', () => dialog.close());
  byTestId(TID.submitConfirm).addEventListener('click', () => {
    dialog.close();
    finish({ expired: false });
  });

  byTestId(TID.abandonButton).addEventListener('click', () => {
    if (!window.confirm('Abandon this exam? Your answers will be discarded.')) return;
    stopTimer();
    clearSession();
    location.assign(href('ctfl-v4/index.html'));
  });

  refreshProgress();
  startTimer();
  markReady({ page: 'exam', state: STATE.running, examId: exam.id, questionCount: engine.questions.length });
}

// --- clock -----------------------------------------------------------------

function startTimer() {
  stopTimer();
  const tick = () => {
    if (!engine || engine.isFinished()) return;
    const remaining = engine.secondsRemaining();
    const label = byTestId(TID.timeRemaining);
    const timer = byTestId(TID.timer);
    if (label) label.textContent = formatClock(remaining);
    if (timer) {
      timer.dataset.secondsRemaining = String(remaining);
      timer.dataset.tone = remaining <= 60 ? 'danger' : remaining <= 300 ? 'warn' : 'normal';
    }
    if (remaining <= 0) finish({ expired: true });
  };
  tick();
  timerHandle = window.setInterval(tick, 250);
}

const stopTimer = () => {
  if (timerHandle) window.clearInterval(timerHandle);
  timerHandle = null;
};

// --- finishing -------------------------------------------------------------

function finish({ expired }) {
  if (!engine || engine.isFinished()) return;
  stopTimer();

  const score = engine.submit({ expired });
  const attempt = { id: newAttemptId(), ...score };

  saveAttempt(attempt);
  clearSession();

  const root = byTestId(TID.examRoot);
  if (root) root.dataset.state = expired ? STATE.expired : STATE.submitted;
  document.body.dataset.examState = expired ? STATE.expired : STATE.submitted;

  if (expired) {
    const notice = byTestId(TID.timeUpNotice);
    if (notice) notice.hidden = false;
  }

  location.assign(`${href('ctfl-v4/results.html')}?attempt=${encodeURIComponent(attempt.id)}`);
}

// --- bootstrap -------------------------------------------------------------

async function main() {
  page = renderShell('ctfl');
  manifest = await getManifest();

  const wanted = params.get('exam');
  const resuming = params.get('resume') === '1';

  if (resuming) {
    const session = loadSession();
    if (session && !session.submittedAt) {
      const entry = manifest.exams.find((e) => e.id === session.examId) ?? manifest.exams[0];
      const exam = await getExam(entry.file);
      exam.__file = entry.file;
      engine = ExamEngine.fromSession(exam, session);
      // A resumed exam whose deadline already passed is submitted immediately.
      if (engine.isTimeUp()) {
        renderPaper(exam);
        finish({ expired: true });
        return;
      }
      renderPaper(exam);
      return;
    }
  }

  const entry = manifest.exams.find((e) => e.id === wanted) ?? manifest.exams[0];
  const exam = await getExam(entry.file);
  exam.__file = entry.file;
  renderNameGate(exam);
}

// Warn before leaving mid-exam; answers are saved, but people should know.
window.addEventListener('beforeunload', (event) => {
  if (engine && !engine.isFinished() && engine.answeredCount > 0) {
    event.preventDefault();
    event.returnValue = '';
  }
});

main().catch((err) => {
  renderError(page ?? document.body, err.message);
  markError(err.message);
});
