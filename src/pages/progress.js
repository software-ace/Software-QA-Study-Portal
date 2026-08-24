/**
 * progress.js — Attempt history and weakest syllabus areas.
 *
 * Everything shown here comes from this browser's localStorage. There is no
 * account and no server, which is a privacy feature and a limitation worth
 * stating plainly on the page.
 */
import { el, mount, markReady, markError, formatClock } from '../core/dom.js';
import { renderShell, renderError, href } from '../core/render.js';
import { activeCert, certPaths } from '../core/certs.js';
import { TID, tid } from '../core/testids.js';
import { listAttempts, clearAttempts, weakAreas, storageAvailable } from '../core/store.js';
import { getSyllabus } from '../core/data.js';

const fmtDate = (ms) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

async function main() {
  const page = renderShell('progress');
  const attempts = listAttempts();

  let titles = new Map();
  try {
    const syllabus = await getSyllabus();
    titles = new Map(syllabus.chapters.map((c) => [c.number, c.title]));
  } catch { /* names are optional */ }

  if (!attempts.length) {
    mount(
      page,
      el('h1', { text: 'Progress' }),
      el('div', { class: 'empty', testid: TID.attemptEmpty }, [
        el('p', { text: storageAvailable
          ? 'No attempts recorded yet. Sit a timed exam and your score, per-chapter breakdown and weak areas will appear here.'
          : 'Your browser is blocking local storage, so attempts cannot be recorded.' }),
        el('a', { class: 'btn', 'data-variant': 'primary', href: href(certPaths(activeCert()).hub), text: 'Choose an exam' }),
      ]),
    );
    markReady({ page: 'progress', attempts: '0' });
    return;
  }

  const best = attempts.reduce((a, b) => (b.awarded > a.awarded ? b : a));
  const passRate = Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100);

  const table = el('div', { class: 'table-scroll' }, [
    el('table', { testid: TID.attemptList }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Date' }),
          el('th', { text: 'Candidate' }),
          el('th', { text: 'Set' }),
          el('th', { class: 'num', text: 'Score' }),
          el('th', { class: 'num', text: '%' }),
          el('th', { text: 'Result' }),
          el('th', { class: 'num', text: 'Time' }),
          el('th', { text: '' }),
        ]),
      ]),
      el(
        'tbody',
        {},
        attempts.map((a) =>
          el('tr', { testid: tid.attempt(a.id), dataset: { attemptId: a.id, passed: String(a.passed), percent: String(a.percent) } }, [
            el('td', { text: fmtDate(a.submittedAt ?? a.startedAt) }),
            el('td', { text: a.candidateName || '—' }),
            el('td', { text: a.examSet }),
            el('td', { class: 'num', text: `${a.awarded}/${a.totalPoints}` }),
            el('td', { class: 'num', text: `${a.percent}%` }),
            el('td', {}, [el('span', { class: 'badge', 'data-tone': a.passed ? 'ok' : 'bad', text: a.passed ? 'Passed' : 'Failed' })]),
            el('td', { class: 'num', text: formatClock(a.elapsedSeconds) }),
            el('td', {}, [el('a', { href: `${href(certPaths(activeCert()).results)}?attempt=${encodeURIComponent(a.id)}`, text: 'Review' })]),
          ]),
        ),
      ),
    ]),
  ]);

  const weak = weakAreas();
  const weakList = el('div', { class: 'table-scroll' }, [
    el('table', { testid: TID.weakAreaList }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Chapter' }),
          el('th', { class: 'num', text: 'Correct' }),
          el('th', { class: 'num', text: 'Seen' }),
          el('th', { class: 'num', text: 'Accuracy' }),
          el('th', { text: '' }),
        ]),
      ]),
      el(
        'tbody',
        {},
        weak.map((w) => {
          const pct = Math.round(w.accuracy * 100);
          return el('tr', { testid: tid.weakArea(w.chapter), dataset: { chapter: String(w.chapter), accuracy: String(pct) } }, [
            el('td', { text: `${w.chapter}. ${titles.get(w.chapter) ?? ''}` }),
            el('td', { class: 'num', text: String(w.correct) }),
            el('td', { class: 'num', text: String(w.seen) }),
            el('td', { class: 'num', text: `${pct}%` }),
            el('td', { style: 'width:120px' }, [
              el('div', { class: 'meter', 'data-tone': pct >= 65 ? 'ok' : 'bad' }, [el('span', { style: `width:${pct}%` })]),
            ]),
          ]);
        }),
      ),
    ]),
  ]);

  const clearButton = el('button', { testid: TID.clearHistoryButton, 'data-variant': 'danger', text: 'Clear history' });
  clearButton.addEventListener('click', () => {
    if (!window.confirm(`Delete all ${attempts.length} recorded attempts? This cannot be undone.`)) return;
    clearAttempts();
    location.reload();
  });

  mount(
    page,
    el('h1', { text: 'Progress' }),
    el('p', { class: 'lede', text: 'Stored only in this browser — no account, no server, nothing uploaded. Clearing site data erases it.' }),
    el('dl', { class: 'stats', testid: TID.progressRoot }, [
      el('div', { class: 'stat' }, [el('dt', { text: 'Attempts' }), el('dd', { testid: tid.stat('attempts'), text: String(attempts.length) })]),
      el('div', { class: 'stat' }, [el('dt', { text: 'Best score' }), el('dd', { testid: tid.stat('best'), text: `${best.awarded}/${best.totalPoints}` })]),
      el('div', { class: 'stat' }, [el('dt', { text: 'Pass rate' }), el('dd', { testid: tid.stat('pass-rate'), text: `${passRate}%` })]),
      el('div', { class: 'stat' }, [el('dt', { text: 'Latest' }), el('dd', { testid: tid.stat('latest'), text: `${attempts[0].percent}%` })]),
    ]),
    el('h2', { text: 'Weakest syllabus areas' }),
    el('p', { class: 'muted', text: 'Aggregated across every attempt, lowest accuracy first. Anything under 65% is where revision pays off most.' }),
    weakList,
    el('h2', { text: 'Attempt history' }),
    table,
    el('div', { class: 'row', style: 'margin-top:20px' }, [clearButton]),
  );

  markReady({ page: 'progress', attempts: String(attempts.length) });
}

main().catch((err) => {
  const page = document.querySelector('main .wrap') ?? document.body;
  renderError(page, err.message);
  markError(err.message);
});
