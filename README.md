# Software QA Study Portal

An open-source, offline-friendly study portal for **software QA and test
automation certifications**, starting with **ISTQB® CTFL v4.0** (Certified Tester
Foundation Level).

Built from the official ISTQB syllabus and all four official sample exam papers:
**186 questions**, every one with the official answer key, learning objective,
cognitive level, and a per-option rationale explaining *why* each answer is right
or wrong.

---

## What it does

| Feature | Detail |
| --- | --- |
| **Timed exams** | All 4 official sample sets (A–D). 40 questions, 60 minutes (or 75 for non-native speakers), pass mark 26/40 — the real ISTQB exam structure. |
| **Full-name gate** | One field, filled in before the clock starts; the name appears on the result. |
| **Live clock** | Deadline-based, so a backgrounded tab cannot win you extra time. Auto-submits at zero. |
| **Crash-safe** | Answers are saved continuously. Refresh or reopen and resume with the real remaining time. |
| **Scoring** | All-or-nothing on `Select TWO` questions, exactly as ISTQB scores them. |
| **Answer review** | Every question shows **the answer you chose**, the official answer, and the official rationale for all options. Filter by correct/incorrect/unanswered. |
| **Practice mode** | Untimed drilling over all 186 questions (including the 26 appendix questions), filtered by chapter, K-level, exam set or pool. |
| **Syllabus browser** | 6 chapters, 64 learning objectives, with how many official questions test each one. |
| **Glossary** | 97 syllabus keywords with syllabus context and links to the official ISTQB glossary. |
| **Progress** | Attempt history and weakest chapters, aggregated across attempts. |
| **Private by design** | No backend, no accounts, no telemetry. Everything is `localStorage`. |

---

## Quick start

Requires **Node.js 20+**. The portal has **no dependencies at all** — no bundler,
no framework, nothing to install.

```bash
git clone https://github.com/software-ace/software-qa-study-portal.git
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

`data/ctfl-v4/` holds the question bank as JSON, derived from the official ISTQB
CTFL v4.0 syllabus and sample exam papers, which were the source for all content
in this repository. Every file records its provenance in a `source` block — the
exact document name, version and release date it came from, plus a link to it:

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
and that every learning objective a question references exists in the syllabus.

If ISTQB publishes a revision, update the affected JSON and its `source` block,
then re-run the tests.

---

## Project layout

```
index.html                 Portal home — certifications and role tracks
ctfl-v4/
  index.html               CTFL v4.0 hub
  exam.html                Timed exam runner (name gate -> paper -> submit)
  results.html             Score, chapter breakdown, full answer review
  practice.html            Untimed practice with instant feedback
  study.html               Syllabus + learning-objective browser
  glossary.html            Searchable keyword index
  progress.html            Attempt history and weak areas
src/
  core/
    testids.js             Locator contract — single source of truth
    engine.js              Exam state + scoring (pure logic, unit-tested)
    render.js              Shared UI building blocks
    store.js               localStorage persistence
    data.js                Data loading
    rng.js                 Seedable shuffle for reproducible runs
    dom.js                 Tiny DOM helpers
  pages/                   One module per page
data/ctfl-v4/              The question bank, syllabus and glossary (JSON)
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

**GitHub Pages** is wired up already. In *Settings → Pages*, set the source to
**GitHub Actions**; [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
then publishes the repository root on every push to `main`.

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

- **CTAL-TAE** (Test Automation Engineering) and **CTFL-AT** (Agile Tester) content
- Accessibility and i18n improvements

Roadmap and known limitations are in [CONTRIBUTING.md](CONTRIBUTING.md#roadmap).
