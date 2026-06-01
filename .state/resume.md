# Resume

## Current State

- **Last completed phase:** Phase 16 — README + Documentation
- **Pending phase:** Phase 15 — Railway Deploy + Smoke Test (Active — awaiting live URL)
- **All code committed and pushed:** `main` branch at `cc13f9e`

## What Was Done

Phases 0–14 and 16 are fully complete and committed. Phase 15 is Active — code is on GitHub, user is performing Railway setup manually.

## Railway Setup Steps (user is doing these now)

1. railway.app → New Project → Deploy from GitHub → `aakarshsingh/katari-vanshavali`
2. + New → Database → PostgreSQL (injects `DATABASE_URL` automatically)
3. Service Variables: add `ANTHROPIC_API_KEY=sk-ant-...` and `PORT=3000`
4. Deploy — start command is `npm run migrate && npm start` (from `railway.toml`)
5. Shell tab: `node scripts/seed-pdf.js` then `npm run seed`
6. Return with the live Railway URL for smoke-test verification

## What To Do On Resume

User will return with a Railway URL. Run smoke-test verification:

```bash
curl https://<railway-url>/health
# expect: {"status":"ok"}

curl https://<railway-url>/api/tree
# expect: {"tree":{...},"persons":[...],"relationships":[...]}
```

Then ask user to confirm in browser:
- Tree renders with seeded family data
- Add a test person → reload → confirm it persists
- Export PNG and PDF from the live URL

Once all checks pass:
- Mark Phase 15 **Completed** in `.state/execution_plan.md`
- Tick all Self-Audit items
- Fill Completion Record
- Commit `.state/execution_plan.md`

## Read First On Resume

1. `.state/execution_plan.md` — Phase 15 section (verification checklist)

## Resume Prompt

> I'm building a Vanshavali (Indian family tree) web tool. Phases 0–14 and 16 are
> complete and committed. Phase 15 (Railway Deploy) is Active — I've just finished
> the Railway setup. The live URL is https://<your-url>. Run `/as-p5-execute` to
> complete Phase 15 by running smoke-test verification against that URL, then mark
> it Completed in `.state/execution_plan.md`.
