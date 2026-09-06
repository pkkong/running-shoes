# RunRepeat review pilot

The ten records in `data/runrepeat-reviews.js` were manually checked against
the exact model's RunRepeat review on 2026-09-06. The score is the overall
number in **Our verdict / Our score**, not a use-case subscore, retailer
rating, search snippet, or score inferred from lineup appearances.

Each record includes the app model ID, brand, exact model, source model name,
score type, score, review URL and check date. Only those facts are stored;
review prose, photographs and laboratory datasets are not copied.

## Display rules

- An exact verified review replaces the chart threshold badge, never adds a second one.
- An unverified model retains its dated chart threshold, if present.
- Missing, malformed, future-dated and variant/family-only matches are not displayed.
- Historical lineup items do not inherit a current generation's review score.
- Scores are snapshots, not live ratings. Detail pages show the source and check date.
- No automatic scraping, scheduled refresh, ranking or recommendations are enabled.

## Storage and Supabase

The static browser data and Vercel fallback bootstrap both load this snapshot.
The existing seed exporters include each review in `runfit_shoes.data.runRepeatReview`.
No additional database table or browser-exposed secret is required.

For an existing database, generate a scoped update:

```sh
node scripts/export-runrepeat-sql.mjs > supabase/runrepeat-reviews.sql
```

This transaction only updates the ten matching shoe records and rolls back if
any exact model is missing. It does not delete or replace lineup data.

As checked on 2026-09-06, production `/api/health` reports `static-fallback`
because Supabase environment variables are not configured. Browser access
also requires GitHub sign-in. The prepared SQL has **not** been applied to
a remote Supabase project. Do not describe the current service as DB-backed
until strict production health verification succeeds.

## Adding or refreshing a record

Open the exact review and verify brand, generation and variant. Read the overall
score, record the check date and source URL, then run `node scripts/audit-runrepeat.mjs`.
Never transfer a score from a predecessor, GTX edition or a similarly named model.
Before expanding beyond this small manual pilot, review the source's current
data-reuse terms and permitted update mechanism.
