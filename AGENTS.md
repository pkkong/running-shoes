# Operating this project

- Preserve the existing UI/UX unless the user requests a design change.
- Production uses versioned static data in `data/` and Vercel hosting.
  Supabase integration is deferred by user decision, not a setup task to retry.
- Do not ask for Supabase login, create a DB, retrieve credentials, or configure
  Supabase environment variables during routine feature/data/deployment work.
- Deploy through the existing native GitHub-to-Vercel integration: test, commit
  the intended changes, then push `main`. Do not add GitHub Pages or a second
  deployment workflow. Do not routinely run Vercel login/link/deploy commands.
- Use existing Git authentication and `gh` to check the pushed commit's Vercel
  status. Open account dashboards only if a concrete failure requires it.
- Run `node --run check`, `node --run audit`, and
  `node scripts/verify-production.mjs`. A `static-fallback` source is expected
  and does not require login or DB repair. Use `--require-supabase` only when
  the user explicitly resumes the database migration.
- Never bypass authentication or promise credentials cannot expire. Request
  user authentication only after the required operation actually fails with
  an authentication error and existing authorized authentication cannot work.
- See `docs/operations.md` for project ownership and deployment details.
