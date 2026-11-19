# EduManager web frontend deployment

## Scope

The first release is a public, static product landing page. It is not an authenticated school workspace: sign-in, onboarding, school administration, student records, academic workflows and role-based portals are not implemented in the frontend.

Do not advertise this release as a functioning school management system or collect real school/student information through it.

## Render configuration

The repository-root `render.yaml` defines one Render Static Site:

| Setting | Value |
|---|---|
| Service name | `edumanager-web` |
| Runtime | Static |
| Root directory | Repository root (leave unset) |
| Build command | `corepack enable && corepack prepare pnpm@10.18.0 --activate && pnpm install --no-frozen-lockfile && pnpm --filter @edumanager/web build` |
| Publish directory | `apps/web/dist` |
| Auto deploy | Off until explicitly changed |
| Pull request previews | Off |
| URL | Render-assigned `https://edumanager-web.onrender.com` if the subdomain is available |

The build must run from the repository root because this is a pnpm monorepo and the web workspace depends on the root workspace definition. Do not set the service root directory to `apps/web`.

The repository currently has no `pnpm-lock.yaml`, so the build uses the same non-frozen installation mode as the repository CI workflow. Add and review a committed lockfile in a separate dependency-management change before switching to frozen installs.

The Vite production output is `apps/web/dist`. The root workspace build command (`pnpm build`) builds both API and web workspaces; Render builds only the web workspace.

The Blueprint's rewrite serves `index.html` for unknown paths. Response headers disable framing, prevent MIME sniffing, set a conservative referrer policy, avoid stale HTML, and allow long-lived caching for Vite's fingerprinted assets.

## Approval and deployment boundary

Adding `render.yaml` to GitHub does not create a Render service or deploy the application. The service definition is declarative only. Do not create/apply a Render Blueprint, create a service, trigger a deploy, connect a production branch, or change deployment settings until the founder explicitly approves the proposed Render plan.

After approval, the expected setup is:

1. In Render, choose **New → Blueprint** and connect `blessings2008/Edumanager`.
2. Select the reviewed feature branch while PR #31 remains under review, or the approved main branch after the founder merges it.
3. Review the proposed single static-site resource and confirm the build/publish settings above.
4. Keep auto-deploy disabled for the initial setup. Apply the plan only after explicit founder approval.
5. After the first successful deploy, verify the assigned `onrender.com` URL, HTTPS, page assets, favicon, mobile layout and browser console.

The service name does not guarantee the subdomain is available; Render assigns and confirms the final URL when the service is created.

## Build and local verification

Requirements: Node.js 22.12+ and pnpm 10+.

From the repository root:

```sh
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --no-frozen-lockfile
pnpm --filter @edumanager/web build
```

The repository CI workflow also runs tests, type-checking and the full workspace build. Do not claim local checks passed unless they were actually executed.

## Pre-publication checklist

- [ ] GitHub Actions passes install, tests, type-check and production build for the deployment configuration.
- [ ] Review the production build output and browser console.
- [ ] Check the page at narrow mobile, tablet and desktop widths.
- [ ] Verify keyboard navigation, visible focus and the skip-to-content link.
- [ ] Confirm the Render-assigned temporary URL and HTTPS.
- [ ] Confirm public copy still describes planned capabilities as planned, not as live features.

## Production boundary

A successful static frontend deployment does not mean the EduManager application is ready for schools or real records. Before enabling authenticated school workspaces, complete and verify the authentication/session lifecycle, server-side school membership checks, least-privilege runtime database access, tenant-aware RLS, resource-level authorization and cross-school integration tests. The database schema-contract migration also remains subject to review and explicit approval.
