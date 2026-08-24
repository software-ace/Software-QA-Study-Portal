/**
 * home.js — Portal landing page: role tracks and the certification catalogue.
 */
import { el, mount, markReady, markError } from '../core/dom.js';
import { renderShell, href, renderError } from '../core/render.js';
import { TID, tid } from '../core/testids.js';
import { getManifest } from '../core/data.js';

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
    certs: ['ctal-tae'],
  },
  {
    id: 'agile-testing',
    name: 'Agile Testing',
    blurb: 'Testing within agile teams, whole-team quality ownership and iterative delivery.',
    certs: ['ctfl-at'],
  },
];

const CERTS = [
  {
    id: 'ctfl-v4',
    code: 'CTFL v4.0',
    name: 'Certified Tester Foundation Level',
    body: 'ISTQB®',
    available: true,
    path: 'ctfl-v4/index.html',
    blurb: 'The foundation certification for software testing. Built from the official v4.0 syllabus and all four official sample exam papers.',
  },
  {
    id: 'ctal-tae',
    code: 'CTAL-TAE',
    name: 'Advanced Level Test Automation Engineering',
    body: 'ISTQB®',
    available: false,
    blurb: 'Automation architecture and implementation. Planned — contributions welcome.',
  },
  {
    id: 'ctfl-at',
    code: 'CTFL-AT',
    name: 'Foundation Level Agile Tester',
    body: 'ISTQB®',
    available: false,
    blurb: 'Agile testing principles and practices. Planned — contributions welcome.',
  },
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
      ? el('p', { class: 'faint', text: `${stats.exams} exam sets · ${stats.questions} official questions · ${stats.los} learning objectives` })
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

  let stats = null;
  try {
    const manifest = await getManifest();
    stats = {
      exams: manifest.exams.length,
      questions: manifest.totals.examQuestions + manifest.totals.additionalQuestions,
      los: manifest.syllabus?.learningObjectives ?? 0,
    };
  } catch (err) {
    // The catalogue is still useful without live counts.
    console.warn(err);
  }

  mount(
    page,
    el('h1', { text: 'Software testing & test automation certifications' }),
    el('p', { class: 'lede' }, [
      'Free, open-source preparation for software testing certifications. Study the syllabus, drill questions by topic, then sit a full timed exam under official conditions and review every answer with the official rationale.',
    ]),

    el('h2', { text: 'Certifications' }),
    el('div', { class: 'grid', testid: TID.certificationList }, CERTS.map((c) => certCard(c, stats))),

    el('h2', { text: 'Role tracks' }),
    el(
      'div',
      { class: 'grid', testid: TID.trackList },
      TRACKS.map((track) =>
        el('div', { class: 'card', testid: tid.track(track.id), dataset: { trackId: track.id } }, [
          el('h3', { text: track.name }),
          el('p', { class: 'muted', text: track.blurb }),
          el('p', { class: 'faint', text: track.certs.map((id) => CERTS.find((c) => c.id === id)?.code ?? id).join(' · ') }),
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
