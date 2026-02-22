# Agent Guidelines for Moist-Meat Project

This document provides guidance for Claude Code agents working on this SvelteKit + Firebase + Sentry project.

## GitHub Operations

**Always use the GitHub CLI (`gh`) for the following operations:**

- Viewing deployment logs and build failures: `gh run view <run-id> --log`
- Listing recent runs: `gh run list --limit 10`
- Checking repository variables/secrets: `gh variable list`, `gh secret list`
- Adding/updating secrets: `gh secret set NAME --body "value"`
- Adding/updating variables: `gh variable set NAME --body "value"`
- Viewing pull requests, issues, and commits: `gh pr view`, `gh issue view`

**Why?** The GitHub CLI provides:
- Real-time access to CI/CD logs without leaving the terminal
- Ability to diagnose build failures quickly
- Verification that secrets/variables were properly set
- Human-readable output that's easier to parse than API responses

Example troubleshooting workflow:
```bash
gh run list --limit 5                    # Find failed run
gh run view <run-id> --log | tail -100   # Get error details
# Fix the issue in code
# Deploy again
```

## Project Architecture

### Key Technologies
- **Framework:** SvelteKit 5 with TypeScript
- **Package Manager:** Bun
- **Database:** Firebase Realtime Database
- **Error Tracking:** Sentry
- **Logging:** Pino (server-side only)
- **Deployment:** Vercel (via GitHub Actions)

### Critical Files
- `vite.config.ts` - Build config with Sentry plugin
- `svelte.config.js` - SvelteKit config (no experimental instrumentation - see note below)
- `src/hooks.server.ts` - Server error handling with Sentry
- `src/hooks.client.ts` - Client error handling with Sentry
- `sentry.server.config.ts` - Server-side Sentry initialization
- `sentry.client.config.ts` - Client-side Sentry initialization
- `.env` - Environment variables (Firebase credentials, Sentry DSN, auth tokens)

### SvelteKit Quirks
- **Never use experimental `instrumentation: { server: true }` with `adapter-auto`** - It requires a specific adapter (e.g., `adapter-vercel`, `adapter-node`). Sentry works fine without it.
- Sentry's `sentryViteKit` plugin auto-injects config files from the project root
- Error handling: `handleError` hooks catch unhandled exceptions but NOT explicit `error(500, ...)` calls from loaders/actions

## Sentry Integration Notes

### Environment Variables
- **`PUBLIC_SENTRY_DSN`** - Baked into bundle at build time (accessible both server & client)
- **`SENTRY_ORG`** - GitHub Actions variable, used by build plugin
- **`SENTRY_PROJECT`** - GitHub Actions variable, used by build plugin
- **`SENTRY_AUTH_TOKEN`** - GitHub Actions secret, used for source map upload (never logged/exposed)

### Build Pipeline
1. Vite reads `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` during build
2. `sentrySvelteKit` plugin uploads source maps to Sentry
3. `PUBLIC_SENTRY_DSN` is compiled into both server and client bundles
4. Runtime Sentry initialization reads the compiled DSN value

### Common Issues & Solutions

**Build fails: "instrumentation.server.js only works in certain environments"**
- Remove `experimental: { instrumentation: { server: true } }` from `svelte.config.js`
- Sentry works perfectly without it

**Source maps not uploading**
- Verify all three env vars exist: `gh variable list` and `gh secret list`
- Check build logs: `gh run view <run-id> --log | grep -i sentry`
- Ensure `build.sourcemap: true` is set in `vite.config.ts`

**Errors not appearing in Sentry dashboard**
- Check the DSN is correct in `.env`
- Verify network requests in browser DevTools (Network tab, filter by "sentry")
- Check Sentry organization/project settings for rate limiting

## Deployment

### Pre-Deployment Checklist
1. Run `bun run check` locally - ensure no TypeScript errors
2. Test Sentry locally: `bun run dev` then visit `/sentry-example-page`
3. Verify GitHub Actions secrets/variables: `gh secret list && gh variable list`
4. Push to master branch - GitHub Actions will auto-deploy to Vercel

### Monitoring Post-Deployment
```bash
gh run list                      # Check if deploy succeeded
gh run view <run-id> --log       # View full deployment logs
# Check Sentry dashboard for errors appearing
```

## Code Style & Patterns

### Error Handling
- **Server loaders/actions:** Catch errors, log with pino, call `Sentry.captureException()`, then throw `error(500, {...})`
- **Unhandled errors:** Caught by `handleError` hooks which already call Sentry
- **Client:** Use `Sentry.captureException()` or `Sentry.captureMessage()` explicitly

### Logging
- Use `import logger from '$lib/logger'` for server-side structured logs
- Always log `{ error, status, routeId, url }` context for debugging
- Client-side errors use `console.error()` (pino is Node-only)

### TypeScript
- All route files should use `.ts` extension and proper `PageServerLoad`/`RequestHandler` types
- Uncommented `App.Error { message: string }` in `src/app.d.ts` for type safety

## Testing Sentry Locally

Visit http://localhost:5173/sentry-example-page for test routes:
- Server error: Click button to trigger 500 error
- Client error: Click button to throw in component
- Both should appear in Sentry within 30s

## Future Improvements
- Add custom Sentry alerts for critical errors
- Implement performance baselines for transactions
- Add cron monitoring for recurring tasks
- Explore session replay data for user experience insights
