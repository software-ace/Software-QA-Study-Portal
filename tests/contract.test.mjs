/**
 * Guards the locator contract in src/core/testids.js.
 *
 * Two ways the contract rots: an entry stops being rendered (a dead locator), or
 * a container id starts shadowing the items inside it, so that a
 * `[data-testid^="question-"]` sweep also matches the list wrapper. Both are
 * caught here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { TID, tid, STATE } from '../src/core/testids.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const sources = [
  ...readdirSync(join(ROOT, 'src', 'pages')).map((f) => join(ROOT, 'src', 'pages', f)),
  ...readdirSync(join(ROOT, 'src', 'core')).map((f) => join(ROOT, 'src', 'core', f)),
]
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ file: f, text: readFileSync(f, 'utf8') }));

const allSource = sources.map((s) => s.text).join('\n');

test('every static locator in the contract is actually referenced by the app', () => {
  const dead = [];
  for (const [key] of Object.entries(TID)) {
    // Referenced either as TID.key or, in a few places, via a template literal.
    if (!new RegExp(`TID\\.${key}\\b`).test(allSource)) dead.push(key);
  }
  assert.deepEqual(dead, [], `dead locators in the contract: ${dead.join(', ')}`);
});

test('every locator builder is used by the app', () => {
  const dead = Object.keys(tid).filter((k) => !new RegExp(`tid\\.${k}\\b`).test(allSource));
  assert.deepEqual(dead, [], `unused locator builders: ${dead.join(', ')}`);
});

test('no container locator is a prefix of an item locator', () => {
  const containers = Object.values(TID);
  const items = [
    tid.question('12'), tid.questionStem('12'), tid.questionOptions('12'),
    tid.option('12', 'a'), tid.optionInput('12', 'a'), tid.optionLabel('12', 'a'),
    tid.navItem('12'), tid.review('12'), tid.reviewVerdict('12'),
    tid.reviewChosen('12'), tid.reviewCorrect('12'), tid.reviewRationale('12', 'a'),
    tid.chapter(3), tid.chapterToggle(3), tid.section('4.2'), tid.lo('FL-4.2.1'),
    tid.term('test-case'), tid.attempt('abc123'), tid.weakArea(3),
    tid.cert('ctfl-v4'), tid.examCard('ctfl-v4-set-a'), tid.examStart('ctfl-v4-set-a'),
  ];

  const collisions = [];
  for (const container of containers) {
    for (const item of items) {
      if (item !== container && item.startsWith(container)) {
        collisions.push(`container "${container}" shadows item "${item}"`);
      }
    }
  }
  assert.deepEqual(collisions, [], collisions.join('; '));
});

test('locator names are lowercase and hyphen-separated', () => {
  const bad = Object.values(TID).filter((v) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v));
  assert.deepEqual(bad, [], `malformed locator names: ${bad.join(', ')}`);
});

test('state vocabulary is stable', () => {
  for (const expected of ['idle', 'running', 'submitted', 'expired', 'answered', 'unanswered', 'correct', 'incorrect', 'partial', 'passed', 'failed']) {
    assert.equal(STATE[expected], expected, `STATE.${expected} must equal "${expected}"`);
  }
});
