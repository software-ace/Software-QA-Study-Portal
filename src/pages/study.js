/**
 * study.js — Syllabus and learning-objective browser.
 *
 * Each learning objective shows how many official questions exercise it, which
 * turns the syllabus into a study plan rather than a list.
 */
import { el, mount, markReady, markError, byTestId } from '../core/dom.js';
import { renderShell, renderError, href } from '../core/render.js';
import { TID, tid } from '../core/testids.js';
import { getSyllabus, getQuestionPool } from '../core/data.js';

const K_HINT = {
  K1: 'Remember — recall or recognise a term or fact',
  K2: 'Understand — explain, compare, classify or summarise',
  K3: 'Apply — use a technique or procedure in a given situation',
};

async function main() {
  const page = renderShell('study');
  const [syllabus, { pool }] = await Promise.all([getSyllabus(), getQuestionPool()]);

  const perLo = new Map();
  for (const q of pool) perLo.set(q.learningObjective, (perLo.get(q.learningObjective) ?? 0) + 1);

  const search = el('input', {
    type: 'search',
    testid: TID.studySearch,
    placeholder: 'Filter learning objectives…',
    'aria-label': 'Filter learning objectives',
  });

  const chapters = syllabus.chapters.map((chapter) =>
    el(
      'details',
      { class: 'chapter', testid: tid.chapter(chapter.number), dataset: { chapter: String(chapter.number) }, open: chapter.number === 1 },
      [
        el('summary', { testid: tid.chapterToggle(chapter.number) }, [
          `${chapter.number}. ${chapter.title}`,
          el('span', { class: 'badge', style: 'margin-left:auto', text: `${chapter.minutes} min` }),
          el('span', { class: 'badge', 'data-tone': 'accent', text: `${chapter.sections.reduce((s, x) => s + x.learningObjectives.length, 0)} LOs` }),
        ]),
        el('div', { class: 'chapter-body' }, [
          chapter.keywords.length
            ? el('p', { class: 'faint', style: 'margin-top:12px' }, [
                el('strong', { text: 'Keywords: ' }),
                chapter.keywords.join(', '),
              ])
            : null,
          ...chapter.sections.map((section) =>
            el('div', { testid: tid.section(section.number), dataset: { section: section.number } }, [
              el('h3', { text: `${section.number} ${section.title}` }),
              el(
                'div',
                { class: 'lo-group' },
                section.learningObjectives.map((lo) => {
                  const count = perLo.get(lo.id) ?? 0;
                  return el(
                    'div',
                    {
                      class: 'lo',
                      testid: tid.lo(lo.id),
                      dataset: { loId: lo.id, kLevel: lo.kLevel, questionCount: String(count) },
                    },
                    [
                      el('span', { class: 'lo-id', text: lo.id }),
                      el('span', { style: 'flex:1' }, [
                        lo.text,
                        el('span', { class: 'faint', style: 'display:block' }, [
                          count
                            ? el('a', {
                                href: `${href('ctfl-v4/practice.html')}?start=1`,
                                text: `${count} official question${count === 1 ? '' : 's'}`,
                              })
                            : 'no questions in the sample papers',
                        ]),
                      ]),
                      el('span', { class: 'badge', title: K_HINT[lo.kLevel] ?? '', text: lo.kLevel }),
                    ],
                  );
                }),
              ),
            ]),
          ),
        ]),
      ],
    ),
  );

  mount(
    page,
    el('h1', { text: 'CTFL v4.0 syllabus' }),
    el('p', { class: 'lede' }, [
      `All ${syllabus.chapters.length} chapters and ${syllabus.totals.learningObjectives} learning objectives from the official syllabus (v${syllabus.source.documentVersion}). `,
      'Each objective shows how many official sample questions test it — the ones with the most questions are the ones the exam leans on.',
    ]),
    el('div', { class: 'field', style: 'max-width:420px' }, [search]),
    el('div', { testid: TID.chapterList }, chapters),
  );

  search.addEventListener('input', () => {
    const needle = search.value.trim().toLowerCase();
    let visible = 0;
    for (const node of document.querySelectorAll('.lo')) {
      const hit = !needle || node.textContent.toLowerCase().includes(needle);
      node.hidden = !hit;
      if (hit) visible += 1;
    }
    // Open any chapter with a match so results are not hidden behind a summary.
    for (const details of document.querySelectorAll('details.chapter')) {
      const anyVisible = [...details.querySelectorAll('.lo')].some((n) => !n.hidden);
      if (needle) details.open = anyVisible;
      details.hidden = needle ? !anyVisible : false;
    }
    byTestId(TID.chapterList).dataset.visibleCount = String(visible);
  });

  // Scoping root so automation can narrow queries to this page's content.
  page.setAttribute('data-testid', TID.studyRoot);

  markReady({ page: 'study', chapters: String(syllabus.chapters.length), los: String(syllabus.totals.learningObjectives) });
}

main().catch((err) => {
  const page = document.querySelector('main .wrap') ?? document.body;
  renderError(page, err.message);
  markError(err.message);
});
