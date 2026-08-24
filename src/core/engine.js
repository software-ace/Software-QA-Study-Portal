/**
 * engine.js — Exam state and scoring. Pure logic, no DOM.
 *
 * Kept free of rendering so it can be unit-tested in Node (see tests/) and so
 * scoring correctness is verifiable independently of the UI.
 *
 * SCORING RULE: a question is credited only when the selected set matches the
 * official answer set exactly. ISTQB "Select TWO options" questions are worth
 * one point and award no partial credit, so neither do we. Getting this wrong
 * in the lenient direction would flatter the learner and mislead them about
 * their readiness.
 */
import { shuffle, randomSeed } from './rng.js';

export const VERDICT = {
  correct: 'correct',
  incorrect: 'incorrect',
  unanswered: 'unanswered',
};

export class ExamEngine {
  /**
   * @param {object} exam       parsed exam JSON (data/ctfl-v4/exam-x.json)
   * @param {object} opts
   * @param {string} opts.candidateName
   * @param {number} [opts.durationMinutes]
   * @param {boolean} [opts.shuffleQuestions]
   * @param {number} [opts.seed]
   * @param {number} [opts.startedAt]  epoch ms, for restoring a session
   * @param {object} [opts.answers]    ref -> array of option keys
   */
  constructor(exam, opts = {}) {
    this.exam = exam;
    this.rules = exam.rules;
    this.candidateName = opts.candidateName ?? '';
    this.durationMinutes = opts.durationMinutes ?? exam.rules.durationMinutes;
    this.seed = opts.seed ?? randomSeed();
    this.shuffleQuestions = Boolean(opts.shuffleQuestions);

    const examQuestions = exam.questions.filter((q) => !q.additional);
    this.questions = this.shuffleQuestions ? shuffle(examQuestions, this.seed) : examQuestions;

    this.startedAt = opts.startedAt ?? Date.now();
    this.deadline = this.startedAt + this.durationMinutes * 60_000;
    this.submittedAt = opts.submittedAt ?? null;
    this.expired = Boolean(opts.expired);

    /** @type {Map<string, Set<string>>} question ref -> chosen option keys */
    this.answers = new Map();
    for (const [ref, keys] of Object.entries(opts.answers ?? {})) {
      this.answers.set(ref, new Set(keys));
    }
  }

  // --- answering ----------------------------------------------------------

  getSelection(ref) {
    return this.answers.get(ref) ?? new Set();
  }

  isSelected(ref, key) {
    return this.getSelection(ref).has(key);
  }

  /**
   * Toggle an option.
   * Single-answer questions behave like radios. Multi-answer questions accept
   * up to `selectCount` choices; an extra click is refused rather than silently
   * evicting an earlier pick, so the learner stays in control.
   *
   * @returns {{changed: boolean, reason?: string}}
   */
  toggle(ref, key) {
    const question = this.questions.find((q) => q.ref === ref);
    if (!question) return { changed: false, reason: 'unknown-question' };
    if (this.isFinished()) return { changed: false, reason: 'finished' };

    const current = new Set(this.getSelection(ref));

    if (question.selectCount === 1) {
      if (current.has(key) && current.size === 1) current.delete(key);
      else { current.clear(); current.add(key); }
    } else if (current.has(key)) {
      current.delete(key);
    } else if (current.size >= question.selectCount) {
      return { changed: false, reason: 'limit-reached' };
    } else {
      current.add(key);
    }

    if (current.size) this.answers.set(ref, current);
    else this.answers.delete(ref);
    return { changed: true };
  }

  clearAnswer(ref) {
    this.answers.delete(ref);
  }

  // --- progress and time --------------------------------------------------

  get answeredCount() {
    return this.questions.filter((q) => this.getSelection(q.ref).size > 0).length;
  }

  /** A question counts as complete only when the required number is chosen. */
  get completeCount() {
    return this.questions.filter((q) => this.getSelection(q.ref).size === q.selectCount).length;
  }

  get unanswered() {
    return this.questions.filter((q) => this.getSelection(q.ref).size !== q.selectCount);
  }

  secondsRemaining(now = Date.now()) {
    return Math.max(0, Math.round((this.deadline - now) / 1000));
  }

  isTimeUp(now = Date.now()) {
    return now >= this.deadline;
  }

  isFinished() {
    return this.submittedAt !== null;
  }

  // --- submission and scoring --------------------------------------------

  submit({ expired = false, now = Date.now() } = {}) {
    if (this.submittedAt === null) {
      this.submittedAt = now;
      this.expired = expired;
    }
    return this.score();
  }

  /** Grade a single question. */
  gradeQuestion(question) {
    const chosen = [...this.getSelection(question.ref)].sort();
    const correct = [...question.correct].sort();
    const exact = chosen.length === correct.length && chosen.every((c, i) => c === correct[i]);

    let verdict = VERDICT.incorrect;
    if (!chosen.length) verdict = VERDICT.unanswered;
    else if (exact) verdict = VERDICT.correct;

    return {
      ref: question.ref,
      label: question.label,
      chapter: question.chapter,
      learningObjective: question.learningObjective,
      kLevel: question.kLevel,
      selectCount: question.selectCount,
      points: question.points,
      awarded: verdict === VERDICT.correct ? question.points : 0,
      chosen,
      correct,
      verdict,
    };
  }

  score() {
    const results = this.questions.map((q) => this.gradeQuestion(q));
    const totalPoints = results.reduce((s, r) => s + r.points, 0);
    const awarded = results.reduce((s, r) => s + r.awarded, 0);
    const percent = totalPoints ? (awarded / totalPoints) * 100 : 0;
    const passPoints = this.rules.passPoints ?? Math.ceil(totalPoints * 0.65);

    const chapters = new Map();
    for (const r of results) {
      const ch = r.chapter ?? 0;
      const stat = chapters.get(ch) ?? { chapter: ch, points: 0, awarded: 0, count: 0, correct: 0 };
      stat.points += r.points;
      stat.awarded += r.awarded;
      stat.count += 1;
      if (r.verdict === VERDICT.correct) stat.correct += 1;
      chapters.set(ch, stat);
    }

    return {
      candidateName: this.candidateName,
      examId: this.exam.id,
      examSet: this.exam.set,
      examTitle: this.exam.title,
      seed: this.seed,
      shuffled: this.shuffleQuestions,
      durationMinutes: this.durationMinutes,
      startedAt: this.startedAt,
      submittedAt: this.submittedAt,
      expired: this.expired,
      elapsedSeconds: Math.round(((this.submittedAt ?? Date.now()) - this.startedAt) / 1000),
      totalPoints,
      awarded,
      percent: Math.round(percent * 10) / 10,
      passPoints,
      passPercent: this.rules.passPercent ?? 65,
      passed: awarded >= passPoints,
      counts: {
        total: results.length,
        correct: results.filter((r) => r.verdict === VERDICT.correct).length,
        incorrect: results.filter((r) => r.verdict === VERDICT.incorrect).length,
        unanswered: results.filter((r) => r.verdict === VERDICT.unanswered).length,
      },
      chapters: [...chapters.values()].sort((a, b) => a.chapter - b.chapter),
      results,
    };
  }

  // --- persistence --------------------------------------------------------

  toSession() {
    return {
      examId: this.exam.id,
      examFile: this.exam.__file ?? null,
      candidateName: this.candidateName,
      durationMinutes: this.durationMinutes,
      seed: this.seed,
      shuffleQuestions: this.shuffleQuestions,
      startedAt: this.startedAt,
      submittedAt: this.submittedAt,
      expired: this.expired,
      answers: Object.fromEntries([...this.answers].map(([ref, set]) => [ref, [...set]])),
    };
  }

  static fromSession(exam, session) {
    return new ExamEngine(exam, {
      candidateName: session.candidateName,
      durationMinutes: session.durationMinutes,
      seed: session.seed,
      shuffleQuestions: session.shuffleQuestions,
      startedAt: session.startedAt,
      submittedAt: session.submittedAt,
      expired: session.expired,
      answers: session.answers,
    });
  }
}
