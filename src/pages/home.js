/**
 * home.js — Portal landing page: role tracks and the certification catalogue.
 */
import { el, mount, markReady, markError } from '../core/dom.js';
import { renderShell, href, renderError } from '../core/render.js';
import { TID, tid } from '../core/testids.js';
import { getCertManifest } from '../core/data.js';
import { CERT_LIST, certPaths } from '../core/certs.js';

/**
 * Tracks describe the career paths this portal is being built out for. Only
 * certifications with a real, validated question bank are marked available --
 * a study tool that promises content it does not have wastes people's time.
 */
const TRACKS = [
  {
    id: 'qa-fundamentals',
    name: 'Software QA Fundamentals',
    blurb: 'Testing principles, the test process, static testing, test techniques and test management.',
    certs: ['ctfl-v4'],
  },
  {
    id: 'test-automation',
    name: 'Test Automation',
    blurb: 'Automation architecture, tooling, CI integration and maintainable test suites.',
    certs: ['ctal-tae-v2'],
  },
  {
    id: 'agile-testing',
    name: 'Agile Testing',
    blurb: 'Testing within agile teams, whole-team quality ownership and iterative delivery.',
    certs: ['ctfl-at'],
  },
];

/**
 * The catalogue is the registry plus certifications that are planned but have no
 * question bank yet. Only ones with real, validated content are marked
 * available — promising content that does not exist wastes people's study time.
 */
const PLANNED = [
  {
    id: 'ctfl-at',
    code: 'CTFL-AT',
    name: 'Foundation Level Agile Tester',
    blurb: 'Agile testing principles and practices. Planned — contributions welcome.',
  },
];

const CATALOGUE = [
  ...CERT_LIST.map((c) => ({
    id: c.id,
    code: `${c.code} v${c.version}`,
    name: c.name,
    body: 'ISTQB®',
    available: c.available,
    path: certPaths(c).hub,
    blurb: c.blurb,
  })),
  ...PLANNED.map((c) => ({ ...c, body: 'ISTQB®', available: false })),
];


function certCard(cert, stats) {
  const badges = el('div', { class: 'row', style: 'margin-bottom:10px' }, [
    el('span', { class: 'badge', 'data-tone': 'accent', text: cert.body }),
    cert.available
      ? el('span', { class: 'badge', 'data-tone': 'ok', text: 'Available' })
      : el('span', { class: 'badge', text: 'Planned' }),
  ]);

  const body = [
    badges,
    el('h3', { text: `${cert.code} — ${cert.name}` }),
    el('p', { class: 'muted', text: cert.blurb }),
    cert.available && stats
      ? el('p', { class: 'faint', text: `${stats.exams} exam set${stats.exams === 1 ? '' : 's'} · ${stats.questions} official questions · ${stats.los} learning objectives` })
      : null,
  ];

  const attrs = {
    class: 'card',
    testid: tid.cert(cert.id),
    dataset: { certId: cert.id, available: String(cert.available) },
  };

  return cert.available
    ? el('a', { ...attrs, href: href(cert.path) }, body)
    : el('div', { ...attrs, 'aria-disabled': 'true' }, body);
}

async function main() {
  const page = renderShell('home');

  // Counts are per certification. A failure to load one must not blank the whole
  // catalogue, so each is settled independently and simply omits its numbers.
  const stats = new Map();
  await Promise.all(
    CERT_LIST.filter((c) => c.available).map(async (c) => {
      try {
        const m = await getCertManifest(c.id);
        stats.set(c.id, {
          exams: m.exams.length,
          questions: m.totals.examQuestions + m.totals.additionalQuestions,
          los: m.syllabus?.learningObjectives ?? 0,
        });
      } catch (err) {
        console.warn(`Could not load counts for ${c.id}`, err);
      }
    }),
  );

  mount(
    page,
    el('h1', { text: 'Software testing & test automation certifications' }),
    el('p', { class: 'lede' }, [
      'Free, open-source preparation for software testing certifications. Study the syllabus, drill questions by topic, then sit a full timed exam under official conditions and review every answer with the official rationale.',
    ]),

    el('h2', { text: 'Certifications' }),
    el('div', { class: 'grid', testid: TID.certificationList }, CATALOGUE.map((c) => certCard(c, stats.get(c.id)))),

    el('h2', { text: 'Role tracks' }),
    el(
      'div',
      { class: 'grid', testid: TID.trackList },
      TRACKS.map((track) =>
        el('div', { class: 'card', testid: tid.track(track.id), dataset: { trackId: track.id } }, [
          el('h3', { text: track.name }),
          el('p', { class: 'muted', text: track.blurb }),
          el('p', { class: 'faint', text: track.certs.map((id) => CATALOGUE.find((c) => c.id === id)?.code ?? id).join(' · ') }),
        ]),
      ),
    ),
  );

  markReady({ page: 'home' });
}

main().catch((err) => {
  const page = document.querySelector('main .wrap') ?? document.body;
  renderError(page, err.message);
  markError(err.message);
});
