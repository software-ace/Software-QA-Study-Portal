/**
 * data.js — Loads the generated JSON data set for the active certification.
 *
 * Paths are resolved relative to this module so every page (root or nested)
 * gets the same URLs without hard-coding `../`, and the certification directory
 * comes from the registry so one set of page modules serves them all.
 */
import { activeCert } from './certs.js';

const dataRoot = () => new URL(`../../data/${activeCert().dir}/`, import.meta.url);

const cache = new Map();

async function loadJson(name) {
  const key = `${activeCert().dir}/${name}`;
  if (cache.has(key)) return cache.get(key);
  const promise = fetch(new URL(name, dataRoot()))
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${name}: HTTP ${res.status}`);
      return res.json();
    })
    .catch((err) => {
      cache.delete(key);
      throw new Error(
        `${err.message}. Data files are fetched over HTTP, so the portal must be served ` +
          `(node scripts/serve.mjs) rather than opened from the filesystem.`,
      );
    });
  cache.set(key, promise);
  return promise;
}

export const getManifest = () => loadJson('manifest.json');
export const getSyllabus = () => loadJson('syllabus.json');
export const getExam = (file) => loadJson(file);

/** Load every exam set at once — used by practice mode and progress stats. */
export async function getAllExams() {
  const manifest = await getManifest();
  const sets = await Promise.all(manifest.exams.map((e) => getExam(e.file)));
  return { manifest, sets };
}

/** Flatten all questions across sets, tagging each with its origin set. */
export async function getQuestionPool() {
  const { manifest, sets } = await getAllExams();
  const pool = [];
  for (const set of sets) {
    for (const q of set.questions) pool.push({ ...q, set: set.set, examId: set.id });
  }
  return { manifest, pool };
}

/**
 * Load another certification's manifest by id.
 *
 * The portal home page lists every certification at once, so it cannot rely on
 * the active-certification scoping the rest of this module uses.
 */
export async function getCertManifest(certId) {
  const key = `${certId}/manifest.json`;
  if (cache.has(key)) return cache.get(key);
  const url = new URL(`../../data/${certId}/manifest.json`, import.meta.url);
  const promise = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load ${certId} manifest: HTTP ${res.status}`);
    return res.json();
  }).catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, promise);
  return promise;
}
