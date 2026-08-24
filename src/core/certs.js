/**
 * certs.js — The certification registry.
 *
 * Every certification the portal ships is described here once. Pages are shared
 * across certifications: a page discovers which one it belongs to from
 * `body[data-cert]`, set in its HTML shell, and everything else (data directory,
 * navigation links, storage namespace) is derived from this table.
 *
 * Adding a certification means adding an entry here plus its `data/<dir>/` JSON
 * and a directory of HTML shells — no changes to the engine, renderer or store.
 */

export const CERTS = {
  'ctfl-v4': {
    id: 'ctfl-v4',
    dir: 'ctfl-v4',          // data/<dir>/ and the page directory
    code: 'CTFL',
    version: '4.0',
    navLabel: 'CTFL v4.0',
    name: 'Certified Tester Foundation Level',
    shortName: 'ISTQB CTFL v4.0',
    level: 'Foundation',
    available: true,
    blurb:
      'The foundation certification for software testing. Built from the official v4.0 syllabus and all four official sample exam papers.',
  },
  'ctal-tae-v2': {
    id: 'ctal-tae-v2',
    dir: 'ctal-tae-v2',
    code: 'CTAL-TAE',
    version: '2.0',
    navLabel: 'CTAL-TAE v2.0',
    name: 'Advanced Level Test Automation Engineering',
    shortName: 'ISTQB CTAL-TAE v2.0',
    level: 'Advanced',
    available: true,
    blurb:
      'Advanced certification for test automation engineers: automation architecture, implementation, deployment, reporting and continuous improvement. Built from the official v2.0 syllabus and sample exam.',
  },
};

export const CERT_LIST = Object.values(CERTS);

/** The default when a page does not declare one (the portal home page). */
export const DEFAULT_CERT = CERTS['ctfl-v4'];

/**
 * Resolve the certification the current page belongs to.
 * Falls back to the default rather than throwing: the portal home page is not
 * tied to any single certification.
 */
export function activeCert() {
  const id = document.body?.dataset?.cert;
  return (id && CERTS[id]) || DEFAULT_CERT;
}

/** Page paths for one certification, relative to the site root. */
export function certPaths(cert) {
  const d = cert.dir;
  return {
    hub: `${d}/index.html`,
    exam: `${d}/exam.html`,
    results: `${d}/results.html`,
    practice: `${d}/practice.html`,
    study: `${d}/study.html`,
    glossary: `${d}/glossary.html`,
    progress: `${d}/progress.html`,
  };
}
