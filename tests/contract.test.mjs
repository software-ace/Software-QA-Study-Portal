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

test('no item sweep matches a container locator', () => {
  // Each builder's literal prefix is what an automation author would sweep with:
  // tid.question('12') -> "question-12", so the sweep is `[data-testid^="question-"]`.
  // A container matched by such a sweep is a bug -- it silently inflates counts.
  const SENTINEL = '\u00a7';
  const sweeps = new Map();
  for (const [name, build] of Object.entries(tid)) {
    const produced = build(SENTINEL);
    const at = produced.indexOf(SENTINEL);
    if (at <= 0) continue;
    sweeps.set(name, produced.slice(0, at));
  }

  const collisions = [];
  for (const [name, sweep] of sweeps) {
    for (const container of Object.values(TID)) {
      if (container.startsWith(sweep)) {
        collisions.push(`sweep "[data-testid^="${sweep}"]" (tid.${name}) also matches container "${container}"`);
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
