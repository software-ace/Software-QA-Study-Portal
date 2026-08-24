/**
 * practice.js — Untimed drilling with instant feedback.
 *
 * Draws from all 186 official questions (including the appendix questions that
 * are not part of any timed paper) and can be narrowed by chapter, cognitive
 * level or exam set. One question at a time, revealed on demand, so the learner
 * reads the rationale while the question is still fresh.
 */
import { el, mount, markReady, markError, params, byTestId } from '../core/dom.js';
import { renderShell, renderQuestionCard, renderError } from '../core/render.js';
import { TID, tid, STATE } from '../core/testids.js';
import { getQuestionPool, getSyllabus } from '../core/data.js';
import { shuffle, randomSeed } from '../core/rng.js';

const state = {
  pool: [],
  queue: [],
  index: 0,
  selections: new Map(),
  revealed: new Set(),
};

const selectionFor = (ref) => state.selections.get(ref) ?? new Set();

function matches(q, f) {
  if (f.chapter !== 'all' && String(q.chapter) !== f.chapter) return false;
  if (f.kLevel !== 'all' && q.kLevel !== f.kLevel) return false;
  if (f.set !== 'all' && q.set !== f.set) return false;
  if (f.pool === 'exam' && q.additional) return false;
  if (f.pool === 'additional' && !q.additional) return false;
  return true;
}

function readFilters() {
  return {
    chapter: byTestId(TID.filterChapter).value,
    kLevel: byTestId(TID.filterKLevel).value,
    set: byTestId(TID.filterSet).value,
    pool: byTestId(TID.filterPool).value,
  };
}

function onToggle(ref, key) {
  if (state.revealed.has(ref)) return; // answers are locked once revealed
  const q = state.queue[state.index];
  const current = new Set(selectionFor(ref));
  const note = byTestId(tid.limitNote(ref));

  if (q.selectCount === 1) {
    if (current.has(key) && current.size === 1) current.delete(key);
    else { current.clear(); current.add(key); }
  } else if (current.has(key)) {
    current.delete(key);
  } else if (current.size >= q.selectCount) {
    if (note) note.textContent = `You may only select ${q.selectCount} options. Deselect one first.`;
    return;
  } else {
    current.add(key);
  }
  if (note) note.textContent = '';
  state.selections.set(ref, current);
  renderCurrent();
}

function renderCurrent() {
  const host = byTestId(TID.practiceHost);
  if (!host) return;
  const q = state.queue[state.index];
  if (!q) return;

  const revealed = state.revealed.has(q.ref);
  const selected = selectionFor(q.ref);

  const chosen = [...selected].sort().join(',');
  const correct = [...q.correct].sort().join(',');
  const verdict = !revealed ? null : chosen === correct ? STATE.correct : selected.size ? STATE.incorrect : 'unanswered';

  mount(
    host,
    el('div', { class: 'spread', style: 'margin-bottom:12px' }, [
      el('span', { class: 'faint', testid: TID.practicePosition, dataset: { index: String(state.index + 1), total: String(state.queue.length) }, text: `Question ${state.index + 1} of ${state.queue.length}` }),
      el('span', { class: 'badge', text: `Set ${q.set}${q.additional ? ' · appendix' : ''}` }),
    ]),
    renderQuestionCard(q, {
      selected,
      disabled: revealed,
      showAnswers: revealed,
      onToggle,
    }),
    revealed
      ? el('div', { class: 'notice', 'data-tone': verdict === STATE.correct ? null : 'bad', testid: TID.practiceVerdict, dataset: { verdict } }, [
          el('strong', { text: verdict === STATE.correct ? 'Correct. ' : verdict === 'unanswered' ? 'No answer given. ' : 'Not correct. ' }),
          `The official answer is ${q.correct.map((k) => `${k})`).join(' + ')}.`,
          q.explanation ? el('p', { style: 'margin:10px 0 0', text: q.explanation }) : null,
        ])
      : null,
    el('div', { class: 'row', style: 'margin-top:16px' }, [
      el('button', { testid: TID.prevButton, text: '← Previous', disabled: state.index === 0 }),
      revealed
        ? null
        : el('button', { testid: TID.revealButton, 'data-variant': 'primary', text: 'Check answer' }),
      el('button', { testid: TID.nextButton, text: 'Next →', disabled: state.index >= state.queue.length - 1 }),
    ]),
  );

  const prev = byTestId(TID.prevButton);
  const next = byTestId(TID.nextButton);
  const reveal = byTestId(TID.revealButton);
  if (prev) prev.addEventListener('click', () => { state.index = Math.max(0, state.index - 1); renderCurrent(); });
  if (next) next.addEventListener('click', () => { state.index = Math.min(state.queue.length - 1, state.index + 1); renderCurrent(); });
  if (reveal) reveal.addEventListener('click', () => { state.revealed.add(q.ref); renderCurrent(); });

  document.body.dataset.practiceIndex = String(state.index + 1);
  document.body.dataset.practiceRevealed = String(revealed);
}

async function main() {
  const page = renderShell('practice');
  const [{ pool }, syllabus] = await Promise.all([getQuestionPool(), getSyllabus()]);
  state.pool = pool;

  const chapterOpts = [
    el('option', { value: 'all', text: 'All chapters' }),
    ...syllabus.chapters.map((c) => el('option', { value: String(c.number), text: `${c.number}. ${c.title}` })),
  ];
  const kOpts = ['all', 'K1', 'K2', 'K3'].map((k) =>
    el('option', { value: k, text: k === 'all' ? 'All cognitive levels' : k }),
  );
  const setOpts = [
    el('option', { value: 'all', text: 'All exam sets' }),
    ...['A', 'B', 'C', 'D'].map((s) => el('option', { value: s, text: `Set ${s}` })),
  ];
  const poolOpts = [
    el('option', { value: 'all', text: 'All questions' }),
    el('option', { value: 'exam', text: 'Exam questions only' }),
    el('option', { value: 'additional', text: 'Appendix questions only' }),
  ];

  const filters = el('div', { class: 'card', testid: TID.practiceFilters }, [
    el('div', { class: 'grid', style: '--min:200px' }, [
      el('div', { class: 'field', style: 'margin:0' }, [el('label', { text: 'Chapter' }), el('select', { testid: TID.filterChapter, 'aria-label': 'Filter by chapter' }, chapterOpts)]),
      el('div', { class: 'field', style: 'margin:0' }, [el('label', { text: 'Cognitive level' }), el('select', { testid: TID.filterKLevel, 'aria-label': 'Filter by cognitive level' }, kOpts)]),
      el('div', { class: 'field', style: 'margin:0' }, [el('label', { text: 'Exam set' }), el('select', { testid: TID.filterSet, 'aria-label': 'Filter by exam set' }, setOpts)]),
      el('div', { class: 'field', style: 'margin:0' }, [el('label', { text: 'Pool' }), el('select', { testid: TID.filterPool, 'aria-label': 'Filter by question pool' }, poolOpts)]),
    ]),
    el('div', { class: 'row', style: 'margin-top:14px' }, [
      el('button', { testid: TID.practiceStart, 'data-variant': 'primary', text: 'Start practice' }),
      el('span', { class: 'faint', testid: TID.practiceCount }),
    ]),
  ]);

  const host = el('div', { testid: TID.practiceHost });

  mount(
    page,
    el('h1', { text: 'Practice mode' }),
    el('p', { class: 'lede', text: `Untimed drilling across all ${pool.length} official questions, with the ISTQB rationale for every option. Narrow the pool, then work through it at your own pace.` }),
    el('div', { testid: TID.practiceRoot }, [filters, host]),
  );

  const updateCount = () => {
    const f = readFilters();
    const n = state.pool.filter((q) => matches(q, f)).length;
    const label = byTestId(TID.practiceCount);
    label.textContent = `${n} question${n === 1 ? '' : 's'} match`;
    label.dataset.count = String(n);
    byTestId(TID.practiceStart).disabled = n === 0;
  };

  for (const id of [TID.filterChapter, TID.filterKLevel, TID.filterSet, TID.filterPool]) {
    byTestId(id).addEventListener('change', updateCount);
  }

  byTestId(TID.practiceStart).addEventListener('click', () => {
    const f = readFilters();
    const seed = params.has('seed') ? Number(params.get('seed')) : randomSeed();
    state.queue = shuffle(state.pool.filter((q) => matches(q, f)), seed);
    state.index = 0;
    state.selections = new Map();
    state.revealed = new Set();
    renderCurrent();
    host.scrollIntoView({ block: 'start' });
  });

  updateCount();

  // ?start=1 lets automation (and impatient humans) skip the filter step.
  if (params.get('start') === '1') byTestId(TID.practiceStart).click();

  markReady({ page: 'practice', poolSize: String(pool.length) });
}

main().catch((err) => {
  const page = document.querySelector('main .wrap') ?? document.body;
  renderError(page, err.message);
  markError(err.message);
});
