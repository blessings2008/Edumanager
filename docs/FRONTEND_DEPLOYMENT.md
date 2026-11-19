# EduManager web frontend deployment

## Scope of this first web release

The current web application is a public, static product landing page. It introduces EduManager and describes the intended product direction. It is not yet an authenticated school workspace: sign-in, onboarding, school administration, student records, academic workflows and role-based portals are not implemented in the frontend.

Do not advertise this release as a functioning school management system or collect real school/student information through it.

## Build

Requirements: Node.js 22.12+ and pnpm 10+.

From the repository root:

```sh
pnpm install
pnpm --filter @edumanager/web build
```

The Vite production output is `apps/web/dist`. The root workspace build command (`pnpm build`) builds both the API and web workspaces.

## Static hosting requirements

- Publish the contents of `apps/web/dist` as the site document root.
- Serve `index.html` for unknown paths if client-side routes are introduced later.
- Serve assets over HTTPS.
- Enable compression for JavaScript, CSS and SVG assets where supported.
- Keep the generated `dist` directory out of source control.
- No API URL, database credential, authentication secret or school data is required by this public landing page.

The frontend currently makes no API requests and has no runtime environment variables. The API is a separate service and is not required to render this landing page.

## Pre-publication checklist

- [ ] GitHub Actions passes install, tests, type-check and production build.
- [ ] Review the production build output and browser console.
- [ ] Check the page at narrow mobile, tablet and desktop widths.
- [ ] Verify keyboard navigation, visible focus and the skip-to-content link.
- [ ] Confirm the final public domain and HTTPS configuration.
- [ ] Confirm the public copy still describes planned capabilities as planned, not as live features.

## Production boundary

A successful static frontend deployment does not mean the EduManager application is ready for schools or real records. Before enabling authenticated school workspaces, complete and verify the authentication/session lifecycle, server-side school membership checks, least-privilege runtime database access, tenant-aware RLS, resource-level authorization and cross-school integration tests. The database schema-contract migration also remains subject to review and explicit approval.
