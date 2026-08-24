/**
 * Integrity tests for the generated data set.
 *
 * These guard the shipped JSON, not the parser: if a future ISTQB document
 * revision or a parser tweak degrades the data, this fails loudly instead of
 * quietly teaching people wrong answers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'ctfl-v4');
const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

const manifest = read('manifest.json');
const exams = manifest.exams.map((e) => read(e.file));
const syllabus = read('syllabus.json');
const glossary = read('glossary.json');

test('manifest advertises all four official sample exam sets', () => {
  assert.deepEqual(manifest.exams.map((e) => e.set).sort(), ['A', 'B', 'C', 'D']);
  assert.equal(manifest.totals.examQuestions, 160);
});

test('official exam rules match the published CTFL v4.0 structure', () => {
  assert.equal(manifest.rules.questionCount, 40);
  assert.equal(manifest.rules.totalPoints, 40);
  assert.equal(manifest.rules.passPoints, 26);
  assert.equal(manifest.rules.passPercent, 65);
  assert.equal(manifest.rules.durationMinutes, 60);
  assert.equal(manifest.rules.extendedDurationMinutes, 75);
});

test('each set has exactly 40 one-point exam questions', () => {
  for (const exam of exams) {
    const main = exam.questions.filter((q) => !q.additional);
    assert.equal(main.length, 40, `${exam.id} question count`);
    assert.equal(main.reduce((s, q) => s + q.points, 0), 40, `${exam.id} total points`);
  }
});

test('every question is internally consistent', () => {
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
        `${where}: correct flags disagree with answer key`,
      );
      assert.equal(q.correct.length, q.selectCount, `${where}: selectCount vs answers`);
      assert.match(q.learningObjective, /^FL-\d\.\d+\.\d+$/, `${where}: bad LO`);
      assert.match(q.kLevel, /^K[1-4]$/, `${where}: bad K-level`);
      assert.ok(q.chapter >= 1 && q.chapter <= 6, `${where}: bad chapter`);
    }
  }
});

test('question ids and refs are unique within a set', () => {
  for (const exam of exams) {
    const refs = exam.questions.map((q) => q.ref);
    assert.equal(new Set(refs).size, refs.length, `${exam.id}: duplicate refs`);
    const ids = exam.questions.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length, `${exam.id}: duplicate ids`);
  }
});

test('every option carries a rationale for the review screen', () => {
  for (const exam of exams) {
    for (const q of exam.questions) {
      for (const o of q.options) {
        assert.ok(o.rationale && o.rationale.length > 3, `${exam.id} ${q.label} option ${o.key}: no rationale`);
      }
    }
  }
});

test('multi-answer questions really do have more options than answers', () => {
  const multi = exams.flatMap((e) => e.questions).filter((q) => q.selectCount > 1);
  assert.ok(multi.length > 0, 'expected some Select TWO questions');
  for (const q of multi) assert.ok(q.options.length > q.selectCount);
});

test('syllabus has six chapters and every learning objective is well formed', () => {
  assert.equal(syllabus.chapters.length, 6);
  assert.ok(syllabus.learningObjectives.length >= 60);
  for (const lo of syllabus.learningObjectives) {
    assert.match(lo.id, /^FL-\d\.\d+\.\d+$/);
    assert.match(lo.kLevel, /^K[1-4]$/);
    assert.ok(lo.text.length > 5);
  }
});

test('every question maps to a learning objective that exists in the syllabus', () => {
  const known = new Set(syllabus.learningObjectives.map((l) => l.id));
  for (const exam of exams) {
    for (const q of exam.questions) {
      assert.ok(known.has(q.learningObjective), `${exam.id} ${q.label}: unknown LO ${q.learningObjective}`);
    }
  }
});

test('glossary terms are unique and link to the official ISTQB glossary', () => {
  const terms = glossary.terms.map((t) => t.term);
  assert.equal(new Set(terms).size, terms.length, 'duplicate glossary terms');
  for (const t of glossary.terms) {
    assert.ok(t.chapters.length > 0, `${t.term}: no chapter`);
    assert.match(t.glossaryUrl, /^https:\/\/glossary\.istqb\.org\//);
  }
});

test('ISTQB attribution is present on every data file', () => {
  for (const exam of exams) {
    assert.match(exam.source.publisher, /International Software Testing Qualifications Board/);
    assert.ok(exam.source.copyright.includes('ISTQB'));
  }
  assert.match(syllabus.source.publisher, /International Software Testing Qualifications Board/);
});
