/**
 * glossary.js — Searchable index of the active certification's syllabus keywords.
 *
 * Honesty note: the syllabus publishes keyword LISTS, not definitions. Each
 * entry therefore shows a verbatim excerpt from the syllabus that uses the term
 * -- clearly labelled as context -- and links to the official ISTQB Glossary for
 * the authoritative definition. Inventing definitions would be worse than
 * useless for someone studying for an exam.
 */
import { el, mount, markReady, markError, byTestId, slug } from '../core/dom.js';
import { renderShell, renderError } from '../core/render.js';
import { activeCert } from '../core/certs.js';
import { TID, tid } from '../core/testids.js';
import { getGlossary } from '../core/data.js';

async function main() {
  const page = renderShell('glossary');
  const glossary = await getGlossary();

  const search = el('input', {
    type: 'search',
    testid: TID.glossarySearch,
    placeholder: 'Search terms…',
    'aria-label': 'Search glossary terms',
  });

  const items = glossary.terms.map((term) =>
    el(
      'div',
      { class: 'term', testid: tid.term(slug(term.term)), dataset: { term: term.term, chapters: term.chapters.join(',') } },
      [
        el('div', { class: 'spread' }, [
          el('span', { class: 'term-name', text: term.term }),
          el('span', { class: 'row' }, term.chapters.map((c) => el('span', { class: 'badge', text: `Ch ${c}` }))),
        ]),
        term.context
          ? el('p', { class: 'muted', style: 'margin:8px 0 0', text: term.context })
          : el('p', { class: 'faint', style: 'margin:8px 0 0', text: 'No single-sentence usage found in the syllabus — see the official definition.' }),
        el('p', { class: 'faint', style: 'margin:8px 0 0' }, [
          term.section ? `Syllabus §${term.section} · ` : '',
          el('a', { href: term.glossaryUrl, rel: 'noopener', target: '_blank', text: 'Official ISTQB definition ↗' }),
        ]),
      ],
    ),
  );

  mount(
    page,
    el('h1', { text: `${activeCert().shortName} glossary` }),
    el('p', { class: 'lede' }, [
      `${glossary.totals.terms} keywords listed across the six syllabus chapters. `,
      el('strong', { text: 'The excerpts below are syllabus context, not official definitions' }),
      ' — each entry links to the authoritative ISTQB Glossary.',
    ]),
    el('div', { class: 'field', style: 'max-width:420px' }, [
      search,
      el('p', { class: 'field-hint', testid: TID.glossaryCount, text: `${glossary.totals.terms} terms` }),
    ]),
    el('div', { testid: TID.glossaryList }, items),
  );

  search.addEventListener('input', () => {
    const needle = search.value.trim().toLowerCase();
    let visible = 0;
    for (const node of byTestId(TID.glossaryList).children) {
      const hit = !needle || node.textContent.toLowerCase().includes(needle);
      node.hidden = !hit;
      if (hit) visible += 1;
    }
    byTestId(TID.glossaryCount).textContent = `${visible} of ${glossary.totals.terms} terms`;
    byTestId(TID.glossaryList).dataset.visibleCount = String(visible);
  });

  byTestId(TID.glossaryList).dataset.visibleCount = String(glossary.totals.terms);
  // Scoping root so automation can narrow queries to this page's content.
  page.setAttribute('data-testid', TID.glossaryRoot);

  markReady({ page: 'glossary', terms: String(glossary.totals.terms) });
}

main().catch((err) => {
  const page = document.querySelector('main .wrap') ?? document.body;
  renderError(page, err.message);
  markError(err.message);
});
