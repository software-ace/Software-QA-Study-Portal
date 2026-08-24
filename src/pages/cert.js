/**
 * cert.js — Certification hub: pick an exam set or jump into study/practice.
 *
 * Shared by every certification. All copy comes from the registry entry and
 * the certification's own manifest, so nothing here names one in particular.
 */
import { el, mount, markReady, markError } from '../core/dom.js';
import { renderShell, href, renderError } from '../core/render.js';
import { activeCert, certPaths } from '../core/certs.js';
import { TID, tid } from '../core/testids.js';
import { getManifest } from '../core/data.js';
import { loadSession, listAttempts } from '../core/store.js';

function examCard(exam, rules) {
  return el(
    'div',
    { class: 'card', testid: tid.examCard(exam.id), dataset: { examId: exam.id, examSet: exam.set } },
    [
      el('div', { class: 'spread', style: 'margin-bottom:8px' }, [
        el('h3', { style: 'margin:0', text: `Sample Exam Set ${exam.set}` }),
        el('span', { class: 'badge', 'data-tone': 'accent', text: `v${exam.documentVersion}` }),
      ]),
      el('p', { class: 'muted', style: 'margin-bottom:14px' }, [
        `${exam.counts.exam} questions · ${rules.durationMinutes} minutes · pass at ${rules.passPoints}/${rules.totalPoints} (${rules.passPercent}%)`,
        exam.counts.additional
          ? el('span', { class: 'faint', text: ` · plus ${exam.counts.additional} appendix questions in practice mode` })
          : null,
      ]),
      el('a', {
        class: 'btn',
        'data-variant': 'primary',
        href: `${href(certPaths(activeCert()).exam)}?exam=${encodeURIComponent(exam.id)}`,
        testid: tid.examStart(exam.id),
        text: `Start Set ${exam.set}`,
      }),
    ],
  );
}

async function main() {
  const page = renderShell(`cert-${activeCert().id}`);
  const cert = activeCert();
  const manifest = await getManifest();
  const { rules } = manifest;

  const session = loadSession();
  const attempts = listAttempts();

  const resumeNotice =
    session && !session.submittedAt
      ? el('div', { class: 'notice', 'data-tone': 'warn', testid: TID.resumeNotice }, [
          el('strong', { text: 'You have an exam in progress. ' }),
          `${session.candidateName || 'Unnamed candidate'} — ${session.examId}. `,
          el('a', { href: `${href(certPaths(activeCert()).exam)}?resume=1`, text: 'Resume it' }),
          ' (the clock has kept running).',
        ])
      : null;

  mount(
    page,
    el('h1', { text: cert.shortName }),
    el('p', { class: 'lede' }, [
      `${cert.name}, syllabus version ${cert.version}. Everything here is generated from the official ISTQB syllabus and sample exam ${manifest.exams.length === 1 ? 'paper' : 'papers'} — `,
      el('strong', { text: `${manifest.totals.examQuestions} exam questions` }),
      ` plus ${manifest.totals.additionalQuestions} appendix questions, each with the official answer key and per-option rationale.`,
    ]),

    resumeNotice,

    el('div', { class: 'notice' }, [
      el('strong', { text: 'Exam format: ' }),
      `${rules.questionCount} questions, ${rules.totalPoints} points, ${rules.durationMinutes} minutes. `,
      `You pass at ${rules.passPoints} points (${rules.passPercent}%). `,
      `Candidates sitting the exam in a non-native language are allowed ${rules.extendedDurationMinutes} minutes — you can choose that when you start.`,
    ]),

    el('h2', { text: 'Timed exams' }),
    el('div', { class: 'grid', testid: TID.examList }, manifest.exams.map((e) => examCard(e, rules))),

    el('h2', { text: 'Study tools' }),
    el('div', { class: 'grid' }, [
      el('a', { class: 'card', href: href(certPaths(activeCert()).study), testid: tid.hubCard('study') }, [
        el('h3', { text: 'Syllabus & learning objectives' }),
        el('p', { class: 'muted', text: `All 6 chapters and ${manifest.syllabus?.learningObjectives ?? 64} learning objectives with cognitive levels.` }),
      ]),
      el('a', { class: 'card', href: href(certPaths(activeCert()).practice), testid: tid.hubCard('practice') }, [
        el('h3', { text: 'Practice mode' }),
        el('p', { class: 'muted', text: 'Untimed drilling with instant feedback. Filter by chapter, K-level or exam set.' }),
      ]),
      el('a', { class: 'card', href: href(certPaths(activeCert()).progress), testid: tid.hubCard('progress') }, [
        el('h3', { text: 'Progress' }),
        el('p', { class: 'muted', text: attempts.length ? `${attempts.length} recorded attempt${attempts.length === 1 ? '' : 's'}.` : 'No attempts yet — sit an exam to start tracking.' }),
      ]),
    ]),
  );

  markReady({ page: 'ctfl', examCount: manifest.exams.length });
}

main().catch((err) => {
  const page = document.querySelector('main .wrap') ?? document.body;
  renderError(page, err.message);
  markError(err.message);
});
