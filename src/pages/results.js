/**
 * results.js — Score, verdict and full answer review.
 *
 * The attempt record stores only the grading outcome, so the question content is
 * re-loaded from the exam data set here. That keeps stored attempts small and
 * means a corrected data set immediately improves past reviews.
 */
import { el, mount, markReady, markError, params, byTestId, formatClock } from '../core/dom.js';
import { renderShell, renderStem, renderOptions, renderMeta, renderError, href } from '../core/render.js';
import { TID, tid, STATE } from '../core/testids.js';
import { getManifest, getExam } from '../core/data.js';
import { getAttempt, listAttempts } from '../core/store.js';

const VERDICT_LABEL = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  unanswered: 'Not answered',
};
const VERDICT_TONE = { correct: 'ok', incorrect: 'bad', unanswered: 'warn' };

function statBlock(label, value, testid) {
  return el('div', { class: 'stat' }, [
    el('dt', { text: label }),
    el('dd', { testid, text: String(value) }),
  ]);
}

function chapterTable(attempt, syllabusTitles) {
  return el('div', { class: 'table-scroll' }, [
    el('table', { testid: TID.chapterBreakdown }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Syllabus chapter' }),
          el('th', { class: 'num', text: 'Correct' }),
          el('th', { class: 'num', text: 'Questions' }),
          el('th', { class: 'num', text: 'Score' }),
          el('th', { text: '' }),
        ]),
      ]),
      el(
        'tbody',
        {},
        attempt.chapters.map((c) => {
          const pct = c.count ? Math.round((c.correct / c.count) * 100) : 0;
          return el('tr', { testid: tid.chapterRow(c.chapter), dataset: { chapter: c.chapter, accuracy: String(pct) } }, [
            el('td', { text: `${c.chapter}. ${syllabusTitles.get(c.chapter) ?? ''}` }),
            el('td', { class: 'num', text: String(c.correct) }),
            el('td', { class: 'num', text: String(c.count) }),
            el('td', { class: 'num', text: `${pct}%` }),
            el('td', { style: 'width:110px' }, [
              el('div', { class: 'meter', 'data-tone': pct >= 65 ? 'ok' : 'bad' }, [
                el('span', { style: `width:${pct}%` }),
              ]),
            ]),
          ]);
        }),
      ),
    ]),
  ]);
}

function reviewItem(result, question) {
  const chosenText = result.chosen.length
    ? result.chosen.map((k) => `${k}) ${question.options.find((o) => o.key === k)?.text ?? ''}`).join(' · ')
    : 'No answer given';

  return el(
    'section',
    {
      class: 'review-item',
      id: tid.review(result.ref),
      testid: tid.review(result.ref),
      dataset: { questionRef: result.ref, verdict: result.verdict, chapter: result.chapter },
    },
    [
      el('div', { class: 'question-head' }, [
        el('span', { class: 'question-number', text: `Question ${result.ref}` }),
        el('span', {
          class: 'badge',
          'data-tone': VERDICT_TONE[result.verdict],
          testid: tid.reviewVerdict(result.ref),
          text: VERDICT_LABEL[result.verdict],
        }),
        renderMeta(question),
      ]),
      renderStem(question.stem, result.ref),
      el('p', { class: 'select-hint', text: question.selectCount === 1 ? 'Select ONE option.' : `Select ${question.selectCount} options.` }),
      el('p', { class: 'faint' }, [
        el('strong', { text: 'Your answer: ' }),
        el('span', { testid: tid.reviewChosen(result.ref), dataset: { chosen: result.chosen.join(',') }, text: chosenText }),
      ]),
      el('p', { class: 'faint' }, [
        el('strong', { text: 'Correct answer: ' }),
        el('span', { testid: tid.reviewCorrect(result.ref), dataset: { correct: result.correct.join(',') }, text: result.correct.map((k) => `${k})`).join(' + ') }),
      ]),
      question.explanation ? el('div', { class: 'notice', text: question.explanation }) : null,
      renderOptions(question, {
        selected: new Set(result.chosen),
        disabled: true,
        showAnswers: true,
      }),
    ],
  );
}

async function main() {
  const page = renderShell('ctfl');

  const attemptId = params.get('attempt');
  const attempt = attemptId ? getAttempt(attemptId) : listAttempts()[0];

  if (!attempt) {
    mount(
      page,
      el('h1', { text: 'No results to show' }),
      el('div', { class: 'empty', testid: TID.resultsEmpty }, [
        el('p', { text: 'That attempt could not be found in this browser. Results are stored locally, so they are not available on another device or after clearing site data.' }),
        el('a', { class: 'btn', 'data-variant': 'primary', href: href('ctfl-v4/index.html'), text: 'Back to CTFL v4.0' }),
      ]),
    );
    // Scoping root so automation can narrow queries to this page's content.
  page.setAttribute('data-testid', TID.resultsRoot);

  markReady({ page: 'results', state: 'empty' });
    return;
  }

  const manifest = await getManifest();
  const entry = manifest.exams.find((e) => e.id === attempt.examId) ?? manifest.exams[0];
  const exam = await getExam(entry.file);
  const byRef = new Map(exam.questions.map((q) => [q.ref, q]));

  let syllabusTitles = new Map();
  try {
    const syllabus = await (await fetch(new URL('../../data/ctfl-v4/syllabus.json', import.meta.url))).json();
    syllabusTitles = new Map(syllabus.chapters.map((c) => [c.number, c.title]));
  } catch {
    /* chapter names are a nicety, not a requirement */
  }

  const passed = attempt.passed;

  const banner = el('div', { class: 'verdict-banner', testid: TID.resultVerdict, dataset: { state: passed ? STATE.passed : STATE.failed, passed: String(passed) } }, [
    el('div', { class: 'spread' }, [
      el('div', {}, [
        el('p', { class: 'verdict-title', text: passed ? 'Passed' : 'Not passed' }),
        el('p', { class: 'muted', style: 'margin:0' }, [
          el('strong', { testid: TID.resultCandidate, text: attempt.candidateName || 'Unnamed candidate' }),
          ` · ${attempt.examTitle}`,
        ]),
      ]),
      el('div', { style: 'text-align:right' }, [
        el('div', { class: 'score-big', testid: TID.resultScore }, [
          el('span', { testid: TID.resultPoints, text: `${attempt.awarded}` }),
          `/${attempt.totalPoints}`,
        ]),
        el('div', { class: 'muted', testid: TID.resultPercent, dataset: { percent: String(attempt.percent) }, text: `${attempt.percent}%` }),
      ]),
    ]),
    el('dl', { class: 'stats' }, [
      statBlock('Pass mark', `${attempt.passPoints}/${attempt.totalPoints}`, TID.resultPassMark),
      statBlock('Correct', attempt.counts.correct, TID.resultCorrectCount),
      statBlock('Incorrect', attempt.counts.incorrect, TID.resultIncorrectCount),
      statBlock('Unanswered', attempt.counts.unanswered, TID.resultUnansweredCount),
      statBlock('Time taken', formatClock(attempt.elapsedSeconds), TID.resultDuration),
    ]),
    attempt.expired
      ? el('p', { class: 'faint', style: 'margin:14px 0 0', testid: TID.resultExpiredNote, text: 'The time limit expired and this exam was submitted automatically.' })
      : null,
  ]);

  const filter = el('select', { testid: TID.reviewFilter, 'aria-label': 'Filter reviewed questions' }, [
    el('option', { value: 'all', text: 'All questions' }),
    el('option', { value: 'incorrect', text: 'Incorrect only' }),
    el('option', { value: 'unanswered', text: 'Unanswered only' }),
    el('option', { value: 'correct', text: 'Correct only' }),
  ]);

  const reviewList = el(
    'div',
    { testid: TID.reviewList },
    attempt.results.map((r) => {
      const q = byRef.get(r.ref);
      return q ? reviewItem(r, q) : null;
    }),
  );

  filter.addEventListener('change', () => {
    const want = filter.value;
    for (const node of reviewList.children) {
      node.hidden = want !== 'all' && node.dataset.verdict !== want;
    }
    const shown = [...reviewList.children].filter((n) => !n.hidden).length;
    reviewList.dataset.visibleCount = String(shown);
  });

  const exportButton = el('button', { testid: TID.exportButton, text: 'Export result (JSON)' });
  exportButton.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(attempt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `ctfl-v4-${attempt.examSet}-${attempt.id}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  mount(
    page,
    el('h1', { text: 'Exam results' }),
    banner,
    el('div', { class: 'row', style: 'margin-bottom:24px' }, [
      el('a', {
        class: 'btn',
        'data-variant': 'primary',
        testid: TID.retakeButton,
        href: `${href('ctfl-v4/exam.html')}?exam=${encodeURIComponent(attempt.examId)}`,
        text: 'Retake this set',
      }),
      el('a', { class: 'btn', href: href('ctfl-v4/progress.html'), text: 'View progress' }),
      exportButton,
    ]),
    el('h2', { text: 'Performance by syllabus chapter' }),
    chapterTable(attempt, syllabusTitles),
    el('h2', { text: 'Answer review' }),
    el('p', { class: 'muted' }, [
      'Every question below shows the answer you chose, the official correct answer, and the official ISTQB rationale for each option. Options are marked ',
      el('strong', { text: 'correct' }),
      ', ',
      el('strong', { text: 'incorrect' }),
      ' where you chose wrongly, and outlined where you missed a correct option.',
    ]),
    el('div', { class: 'field', style: 'max-width:260px' }, [filter]),
    reviewList,
  );

  reviewList.dataset.visibleCount = String(attempt.results.length);

  markReady({
    page: 'results',
    state: passed ? STATE.passed : STATE.failed,
    score: String(attempt.awarded),
    percent: String(attempt.percent),
  });
}

main().catch((err) => {
  const page = document.querySelector('main .wrap') ?? document.body;
  renderError(page, err.message);
  markError(err.message);
});
