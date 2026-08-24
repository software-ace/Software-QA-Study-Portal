/**
 * choose.js — Certification chooser.
 *
 * Backs the root-level study/practice/glossary/progress pages. Each nav link
 * lands here first so the learner picks a certification explicitly, instead of
 * the portal quietly defaulting to one and showing content they never asked for.
 *
 * The section is declared by the page shell as `body[data-section]`.
 */
import { el, mount, markReady, markError } from '../core/dom.js';
import { renderShell, href, renderError } from '../core/render.js';
import { TID, tid } from '../core/testids.js';
import { CERT_LIST, certPaths, activeSection } from '../core/certs.js';
import { getCertManifest } from '../core/data.js';
import { listAttempts } from '../core/store.js';

/** A one-line summary so the choice is informed rather than a guess. */
function summarise(section, manifest, certId) {
  if (!manifest) return null;
  const q = manifest.totals.examQuestions + manifest.totals.additionalQuestions;

  if (section.key === 'study') {
    return `${manifest.syllabus?.chapters ?? 0} chapters · ${manifest.syllabus?.learningObjectives ?? 0} learning objectives`;
  }
  if (section.key === 'practice') {
    return `${q} official questions to drill`;
  }
  if (section.key === 'glossary') {
    return `${manifest.glossary?.terms ?? 0} syllabus keywords`;
  }
  // Progress is per-certification, so read that certification's own history.
  const n = listAttempts(certId).length;
  return n ? `${n} recorded attempt${n === 1 ? '' : 's'}` : 'No attempts recorded yet';
}

function card(cert, section, manifest) {
  const paths = certPaths(cert);
  return el(
    'a',
    {
      class: 'card',
      href: href(paths[section.key]),
      testid: tid.chooserCard(cert.id),
      dataset: { certId: cert.id, section: section.key },
    },
    [
      el('div', { class: 'row', style: 'margin-bottom:10px' }, [
        el('span', { class: 'badge', 'data-tone': 'accent', text: `${cert.code} v${cert.version}` }),
        el('span', { class: 'badge', text: cert.level }),
      ]),
      el('h3', { style: 'margin-top:0', text: cert.name }),
      el('p', { class: 'faint', style: 'margin:0', text: summarise(section, manifest, cert.id) ?? '' }),
    ],
  );
}

async function main() {
  const section = activeSection();
  if (!section) throw new Error('This page did not declare a section (body[data-section]).');

  const page = renderShell(section.key);
  const available = CERT_LIST.filter((c) => c.available);

  // One failure must not blank the chooser; a card without counts still works.
  const manifests = new Map();
  await Promise.all(
    available.map(async (c) => {
      try {
        manifests.set(c.id, await getCertManifest(c.id));
      } catch (err) {
        console.warn(`Could not load counts for ${c.id}`, err);
      }
    }),
  );

  mount(
    page,
    el('h1', { testid: TID.chooserHeading, text: section.heading }),
    el('p', { class: 'lede', text: section.lede }),
    el(
      'div',
      { class: 'grid', testid: TID.chooser, dataset: { section: section.key, count: String(available.length) } },
      available.map((c) => card(c, section, manifests.get(c.id))),
    ),
  );

  markReady({ page: 'choose', section: section.key, certCount: String(available.length) });
}

main().catch((err) => {
  const page = document.querySelector('main .wrap') ?? document.body;
  renderError(page, err.message);
  markError(err.message);
});
