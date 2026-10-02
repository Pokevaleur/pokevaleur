# Connected UI tests

The `connected-ui` GitHub Actions job tests the collection search and duplicate review UI at 360, 390 and 1440 pixels. It uses a synthetic non-admin session and an in-memory loopback REST fixture. It tests confirmations, exclusions, reloads, invalidation after quantity changes, save failures and retries. It checks that review decisions do not change collection items.

These tests do **not** test real Supabase authentication, RLS, database persistence or authorization. The existing visitor job tests unauthenticated redirects against the unchanged application.

`prepare.cjs` rewrites API addresses and adds the loopback origin to the CSP **only in a disposable Actions checkout**; it refuses to run outside GitHub Actions. Application configuration committed to the repository remains unchanged. Browser requests to other hosts are blocked and fail the test. No real account, password or production collection is used.

Captures and JSON reports are uploaded for three days. Updates to `codex/browser-tests` trigger both jobs; Vercel deployments are disabled for this branch. Manual dispatch requires this workflow to be present on the default branch before it becomes available in the GitHub UI.
