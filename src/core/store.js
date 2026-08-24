/**
 * store.js — Local persistence. No backend, no accounts, no telemetry.
 *
 * Everything lives in this browser's localStorage. Two distinct things are
 * stored: the single in-flight exam session (so a refresh or accidental
 * navigation does not destroy an attempt) and the completed attempt history.
 *
 * Every access is guarded: localStorage throws in some privacy modes, and a
 * study tool must degrade to "works but forgets" rather than crash.
 */
import { activeCert } from './certs.js';

// Attempts and in-flight sessions are namespaced per certification so progress
// in one never mixes into another. The candidate's name is shared: it is the
// same person either way, and re-typing it for each certification is friction
// with no benefit.
const NS = 'software-qa-study-portal';
const ns = () => `${NS}:${activeCert().id}`;
const KEY_SESSION = () => `${ns()}:session`;
const KEY_ATTEMPTS = () => `${ns()}:attempts`;
const KEY_NAME = `${NS}:candidate-name`;
const MAX_ATTEMPTS = 200;

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function safeRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const storageAvailable = (() => {
  try {
    const probe = `${NS}:probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
})();

const readJson = (key, fallback) => {
  const raw = safeGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

// --- candidate name --------------------------------------------------------

export const rememberName = (name) => safeSet(KEY_NAME, name);
export const recallName = () => safeGet(KEY_NAME) ?? '';

// --- in-flight session ----------------------------------------------------

export const saveSession = (session) => safeSet(KEY_SESSION(), JSON.stringify(session));
export const loadSession = () => readJson(KEY_SESSION(), null);
export const clearSession = () => safeRemove(KEY_SESSION());

// --- attempt history ------------------------------------------------------

export function listAttempts() {
  const all = readJson(KEY_ATTEMPTS(), []);
  return Array.isArray(all) ? all : [];
}

export function saveAttempt(attempt) {
  const all = listAttempts();
  all.unshift(attempt);
  safeSet(KEY_ATTEMPTS(), JSON.stringify(all.slice(0, MAX_ATTEMPTS)));
  return attempt;
}

export const getAttempt = (id) => listAttempts().find((a) => a.id === id) ?? null;
export const clearAttempts = () => safeRemove(KEY_ATTEMPTS());

/** Aggregate per-chapter accuracy across every stored attempt. */
export function weakAreas() {
  const byChapter = new Map();
  for (const attempt of listAttempts()) {
    for (const r of attempt.results ?? []) {
      const ch = r.chapter ?? 0;
      const stat = byChapter.get(ch) ?? { chapter: ch, seen: 0, correct: 0 };
      stat.seen += 1;
      if (r.verdict === 'correct') stat.correct += 1;
      byChapter.set(ch, stat);
    }
  }
  return [...byChapter.values()]
    .map((s) => ({ ...s, accuracy: s.seen ? s.correct / s.seen : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy);
}
