/**
 * render.js — Shared UI building blocks.
 *
 * Every interactive node gets its `data-testid` from src/core/testids.js, and
 * every piece of state that a test might assert on is exposed as a `data-*`
 * attribute rather than a CSS class.
 */
import { el, params } from './dom.js';
import { TID, tid, STATE } from './testids.js';
import { activeCert, certPaths, CERT_LIST, SECTIONS, isCertScoped } from './certs.js';

/** Root-relative prefix so nested pages link correctly with no build step. */
export const ROOT = new URL('../../', import.meta.url).pathname;
export const href = (p) => `${ROOT}${p}`.replace(/\/{2,}/g, '/');

/**
 * Navigation for the certification the current page belongs to.
 *
 * The study/practice/progress links are certification-scoped, so a
 * learner working through one certification never lands on another's content by
 * accident. Every available certification also gets a top-level link, so
 * switching is one click from anywhere.
 */
function navItems() {
  const cert = activeCert();
  const testids = {
    study: TID.studyLink,
    practice: TID.practiceLink,
    progress: TID.progressLink,
  };
  return [
    { label: 'Portal', path: 'index.html', key: 'home' },
    ...CERT_LIST.filter((c) => c.available).map((c) => ({
      label: c.navLabel,
      path: certPaths(c).hub,
      key: `cert-${c.id}`,
      current: c.id === cert.id && document.body.dataset.page === 'cert',
    })),
    // These point at the root chooser, not at a certification's page. The nav
    // must never decide which certification the learner meant.
    ...Object.values(SECTIONS).map((sec) => ({
      label: sec.label,
      path: sec.page,
      key: sec.key,
      testid: testids[sec.key],
    })),
  ];
}

export function renderHeader(activeKey) {
  return el('header', { class: 'site-header', testid: TID.siteHeader }, [
    el('div', { class: 'wrap' }, [
      el('a', { class: 'brand', href: href('index.html') }, [
        'Software QA Study ', el('span', { text: 'Portal' }),
      ]),
      el(
        'nav',
        { class: 'site-nav', testid: TID.siteNav, 'aria-label': 'Main navigation' },
        navItems().map((item) =>
          el('a', {
            href: href(item.path),
            text: item.label,
            testid: item.testid ?? tid.navLink(item.key),
            'aria-current': item.current || item.key === activeKey ? 'page' : null,
          }),
        ),
      ),
    ]),
  ]);
}

/**
 * Footer carrying the ISTQB attribution.
 *
 * This is a licence obligation, not decoration: ISTQB permits non-commercial
 * use of extracts provided the source is acknowledged, so the acknowledgement
 * ships on every page.
 */
export function renderFooter() {
  return el('footer', { class: 'site-footer', testid: TID.siteFooter }, [
    el('div', { class: 'wrap' }, [
      el('p', { testid: TID.attribution }, [
        'Exam questions, answers and syllabus content are © ',
        el('a', {
          href: 'https://istqb.org/',
          text: 'International Software Testing Qualifications Board (ISTQB®)',
          rel: 'noopener',
          target: '_blank',
        }),
        `, reproduced from the official ${
          isCertScoped()
            ? `${activeCert().code} v${activeCert().version} sample exams and syllabus`
            : 'ISTQB syllabi and sample exams'
        } for non-commercial study use with acknowledgement of the source. ISTQB® is a registered trademark. This portal is not affiliated with, endorsed by, or accredited by the ISTQB.`,
      ]),
      el('p', {}, [
        'Open source under the MIT licence (portal code only). ',
        // Points at the repository rather than the local README: a static host
        // serves a .md file as raw markdown, which is not a readable page.
        el('a', {
          href: 'https://github.com/software-ace/Software-QA-Study-Portal',
          rel: 'noopener',
          target: '_blank',
          text: 'Source and documentation',
        }),
      ]),
      // Author credit, deliberately separate from the ISTQB notice above so the
      // licence attribution is never diluted by anything else.
      el('p', { class: 'credit', testid: TID.credit }, [
        'Developed by ',
        el('a', {
          href: 'https://github.com/software-ace',
          rel: 'noopener',
          target: '_blank',
          text: 'software-ace',
        }),
        ' with :3',
      ]),
    ]),
  ]);
}

/** Wire up the page shell. Call once per page, before rendering content. */
export function renderShell(activeKey) {
  const skip = el('a', { class: 'skip-link', href: '#main', text: 'Skip to content' });
  const main = el('main', { id: 'main', testid: TID.app }, [el('div', { class: 'wrap' })]);
  document.body.prepend(skip, renderHeader(activeKey), main);
  document.body.append(renderFooter());
  if (params.get('noanim') === '1') document.body.dataset.noanim = 'true';
  return main.firstElementChild; // the .wrap container for page content
}

// --- question rendering ----------------------------------------------------

/** Render the stem blocks produced by the parser (paragraphs, lists, tables). */
export function renderStem(blocks, ref) {
  return el(
    'div',
    { class: 'stem', testid: tid.questionStem(ref) },
    blocks.map((block) => {
      if (block.type === 'list') {
        return el('ul', {}, block.items.map((item) => el('li', { text: item })));
      }
      if (block.type === 'table') {
        // Preserved verbatim: the official documents encode these as aligned
        // text, and re-flowing them would destroy the data the question is about.
        return el('pre', { role: 'img', 'aria-label': 'Data table from the question' }, [
          block.lines.join('\n'),
        ]);
      }
      return el('p', { text: block.text });
    }),
  );
}

const KEY_LABEL = (k) => `${k})`;

/**
 * Render one question's answer options.
 *
 * @param {object} question
 * @param {object} opts
 * @param {Set<string>} opts.selected
 * @param {boolean} [opts.disabled]
 * @param {boolean} [opts.showAnswers]  reveal correctness + rationale (review)
 * @param {Function} [opts.onToggle]
 */
export function renderOptions(question, opts = {}) {
  const { selected = new Set(), disabled = false, showAnswers = false, onToggle } = opts;
  const multi = question.selectCount > 1;
  const inputType = multi ? 'checkbox' : 'radio';

  const fieldset = el('fieldset', { class: 'options', testid: tid.questionOptions(question.ref) }, [
    el('legend', { text: `Answer options for question ${question.ref}` }),
  ]);

  for (const option of question.options) {
    const isSelected = selected.has(option.key);
    const isCorrect = option.correct;

    let verdict = null;
    if (showAnswers) {
      if (isSelected && isCorrect) verdict = STATE.correct;
      else if (isSelected && !isCorrect) verdict = STATE.incorrect;
      else if (!isSelected && isCorrect) verdict = 'missed';
    }

    const input = el('input', {
      type: inputType,
      name: `q-${question.ref}`,
      value: option.key,
      id: tid.optionInput(question.ref, option.key),
      testid: tid.optionInput(question.ref, option.key),
      checked: isSelected,
      disabled,
    });
    if (isSelected) input.setAttribute('checked', '');

    const label = el(
      'label',
      {
        class: 'option',
        for: tid.optionInput(question.ref, option.key),
        testid: tid.option(question.ref, option.key),
        dataset: {
          optionKey: option.key,
          selected: String(isSelected),
          verdict,
          correct: showAnswers ? String(isCorrect) : null,
        },
      },
      [
        input,
        el('span', { class: 'option-key', text: KEY_LABEL(option.key) }),
        el('span', { class: 'option-text' }, [
          el('span', { testid: tid.optionLabel(question.ref, option.key), text: option.text }),
          showAnswers && option.rationale
            ? el('span', {
                class: 'rationale',
                testid: tid.reviewRationale(question.ref, option.key),
                text: option.rationale,
              })
            : null,
        ]),
      ],
    );

    if (onToggle && !disabled) {
      // Handle on the input's change event so keyboard and pointer behave alike.
      input.addEventListener('click', (event) => {
        event.preventDefault();
        onToggle(question.ref, option.key);
      });
      label.addEventListener('click', (event) => {
        if (event.target !== input) {
          event.preventDefault();
          onToggle(question.ref, option.key);
        }
      });
    }

    fieldset.append(label);
  }

  return fieldset;
}

/** Metadata badges (chapter, learning objective, K-level). */
export function renderMeta(question) {
  return el('div', { class: 'question-meta' }, [
    el('span', { class: 'badge', text: `Ch ${question.chapter}`, title: `Syllabus chapter ${question.chapter}` }),
    el('span', { class: 'badge', text: question.learningObjective, title: 'Learning objective' }),
    el('span', { class: 'badge', text: question.kLevel, title: 'Cognitive level' }),
  ]);
}

/** A full question card for the exam and practice runners. */
export function renderQuestionCard(question, opts = {}) {
  const { index, total, selected, disabled, showAnswers, onToggle, showMeta = true } = opts;

  return el(
    'article',
    {
      class: 'question',
      id: tid.question(question.ref),
      testid: tid.question(question.ref),
      dataset: {
        questionRef: question.ref,
        questionIndex: index ?? null,
        selectCount: question.selectCount,
        chapter: question.chapter,
        kLevel: question.kLevel,
        learningObjective: question.learningObjective,
        state: selected?.size === question.selectCount ? STATE.answered : STATE.unanswered,
      },
      'aria-labelledby': `${tid.question(question.ref)}-head`,
    },
    [
      el('div', { class: 'question-head' }, [
        el('span', {
          class: 'question-number',
          id: `${tid.question(question.ref)}-head`,
          text: index != null && total != null ? `Question ${index} of ${total}` : `Question ${question.ref}`,
        }),
        showMeta ? renderMeta(question) : null,
      ]),
      renderStem(question.stem, question.ref),
      el('p', {
        class: 'select-hint',
        text: question.selectCount === 1 ? 'Select ONE option.' : `Select ${question.selectCount} options.`,
      }),
      renderOptions(question, { selected, disabled, showAnswers, onToggle }),
      el('p', { class: 'limit-note', testid: tid.limitNote(question.ref), 'aria-live': 'polite' }),
    ],
  );
}

/** Consistent error surface — also sets body[data-app-ready="error"]. */
export function renderError(container, message) {
  container.append(
    el('div', { class: 'notice', 'data-tone': 'bad', testid: TID.appError }, [
      el('strong', { text: 'Something went wrong. ' }),
      message,
    ]),
  );
}
