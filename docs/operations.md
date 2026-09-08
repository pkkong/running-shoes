# Operations

Verified on 2026-09-08.

## Deployment

- Source: `pkkong/running-shoes`, production branch `main`.
- Hosting: Vercel project `runfit-lineup`.
- Production: https://runfit-lineup.vercel.app
- Native Vercel Git integration is connected. Pushes to `main` deploy automatically;
  do not add a second GitHub Actions deployment workflow or routinely deploy by CLI.
- Commit `a007ac4` successfully deployed through this integration (GitHub Vercel status).
- GitHub Pages publishing is disabled. GitHub owns source history, not hosting.
- Existing access to other repositories was preserved; only `running-shoes` was added.

## Database status

Supabase is NOT connected to production. `/api/health` currently reports
`static-fallback`, with 121 shoes, 9 periods and 716 history entries.

The signed-in Supabase account has reached its two-active-free-project limit.
The existing projects are `kpef-newsletter` and `soulib`; neither was modified,
paused or reused. A dedicated running-shoes project cannot be created on the
current free allocation. Do not claim that a browser login completes DB setup.

Before enabling Supabase, explicitly resolve dedicated-project capacity or obtain
approval for sharing an existing project's resources. Then apply the scoped schema,
seed current data, persist runtime connection settings in Vercel, and verify
production with `node scripts/verify-production.mjs` (without `--allow-fallback`).
Keep database write credentials out of browser code and Git. Never copy browser
session tokens into deployment configuration.

## Routine verification

Run `node --run check`, `node --run audit`, then push to `main`.
Check the commit's Vercel status and production health. Browser sign-in is not
required for ordinary Git pushes; account permission changes may require it.
The temporary `--allow-fallback` verification option is only appropriate while
the database limitation above remains unresolved.
