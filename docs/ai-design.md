# AI in BizReady — design, and why none of it is built yet

**Status: design only. No AI code exists in this repository, deliberately.**

The decision taken at the start of the audit was to plan AI and build nothing.
This document is that plan. It exists as a document rather than as code because
the honest sequencing is: the grounding has to be real before the model is
allowed near a user, and most of that grounding only became real during this
pass.

---

## 1. Why not yet

A compliance product with ungrounded AI is a liability. Not a reputational
one — a financial one, for the user. If the model says "your VAT return is due
on the 20th" and it is due on the 15th, the user pays a penalty and the product
caused it. There is no disclaimer that makes that acceptable, because the whole
value proposition is that the dates are right.

So the bar is not "the model is usually correct". The bar is **the product can
show where every claim came from, and refuses when it cannot**. That is the same
bar the rest of the system now meets:

- `content/legal-basis.ts` — every task declares whether a law requires it, and
  an invariant refuses to let a `statute` claim ship without a citation.
- `content/filing-rules.ts` — every statutory date declares its anchor, its
  source page, and the date a human verified it.
- `content/figures.ts` — every amount carries its tax year and its source, and a
  build-time test stops any of them being retyped into prose.
- `staleness.ts` + `content/review-queue.ts` — the product knows which of its own
  claims it is no longer sure about.
- `content/source-watch.ts` — it notices when a source page changes.
- Migration 014 — an append-only, hash-chained event log, so what the user did
  is provable rather than merely recorded.

That corpus is the thing AI would retrieve over. Before it existed, retrieval
would have been over unsourced prose with no review dates — which is how you
build a machine that is confidently wrong at scale.

**One more precondition, and it is not technical.** The review queue has to be
something a human actually works. An AI layer over a corpus nobody reviews just
launders stale content into fluent answers.

---

## 2. What it must never do

These are constraints, not preferences. Each one exists because the
corresponding failure already happened somewhere in this codebase without AI.

| Constraint | The failure it prevents |
|---|---|
| **Never assert a legal duty without a citation from the corpus.** | 28 of 70 templates were `critical`, including `pricing`. Unsourced legal claims were already the product's biggest defect. |
| **Never state a date it did not get from `filing-rules.ts`.** | The hand-written rule text said "מקוון — עד ה-19" beside a date computed for the 15th. A model paraphrasing dates will do this constantly. |
| **Never change state.** No completing a task, no marking a filing done, no writing evidence. | A webhook used to be able to set `status: "done"` and write an `auto_verified` event. That was evidence forgery. A model doing it is the same thing with better prose. |
| **Refuse when ungrounded.** "I don't know, here is who to ask" is a correct answer. | `data.ts` used to render "no data" as "you are compliant". Fluent uncertainty is that bug with a vocabulary. |
| **Never infer a figure.** Amounts come from `FIGURES` or not at all. | Eleven of thirteen figures were dead config while the numbers lived in prose. A model interpolating "roughly ₪120,000" is worse than either. |
| **Log every prompt and response.** | The audit trail had no actor column. An AI action with no record of what was asked is unauditable by construction. |

---

## 3. The first use case, and why this one

**Classify an authority letter → map it to a task and a deadline → human
confirms.**

Not a chatbot. A chatbot invites exactly the open-ended legal questions the
product must refuse, and its failure mode is a confident wrong answer with no
paper trail.

This one is narrow, high-value, and structurally safe:

- **The input is a document the user chose to upload.** Bounded, not a
  conversation.
- **The output is a classification over a closed set** — one of ~75 template
  ids, plus optionally a date found in the letter. Not free text. A closed
  output space is checkable.
- **It is genuinely painful today.** A letter from רשות המסים arrives, and the
  user does not know which obligation it refers to or what the deadline is.
  That is the single most common "what do I do with this" moment.
- **Every answer is confirmed by a human before anything happens.** The model
  proposes; the user accepts. Which is the pattern `integrations/execute.ts`
  already uses: it writes `__proposed_evidence` and a notification, and never
  sets `status: "done"`.

### Shape

```
upload → OCR/extract text
       → retrieve candidate templates from the versioned corpus
       → model returns { templateId, confidence, dateFound?, quotedEvidence }
       → REFUSE if confidence low or no template matches
       → render as a PROPOSAL with the quoted text that justified it
       → user accepts → normal completeTask path, with actor_kind = "owner"
                        and the proposal recorded in the event detail
```

`quotedEvidence` is required, not optional: the model must point at the words in
the letter that led to its answer. A classification with no quote is rejected
before it reaches the user. That is what makes the output checkable in one
glance rather than trusted.

### What "refuse" looks like

> לא זיהינו בוודאות לאיזו חובה המכתב הזה מתייחס. אפשר לשייך אותו ידנית, או
> להעלות אותו לתיק המסמכים ולהתייעץ עם רו״ח.

No guess ranked as "probably". A wrong template id on an authority letter sends
the user to do the wrong thing on the wrong date.

---

## 4. Architecture

```
                    ┌─────────────────────────────┐
                    │  versioned content corpus   │
                    │  templates + filing rules   │
                    │  + figures, each with a      │
                    │  source URL, a review date  │
                    │  and a content_version      │
                    └──────────────┬──────────────┘
                                   │ retrieval (closed set)
                                   ▼
  user document ──► extract ──► model ──► { templateId, confidence,
                                            dateFound?, quotedEvidence }
                                   │
                                   ├─► confidence < threshold ──► refuse
                                   ├─► no citation ────────────► reject
                                   └─► proposal ──► human confirms ──► write
                                                   (existing completeTask path)
                                   │
                                   ▼
                    ai_interactions (append-only: prompt,
                    response, model id, content_version,
                    accepted/rejected, actor)
```

Retrieval is over the corpus **only**. No open web, no model world-knowledge
about Israeli tax law. If the answer is not in the corpus, the corpus is what
needs fixing — and the review queue is where that gets recorded.

`content_version` is stamped on every interaction so the question "which rules
was this answer generated under?" is answerable a year later. The same stamp
belongs on generated plans (item C24), for the same reason.

---

## 5. What would have to exist first

In order:

1. **A worked review queue.** Not the code — the habit. If the queue has
   unresolved `statute` items, AI is premature.
2. **`content_version` stamped on plans and answers.** Without it, no answer is
   reproducible or auditable.
3. **An eval set of real authority letters** with known-correct template ids,
   including the hard ones: a letter that refers to two obligations, a letter
   about an obligation the product does not model, a letter for an entity type
   the user is not. The last two must produce refusals, and **refusal rate on
   out-of-scope input is the primary metric** — not accuracy on easy cases.
4. **A cost and latency budget.** An OCR-plus-model call per upload is not free,
   and the feature has to survive its own success.
5. **A migration for `ai_interactions`**, append-only and hash-chained like
   `task_events`, so the log cannot be edited after the fact.

---

## 6. Deliberately out of scope

- **A general compliance chatbot.** Unbounded legal questions, unbounded
  liability, and a refusal rate high enough to be useless if done honestly.
- **Generating legal content.** The 70 templates are written by a human against
  a cited source and carry a review date. A model writing new ones would produce
  content with no source and no reviewer, which is the exact opposite of the
  direction this pass took the product.
- **Auto-filing anything.** Not a technical limit. Nothing should submit a
  statutory return on a user's behalf without an explicit, per-filing human act.
- **Inferring figures or dates not in the corpus.** See the constraints table.

---

## 7. The one-line test

Before shipping any AI feature here, answer this: **if the model is wrong, what
does it cost the user, and would they be able to tell?**

For the letter classifier: a wrong answer costs them a moment's confusion,
because it is a proposal shown next to the quoted text that justified it, and
they confirm it. They can tell immediately.

For a chatbot answering "when is my VAT due": a wrong answer costs them a
penalty, and they cannot tell until it is too late.

That difference is the whole design.
