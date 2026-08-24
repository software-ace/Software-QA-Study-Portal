# Contributing

Thanks for helping. This project exists so people can prepare for testing
certifications for free.

## Ground rules

1. **No dependencies.** The site is vanilla HTML + ES modules + CSS with no build
   step, and the tests run on Node's built-in test runner. Keep it that way: no
   bundler, no framework, no lockfile.
2. **Never hand-write a `data-testid`.** Add it to
   [`src/core/testids.js`](src/core/testids.js) and reference it from there. That
   file is the single source of truth for locators, and the tests enforce it.
3. **A container's test id must not be a prefix of the ids it contains.** Use
   `*-panel` / `*-table` for containers, so a `[data-testid^="question-"]` sweep
   cannot also match the list wrapper.
4. **State goes in `data-*`, not in CSS classes.** Keeps behaviour assertions
   independent of styling.
5. **Keep the ISTQB attribution.** It is a licence obligation, not decoration. See
   [NOTICE](NOTICE).

## Setup

Requires **Node.js 20+** and nothing else — there is nothing to install.

```bash
node scripts/serve.mjs   # serve at http://127.0.0.1:8080
node --test              # unit, data-integrity and locator-contract tests
```

Pass no path to `node --test`: it discovers `tests/*.test.mjs` on its own, and it
is the only invocation that behaves the same on every supported Node version.
CI runs the suite on Node 24 (Active LTS).

## Changing the question bank

`data/ctfl-v4/` holds the question bank derived from the official ISTQB documents
that were the source for this repository's content. Each file records the exact
source document, version and release date in its `source` block; keep that
accurate if you change the content.

The tests will fail if the data becomes internally inconsistent — a question
whose correct-answer flags disagree with its answer key, a `selectCount` that does
not match the number of official answers, a set that no longer totals 40 points,
or a learning objective that does not exist in the syllabus.

**Do not relax those checks to make a change pass.** Wrong answers in a study tool
actively harm the people using it. If a check fails, the data is wrong.

## Adding a new certification

1. Add `data/<cert>/manifest.json` in the same shape as `data/ctfl-v4/manifest.json`,
   with a `source` block recording where the content came from.
2. Add the pages under `<cert>/`, reusing `src/core/*` — the engine, renderer and
   store are certification-agnostic.
3. Register the certification in `src/pages/home.js`.
4. Add integrity tests mirroring `tests/data.test.mjs`.

Only mark a certification "Available" when it has a real, validated question bank.
Promising content that does not exist wastes people's study time.

## Roadmap

- [ ] CTAL-TAE (Advanced Test Automation Engineering)
- [ ] CTFL-AT (Agile Tester)
- [ ] Flashcard / spaced-repetition mode over the 64 learning objectives
- [ ] Exportable/importable progress (currently `localStorage` only)
- [ ] Optional PWA/offline install

## Known limitations

- **Progress is per-browser.** No accounts, so history does not follow you across
  devices, and clearing site data erases it. This is a deliberate privacy trade-off.
- **Glossary entries are context, not definitions.** The syllabus publishes keyword
  *lists*, not definitions; entries show a verbatim syllabus excerpt and link to the
  official ISTQB glossary. We do not invent definitions.
- **Only sample-exam questions.** These are the official practice papers, not the
  live exam bank. ISTQB states real exams may be harder or easier.
- **One in-flight session at a time.** Starting a new exam replaces any unsubmitted one.
