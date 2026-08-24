/**
 * Integrity tests for the generated question banks.
 *
 * These guard the shipped JSON for every certification: if a future revision or
 * a hand-edit degrades the data, this fails loudly instead of quietly teaching
 * people wrong answers.
 *
 * The suite is driven by the certification registry, so adding a certification
 * automatically brings it under test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Read the registry without a DOM, so the list of certifications has one home. */
const registrySource = readFileSync(join(ROOT, 'src', 'core', 'certs.js'), 'utf8');
const CERT_IDS = [...registrySource.matchAll(/^\s{2}'([a-z0-9-]+)':\s*\{$/gm)].map((m) => m[1]);

const read = (cert, f) => JSON.parse(readFileSync(join(ROOT, 'data', cert, f), 'utf8'));

/** Published exam structures, from the ISTQB Exam Structures & Rules tables. */
const OFFICIAL = {
  'ctfl-v4': { questions: 40, points: 40, pass: 26, minutes: 60, extended: 75, sets: 4, chapters: 6, los: 64 },
  'ctal-tae-v2': { questions: 40, points: 66, pass: 43, minutes: 90, extended: 113, sets: 1, chapters: 8, los: 29 },
};

test('the registry lists the certifications that ship data', () => {
  assert.deepEqual(CERT_IDS.sort(), Object.keys(OFFICIAL).sort());
});

for (const cert of CERT_IDS) {
  const spec = OFFICIAL[cert];
  const manifest = read(cert, 'manifest.json');
  const exams = manifest.exams.map((e) => read(cert, e.file));
  const syllabus = read(cert, 'syllabus.json');

  test(`${cert}: exam rules match the published structure`, () => {
    assert.equal(manifest.rules.questionCount, spec.questions);
    assert.equal(manifest.rules.totalPoints, spec.points);
    assert.equal(manifest.rules.passPoints, spec.pass);
    assert.equal(manifest.rules.passPercent, 65);
    assert.equal(manifest.rules.durationMinutes, spec.minutes);
    assert.equal(manifest.rules.extendedDurationMinutes, spec.extended);
    assert.equal(manifest.exams.length, spec.sets);
  });

  test(`${cert}: every set has the right question count and point total`, () => {
    for (const exam of exams) {
      const main = exam.questions.filter((q) => !q.additional);
      assert.equal(main.length, spec.questions, `${exam.id} question count`);
      assert.equal(main.reduce((s, q) => s + q.points, 0), spec.points, `${exam.id} total points`);
    }
  });

  test(`${cert}: every question is internally consistent`, () => {
    for (const exam of exams) {
      for (const q of exam.questions) {
        const where = `${exam.id} ${q.label}`;
        assert.ok(q.stem.length > 0, `${where}: empty stem`);
        assert.ok(q.options.length >= 4, `${where}: too few options`);
        assert.deepEqual(
          q.options.map((o) => o.key),
          q.options.map((_, i) => String.fromCharCode(97 + i)),
          `${where}: option keys must be a,b,c,...`,
        );
        for (const o of q.options) assert.ok(o.text.trim().length > 0, `${where}: blank option ${o.key}`);

        // The flagged options and the answer list must agree, exactly.
        assert.deepEqual(
          q.options.filter((o) => o.correct).map((o) => o.key),
          [...q.correct].sort(),
          `${where}: correct flags disagree with the answer key`,
        );
        assert.equal(q.correct.length, q.selectCount, `${where}: selectCount vs answers`);
        assert.match(q.learningObjective, /^[A-Z]{2,4}-\d\.\d+\.\d+$/, `${where}: bad LO`);
        assert.match(q.kLevel, /^K[1-4]$/, `${where}: bad K-level`);
        assert.ok(q.chapter >= 1 && q.chapter <= spec.chapters, `${where}: bad chapter ${q.chapter}`);
        assert.ok(q.points >= 1, `${where}: points must be positive`);
      }
    }
  });

  test(`${cert}: question ids and refs are unique within a set`, () => {
    for (const exam of exams) {
      const refs = exam.questions.map((q) => q.ref);
      assert.equal(new Set(refs).size, refs.length, `${exam.id}: duplicate refs`);
      const ids = exam.questions.map((q) => q.id);
      assert.equal(new Set(ids).size, ids.length, `${exam.id}: duplicate ids`);
    }
  });

  test(`${cert}: every option carries a rationale for the review screen`, () => {
    for (const exam of exams) {
      for (const q of exam.questions) {
        for (const o of q.options) {
          assert.ok(o.rationale && o.rationale.length > 3, `${exam.id} ${q.label} option ${o.key}: no rationale`);
        }
      }
    }
  });

  test(`${cert}: multi-answer questions have more options than answers`, () => {
    const multi = exams.flatMap((e) => e.questions).filter((q) => q.selectCount > 1);
    assert.ok(multi.length > 0, 'expected some Select TWO questions');
    for (const q of multi) assert.ok(q.options.length > q.selectCount);
  });

  test(`${cert}: syllabus structure is well formed`, () => {
    assert.equal(syllabus.chapters.length, spec.chapters);
    assert.equal(syllabus.learningObjectives.length, spec.los);
    for (const lo of syllabus.learningObjectives) {
      assert.match(lo.id, /^[A-Z]{2,4}-\d\.\d+\.\d+$/);
      assert.match(lo.kLevel, /^K[1-4]$/);
      assert.ok(lo.text.length > 5);
    }
    for (const ch of syllabus.chapters) {
      assert.ok(ch.title.length > 3, `chapter ${ch.number} title`);
      assert.ok(ch.minutes > 0, `chapter ${ch.number} minutes`);
    }
  });

  test(`${cert}: every question maps to a learning objective in the syllabus`, () => {
    const known = new Set(syllabus.learningObjectives.map((l) => l.id));
    for (const exam of exams) {
      for (const q of exam.questions) {
        assert.ok(known.has(q.learningObjective), `${exam.id} ${q.label}: unknown LO ${q.learningObjective}`);
      }
    }
  });

  test(`${cert}: ISTQB attribution is present on every data file`, () => {
    for (const exam of exams) {
      assert.match(exam.source.publisher, /International Software Testing Qualifications Board/);
      assert.ok(exam.source.copyright.includes('ISTQB'));
      assert.ok(exam.source.url.startsWith('https://istqb.org/'), `${exam.id}: source url`);
    }
    assert.match(syllabus.source.publisher, /International Software Testing Qualifications Board/);
  });

  test(`${cert}: has a page directory with all six shells`, () => {
    for (const p of ['index', 'exam', 'results', 'practice', 'study', 'progress']) {
      const html = readFileSync(join(ROOT, cert, `${p}.html`), 'utf8');
      assert.match(html, new RegExp(`data-cert="${cert}"`), `${cert}/${p}.html must declare its certification`);
    }
  });
}
