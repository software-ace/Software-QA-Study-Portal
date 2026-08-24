/**
 * data.js — Loads the generated JSON data set.
 *
 * Paths are resolved relative to this module so every page (root or nested)
 * gets the same URLs without hard-coding `../`.
 */
const DATA_ROOT = new URL('../../data/ctfl-v4/', import.meta.url);

const cache = new Map();

async function loadJson(name) {
  if (cache.has(name)) return cache.get(name);
  const promise = fetch(new URL(name, DATA_ROOT))
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${name}: HTTP ${res.status}`);
      return res.json();
    })
    .catch((err) => {
      cache.delete(name);
      throw new Error(
        `${err.message}. Data files are fetched over HTTP, so the portal must be served ` +
          `(node scripts/serve.mjs) rather than opened from the filesystem.`,
      );
    });
  cache.set(name, promise);
  return promise;
}

export const getManifest = () => loadJson('manifest.json');
export const getSyllabus = () => loadJson('syllabus.json');
export const getGlossary = () => loadJson('glossary.json');
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
