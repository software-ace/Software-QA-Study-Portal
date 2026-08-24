/**
 * Unit tests for the scoring engine. Run: node --test tests/
 *
 * Scoring is the one place a bug would actively harm a learner -- a wrongly
 * credited answer teaches the wrong thing -- so it is tested directly rather
 * than through the UI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamEngine, VERDICT } from '../src/core/engine.js';
import { shuffle, createRng } from '../src/core/rng.js';

const RULES = {
  questionCount: 3,
  totalPoints: 3,
  passPoints: 2,
  passPercent: 65,
  durationMinutes: 60,
  extendedDurationMinutes: 75,
};

const q = (ref, correct, selectCount = 1, chapter = 1, optionKeys = ['a', 'b', 'c', 'd']) => ({
  id: `t-${ref}`,
  ref,
  label: `#${ref}`,
  number: Number(ref),
  additional: false,
  points: 1,
  selectCount,
  chapter,
  learningObjective: `FL-${chapter}.1.1`,
  kLevel: 'K2',
  stem: [{ type: 'para', text: `Question ${ref}` }],
  options: optionKeys.map((k) => ({ key: k, text: `option ${k}`, correct: correct.includes(k), rationale: `why ${k}` })),
  correct,
});

const makeExam = (questions) => ({
  id: 'test-exam',
  set: 'T',
  title: 'Test Exam',
  rules: RULES,
  questions,
});

const single = () => makeExam([q('1', ['c']), q('2', ['a'], 1, 2), q('3', ['d'], 1, 3)]);

test('single-answer: exact match is credited', () => {
  const e = new ExamEngine(single(), { candidateName: 'Ada' });
  e.toggle('1', 'c');
  const s = e.submit();
  assert.equal(s.results.find((r) => r.ref === '1').verdict, VERDICT.correct);
  assert.equal(s.awarded, 1);
});

test('single-answer: selecting a second option replaces the first (radio behaviour)', () => {
  const e = new ExamEngine(single(), {});
  e.toggle('1', 'a');
  e.toggle('1', 'c');
  assert.deepEqual([...e.getSelection('1')], ['c']);
});

test('single-answer: clicking the selected option deselects it', () => {
  const e = new ExamEngine(single(), {});
  e.toggle('1', 'c');
  e.toggle('1', 'c');
  assert.equal(e.getSelection('1').size, 0);
  assert.equal(e.submit().results[0].verdict, VERDICT.unanswered);
});

test('unanswered scores zero and is reported separately from incorrect', () => {
  const e = new ExamEngine(single(), {});
  e.toggle('1', 'a'); // wrong
  const s = e.submit();
  assert.equal(s.counts.incorrect, 1);
  assert.equal(s.counts.unanswered, 2);
  assert.equal(s.counts.correct, 0);
  assert.equal(s.awarded, 0);
});

test('multi-answer: all-or-nothing — a partially correct set earns no point', () => {
  const exam = makeExam([q('1', ['a', 'e'], 2, 1, ['a', 'b', 'c', 'd', 'e'])]);
  const e = new ExamEngine(exam, {});
  e.toggle('1', 'a');
  const s = e.submit();
  assert.equal(s.results[0].verdict, VERDICT.incorrect);
  assert.equal(s.awarded, 0);
});

test('multi-answer: the exact correct set earns the point regardless of click order', () => {
  const exam = makeExam([q('1', ['a', 'e'], 2, 1, ['a', 'b', 'c', 'd', 'e'])]);
  const e = new ExamEngine(exam, {});
  e.toggle('1', 'e');
  e.toggle('1', 'a');
  const s = e.submit();
  assert.equal(s.results[0].verdict, VERDICT.correct);
  assert.equal(s.awarded, 1);
});

test('multi-answer: cannot select more than selectCount', () => {
  const exam = makeExam([q('1', ['a', 'e'], 2, 1, ['a', 'b', 'c', 'd', 'e'])]);
  const e = new ExamEngine(exam, {});
  e.toggle('1', 'a');
  e.toggle('1', 'b');
  const third = e.toggle('1', 'c');
  assert.equal(third.changed, false);
  assert.equal(third.reason, 'limit-reached');
  assert.deepEqual([...e.getSelection('1')].sort(), ['a', 'b']);
});

test('multi-answer counts as complete only at the required number', () => {
  const exam = makeExam([q('1', ['a', 'e'], 2, 1, ['a', 'b', 'c', 'd', 'e'])]);
  const e = new ExamEngine(exam, {});
  e.toggle('1', 'a');
  assert.equal(e.answeredCount, 1);
  assert.equal(e.completeCount, 0);
  assert.equal(e.unanswered.length, 1);
  e.toggle('1', 'e');
  assert.equal(e.completeCount, 1);
  assert.equal(e.unanswered.length, 0);
});

test('pass mark uses the official 26/40 threshold, not a rounded percentage', () => {
  const questions = Array.from({ length: 40 }, (_, i) => q(String(i + 1), ['a'], 1, (i % 6) + 1));
  const exam = makeExam(questions);
  exam.rules = { ...RULES, questionCount: 40, totalPoints: 40, passPoints: 26 };

  const at25 = new ExamEngine(exam, {});
  questions.slice(0, 25).forEach((x) => at25.toggle(x.ref, 'a'));
  assert.equal(at25.submit().passed, false, '25/40 must fail');

  const at26 = new ExamEngine(exam, {});
  questions.slice(0, 26).forEach((x) => at26.toggle(x.ref, 'a'));
  const s26 = at26.submit();
  assert.equal(s26.passed, true, '26/40 must pass');
  assert.equal(s26.percent, 65);
});

test('chapter breakdown totals reconcile with the overall score', () => {
  const e = new ExamEngine(single(), {});
  e.toggle('1', 'c');
  e.toggle('2', 'a');
  const s = e.submit();
  assert.equal(s.chapters.reduce((t, c) => t + c.awarded, 0), s.awarded);
  assert.equal(s.chapters.reduce((t, c) => t + c.points, 0), s.totalPoints);
  assert.equal(s.chapters.reduce((t, c) => t + c.count, 0), s.counts.total);
});

test('time up: expiry is recorded and answers are frozen', () => {
  const e = new ExamEngine(single(), { startedAt: Date.now() - 61 * 60_000 });
  assert.equal(e.isTimeUp(), true);
  assert.equal(e.secondsRemaining(), 0);
  const s = e.submit({ expired: true });
  assert.equal(s.expired, true);
  assert.equal(e.toggle('1', 'c').changed, false, 'no edits after submission');
});

test('the chosen answers are preserved for the review screen', () => {
  const e = new ExamEngine(single(), {});
  e.toggle('1', 'b'); // wrong on purpose
  const r = e.submit().results.find((x) => x.ref === '1');
  assert.deepEqual(r.chosen, ['b']);
  assert.deepEqual(r.correct, ['c']);
});

test('a session round-trips through persistence without losing answers', () => {
  const e = new ExamEngine(single(), { candidateName: 'Grace Hopper', seed: 7, shuffleQuestions: true });
  e.toggle('1', 'c');
  e.toggle('2', 'b');
  const restored = ExamEngine.fromSession(single(), e.toSession());
  assert.equal(restored.candidateName, 'Grace Hopper');
  assert.equal(restored.seed, 7);
  assert.deepEqual([...restored.getSelection('1')], ['c']);
  assert.deepEqual([...restored.getSelection('2')], ['b']);
  assert.deepEqual(
    restored.questions.map((x) => x.ref),
    e.questions.map((x) => x.ref),
    'same seed must reproduce the same question order',
  );
});

test('additional (appendix) questions are excluded from the timed exam', () => {
  const exam = makeExam([q('1', ['a']), { ...q('A1', ['b']), additional: true }]);
  const e = new ExamEngine(exam, {});
  assert.equal(e.questions.length, 1);
  assert.equal(e.questions[0].ref, '1');
});

test('seeded shuffle is deterministic and is a true permutation', () => {
  const items = Array.from({ length: 40 }, (_, i) => i);
  assert.deepEqual(shuffle(items, 123), shuffle(items, 123));
  assert.notDeepEqual(shuffle(items, 123), shuffle(items, 124));
  assert.deepEqual([...shuffle(items, 99)].sort((a, b) => a - b), items);
});

test('rng stays within [0,1)', () => {
  const rng = createRng(42);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});
