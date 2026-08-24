# Software QA Study Portal

[![CI](https://github.com/software-ace/Software-QA-Study-Portal/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/software-ace/Software-QA-Study-Portal/actions/workflows/ci.yml)
[![Deploy static content to Pages](https://github.com/software-ace/Software-QA-Study-Portal/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/software-ace/Software-QA-Study-Portal/actions/workflows/pages.yml)

**▶ [Open the portal](https://software-ace.github.io/Software-QA-Study-Portal/)** — no install, runs entirely in your browser.

An open-source, offline-friendly study portal for **software QA and test
automation certifications**.

| Certification | Content |
| --- | --- |
| **ISTQB® CTFL v4.0** — Certified Tester Foundation Level | 4 sample exam sets, **186 questions**, 6 chapters, 64 learning objectives |
| **ISTQB® CTAL-TAE v2.0** — Advanced Level Test Automation Engineering | 1 sample exam set, **40 questions**, 8 chapters, 29 learning objectives |

Every question carries the official answer key, learning objective, cognitive
level, and a per-option rationale explaining *why* each answer is right or wrong.

---

## What it does

| Feature | Detail |
| --- | --- |
| **Timed exams** | The official sample sets, under the real ISTQB structure for each certification — CTFL: 40 questions, 40 points, 60 min, pass 26. CTAL-TAE: 40 questions, **66 points** (weighted 1–3 by cognitive level), 90 min, pass 43. |
| **Full-name gate** | One field, filled in before the clock starts; the name appears on the result. |
| **Live clock** | Deadline-based, so a backgrounded tab cannot win you extra time. Auto-submits at zero. |
| **Crash-safe** | Answers are saved continuously. Refresh or reopen and resume with the real remaining time. |
| **Scoring** | All-or-nothing on `Select TWO` questions, exactly as ISTQB scores them. |
| **Answer review** | Every question shows **the answer you chose**, the official answer, and the official rationale for all options. Filter by correct/incorrect/unanswered. |
| **Practice mode** | Untimed drilling over the whole question bank (including CTFL's 26 appendix questions), filtered by chapter, K-level, exam set or pool. |
| **Syllabus browser** | Every chapter and learning objective, with how many official questions test each one. |
| **Glossary** | Syllabus keywords with context and links to the official ISTQB glossary. |
| **Progress** | Attempt history and weakest chapters, tracked separately per certification. |
| **Private by design** | No backend, no accounts, no telemetry. Everything is `localStorage`. |

---

## Quick start

Requires **Node.js 20+**. The portal has **no dependencies at all** — no bundler,
no framework, nothing to install.

```bash
git clone https://github.com/software-ace/Software-QA-Study-Portal.git
cd software-qa-study-portal

node scripts/serve.mjs
# → http://127.0.0.1:8080/
```

> A local server is required, not optional: browsers refuse to load ES modules
> and `fetch()` JSON from `file://` URLs. The server uses only Node's built-in
> HTTP module, so there is still nothing to install.

Run the tests:

```bash
node --test
```

Both are also wired up as `npm start` / `npm test` if you prefer, but no package
manager is needed — there are no dependencies to install.

---

## The question bank

`data/<cert>/` holds each question bank as JSON, derived from the official ISTQB
syllabi and sample exam papers, which were the source for all content in this
repository. Every file records its provenance in a `source` block — the exact
document name, version and release date it came from, plus a link to it:

```json
"source": {
  "publisher": "International Software Testing Qualifications Board (ISTQB®)",
  "questionsDocument": "ISTQB_CTFL_v4.0_Sample-Exam-A-Questions",
  "documentVersion": "1.7",
  "release": "April 1, 2025",
  "url": "https://istqb.org/sdm_downloads/istqb_ctfl_v4-0_sample-exam-a-questions_v1-6/"
}
```

The full list of source documents is in [NOTICE](NOTICE).

The test suite guards the integrity of this data: it checks that every question's
correct-answer flags agree with its answer key, that `selectCount` matches the
number of official answers, that each set totals 40 points across 40 questions,
that every learning objective a question references exists in the syllabus, and
that each certification's rules match its published ISTQB exam structure.

**A note on the CTAL-TAE source.** The official answer document contains two
errata: questions 4 and 28 label their per-option rationales with the wrong
letters (`a,b,c,e` and `a,f,g,h` for four-option questions). The rationale text
is correct; only the labels are wrong. The generated data remaps them
positionally, and that remap is verified — the rationale reading "is correct"
must land on the option the answer key marks correct, or it is not applied.

If ISTQB publishes a revision, update the affected JSON and its `source` block,
then re-run the tests.

---

## Project layout

```
index.html                 Portal home — certifications and role tracks
study.html                 Certification choosers: the nav asks which
practice.html                certification you mean before showing any
glossary.html                certification-specific content
progress.html
ctfl-v4/                   One directory of page shells per certification
  index.html               Certification hub
  exam.html                Timed exam runner (name gate -> paper -> submit)
  results.html             Score, chapter breakdown, full answer review
  practice.html            Untimed practice with instant feedback
  study.html               Syllabus + learning-objective browser
  glossary.html            Searchable keyword index
  progress.html            Attempt history and weak areas
ctal-tae-v2/               Same seven shells, same page modules
src/
  core/
    certs.js               Certification registry + the choosable sections
    testids.js             Locator contract — single source of truth
    engine.js              Exam state + scoring (pure logic, unit-tested)
    render.js              Shared UI building blocks
    store.js               localStorage persistence
    data.js                Data loading
    rng.js                 Seedable shuffle for reproducible runs
    dom.js                 Tiny DOM helpers
  pages/                   One module per page (choose.js backs all four choosers)
data/<cert>/               The question bank, syllabus and glossary (JSON)
scripts/serve.mjs          Zero-dependency static server
tests/
  engine.test.mjs          Scoring logic
  data.test.mjs            Question-bank integrity
  contract.test.mjs        Locator contract
```

---

## Stable element locators

Every interactive element carries a `data-testid`, and UI state is exposed through
`data-*` attributes (`data-state="answered"`, `data-verdict="correct"`) rather
than CSS classes. Those names all come from one file,
[`src/core/testids.js`](src/core/testids.js), which is the single source of truth —
nothing hand-writes a `data-testid`.

This keeps the markup self-describing and refactor-safe: renaming a locator in one
place cannot leave a stale copy behind. The test suite enforces it, checking that
every entry in the contract is actually rendered, that none has become dead, and
that no container id shadows the items inside it.

The pages also set `body[data-app-ready="true"]` once their initial render is
complete, and accept `?seed=<n>` for a reproducible question order and `?noanim=1`
to disable transitions.

---

## Deploying

The portal is fully static — no build step, no server-side code, no dependencies.
Any static host works: GitHub Pages, Netlify, Cloudflare Pages, S3. Serve the
repository root.

**GitHub Pages** is live at **<https://software-ace.github.io/Software-QA-Study-Portal/>**.
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes the
repository root on every push to `main`.

Project sites are served from a subpath (`https://<user>.github.io/<repo>/`), which
breaks a lot of static sites. This one resolves every path relative to the module
that needs it, so it works unmodified at any depth — no base-URL setting to
configure. `.nojekyll` is present so the files are published exactly as committed.

Keep the ISTQB attribution in the footer (see below).

---

## Licence and attribution — please read

- **Portal code** (`src/`, `scripts/`, `styles/`, HTML): MIT — see [LICENSE](LICENSE).
- **ISTQB content** (`data/ctfl-v4/*.json`): © International Software Testing
  Qualifications Board. **Not MIT.** See [NOTICE](NOTICE).

The ISTQB permits non-commercial use of extracts from its syllabus and sample
exams **provided the source is acknowledged**. This project therefore:

1. displays the ISTQB acknowledgement in the footer of every page;
2. is for **non-commercial** study use only.

If you fork or host this, keep the attribution and the `NOTICE` file. If you want
to use the content commercially, you need written permission from the ISTQB first.

**Not affiliated with the ISTQB.** This is an independent community study aid, not
an accredited training product. Only an ISTQB-recognised exam provider can
certify you.

---

## Credits

Developed by [software-ace](https://github.com/software-ace) with :3

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The most valuable contributions right now:

- **CTFL-AT** (Agile Tester) content
- Accessibility and i18n improvements

Roadmap and known limitations are in [CONTRIBUTING.md](CONTRIBUTING.md#roadmap).
