# Enova Brain Studio — Deploy & Rollback Runbook

The source is **`Enova_Brain_Studio_2.html`**. The deploy file **`index.html`** is the *precompiled
production build* of that source (JSX compiled ahead of time, in-browser Babel removed — faster load,
no Babel console warnings). Vercel serves `index.html` from the GitHub repo. Backend: Supabase
(project `rjvcynsojdgyckhgrlfd`).

---

## Deploy (normal)

1. Make the change in `Enova_Brain_Studio_2.html`.
2. **Run the gate:** `bash run_all_tests.sh` — must print **ALL … CHECKS PASSED**.
3. **Build the deploy file:** `node build_prod.js && cp index.prod.html index.html`
   (or `npm run build`). This precompiles the JSX and strips babel-standalone.
4. Commit + push `index.html` (and the source). GitHub Actions (`.github/workflows/ci.yml`) runs the
   portable gate — it rebuilds from source and confirms `index.html` is that exact precompiled build.
5. Vercel auto-deploys `index.html` from the default branch.

> `index.prod.html` and `index.offline.html` are build artifacts (git-ignored); only `index.html`
> and the source are committed.

> Keep a timestamped backup before each deploy (the `backups/` folder convention:
> `Enova_Brain_Studio_2_<YYYYMMDD_HHMMSS>_<label>.html`).

## Rollback (app)

The fastest rollback is **git**: `git revert <bad_commit>` (or reset `index.html` to the last
good commit) and push — Vercel redeploys the previous file within a minute. If git is unavailable,
copy the most recent known-good file from `backups/` over `index.html` and push. Every backup is a
complete, self-contained app, so any one of them is a full restore point. After rolling back, run
`bash run_all_tests.sh` on the restored file to confirm it is green.

## Database (Supabase) changes

- Schema changes are applied as **named migrations** (visible in Supabase → Database → Migrations),
  so the history is auditable and each is individually reversible.
- **RLS is the security boundary** — only the seven admins (rows in `studio_roles` with `role='admin'`)
  can write `studio_projects` / `studio_inventory`. To grant edit access, insert/update a row in
  `studio_roles`; to revoke, set the role to `viewer` or delete the row.
- **Never widen a policy back to `USING (true)` for writes** and never drop the `is_studio_admin()`
  check — that reopens the "any signed-in user can change everything" hole.

## Where to look when something is wrong

- **Client errors** are logged to `studio_errors` (admins can read them; append-only). Query the
  latest: `select created_at, kind, message, url from studio_errors order by id desc limit 50;`
- **Audit / e-signatures** are in the immutable, hash-chained `studio_audit` (append-only — no
  update/delete policy). To verify the chain has not been tampered with, walk it in `id` order and
  confirm each row's `prev_hash` equals the previous row's `entry_hash`.
- **A white screen** should no longer happen — the global error boundary catches component crashes
  and shows a recoverable "Reload" card, logging the stack to `studio_errors`.

## Incident checklist

1. Roll back the app (git revert / restore a backup) to stop the bleeding.
2. Pull the last 50 rows of `studio_errors` to see the stack traces and which users hit it.
3. Reproduce locally against `Enova_Brain_Studio_2.html`, add a regression test that fails, fix it,
   confirm `run_all_tests.sh` is green, redeploy.
4. If a migration is implicated, write a forward migration that corrects it (don't hand-edit the DB).

## Things only a human can do (Supabase dashboard)

- **Enable leaked-password protection** and require strong passwords (Auth → Policies).
- **Disable open sign-ups** / restrict to `@enovascience.com` (Auth → Providers). A DB trigger already
  rejects non-`@enovascience.com` signups as defense-in-depth, but the dashboard setting is the front door.
- **Enable Point-in-Time Recovery** and run a **test restore** at least once so the backup is proven.
- In branch protection, mark the CI **test** check as **required** so a red suite truly blocks merges.
