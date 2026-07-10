# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The public Hugo site plus a Cloudflare Worker companion for **Day of Data Baton Rouge**
(formerly SQL Saturday Baton Rouge). The site is a static Hugo build deployed to GitHub
Pages; the Worker is a separate small service that handles sponsor invoice intake via
PayPal and keeps private billing data out of the public repo (see
`docs/adr/0002-use-a-cloudflare-worker-companion.md`).

## Commands

### Hugo site

```powershell
hugo server              # local preview at http://localhost:1313/sqlsatbr-website/
hugo server --baseURL http://localhost:1313/   # override base path while previewing
hugo --minify             # production build (matches the CI build), outputs to ./public
```

> **Current hosting note:** the site is temporarily published at
> `https://kennyneal.github.io/sqlsatbr-website/` for preview, so `baseURL` in
> `hugo.yaml` and local preview URLs carry the `/sqlsatbr-website/` path prefix. When
> cutting over to the live domain, restore `static/CNAME` (`www.dayofdatabr.org`) and
> set `baseURL: https://www.dayofdatabr.org/` in `hugo.yaml`.

### Cloudflare Worker (`worker/`)

```powershell
cd worker
npm test                  # vitest run — runs worker/src/index.test.js
```

There is no separate lint/build step for the Worker; `wrangler.jsonc` (repo root)
points Cloudflare at `worker/src/index.js` as the deploy entrypoint.

## Publication flow

All public site changes go through a **Publication PR**: branch → PR → merge to
`main` → GitHub Actions deploys to GitHub Pages. Nothing publishes directly.

- `.github/workflows/publish-site.yml` builds the Hugo site on every PR (build-only
  check) and deploys on push to `main`.
- `.github/workflows/publish-sponsor.yml` is a `workflow_dispatch` job organizers run
  manually to add a sponsor: it edits `content/events/<slug>/sponsors.yaml` (optionally
  downloading a logo into `static/sponsorlogos/`), then opens a PR for review. It does
  **not** commit straight to `main`.

## Architecture: the event model

The site is **multi-event, data-driven, and feature-by-presence** — there's no
per-year rollover step and no template edits needed to add or retire an event. This is
the load-bearing concept for almost all content changes; see `docs/runbook.md` for the
step-by-step editor guide. Key points:

- **An event is a content section**: `content/events/<slug>/_index.md` with
  `layout: event`. All event-specific values (dates, registration/Sessionize/volunteer
  URLs, venue info, theme overrides) live in that file's front matter.
- **Sub-pages are optional and thin**: `schedule.md`, `speakers.md`, `precons.md`,
  `sponsors.md` under the event folder each just point their layout back at data on the
  parent event (`.Parent.Params`) or a sibling YAML file (`sponsors.yaml`,
  `precons.yaml`). Only create the ones an event actually has — a lightweight event
  (e.g. no PreCons) simply omits those files/data, and the corresponding nav/section
  disappears with no layout changes.
- **Upcoming vs. past is computed, not curated**: `layouts/index.html` and
  `layouts/events/list.html` compare each event's `startDate` to `now`. The home page
  features the soonest upcoming event (falling back to the most recent past event if
  there is no upcoming one, so home is never blank) via
  `layouts/partials/featured-event.html`. Once an event's date passes it automatically
  moves from "upcoming" to the Past Events page — no manual archiving.
  `content/archive/` holds only legacy pre-migration history below that list.
  **Gotcha:** Hugo lowercases front matter param keys, so template queries must use
  `.Params.startdate`, not `.Params.startDate`.
- **The home page is the featured event**: `layouts/index.html` renders the featured
  event's body from `layouts/partials/event-body.html` — the same partial
  `layouts/events/event.html` uses — then appends the "More upcoming events" grid and the
  archive note. Put anything event-shaped in `event-body.html` so both pages get it; put
  site-level content in `index.html` only. `event-subnav.html` links its title to the site
  root when its event is the featured one, so the featured event has one destination.
  Because the featured event's body is served at two URLs, `baseof.html` gives it a
  `rel="canonical"` pointing at the site root; every other page is self-canonical. Which
  event is featured changes as dates pass, so this is computed from
  `featured-event.html` — never hardcode it, or a passed event will end up declaring a
  newer event's page as its canonical home.
- **Never hand-write a rooted internal link** (`{{ "/foo/" | relURL }}`): `relURL` leaves a
  leading `/` untouched, so the link drops the `baseURL` subpath and 404s on the GitHub
  Pages preview host (it only works on the bare production domain). Derive URLs from page
  objects — `.RelPermalink`, `site.Home.RelPermalink`, `(site.GetPage "/foo").RelPermalink`
  — or use `pageRef` for `hugo.yaml` menu entries.
- **Theming is data, not code**: site-wide default logo/colors live in `hugo.yaml`
  under `params`; any event can override `logo`/`primaryColor`/`secondaryColor` in its
  own front matter. `layouts/_default/baseof.html` resolves the active theme (event
  override > site default) and injects `--brand-primary`/`--brand-secondary` as inline
  CSS vars; `static/site.css` derives the darker gradient/footer shade from
  `--brand-primary` via `color-mix`. The home page inherits the featured event's theme
  automatically.
- **Sponsors** are pure data: `content/events/<slug>/sponsors.yaml` groups sponsors by
  `tier` (`global`, `platinum`, `facility`, `gold`, `silver` — tied to sizing rules in
  `static/site.css`; new tiers render but without matching styles). Sponsor logos live
  under `static/sponsors/<slug>/` per the runbook, though the automated
  `publish-sponsor.yml` workflow drops downloaded/manual logos in
  `static/sponsorlogos/` instead — check where an event's existing logos actually live
  before adding a new one.
- **Every page inside an event section renders the event sub-nav.** Pages with an explicit
  `layout:` call `partial "event-subnav.html" .Parent` themselves; those without one
  (`become-a-sponsor.md`) get it from `layouts/events/single.html`. Skipping it strands the
  page — there is no site-level nav entry to climb back out through.
- **Volunteer roles are per-event data**: `content/events/<slug>/volunteer.yaml` +
  `volunteer.md` (`layout: volunteer`) render the roles list and a sign-up CTA pointing at
  the event's `volunteerUrl`. `event-subnav.html` links the Volunteer *page* when one
  exists and falls back to linking `volunteerUrl` directly when it doesn't, so the two
  never both appear.
- **Sponsor Packages are per-event data**: `content/events/<slug>/packages.yaml` lists the
  tiers, prices, and benefit matrix for that Event Year. It drives both the comparison
  table (`{{< sponsor-packages >}}` shortcode) and the Sponsor Intake form's package
  dropdown, so the two can never disagree. Omit the file and both disappear — the event
  simply has no published packages. Tiers and prices differ per event; nothing may assume
  a package name means the same thing across Event Years. There is no site-level
  "Become a Sponsor" nav entry: sponsorship is event-scoped and lives in the event sub-nav.

## Architecture: Worker (`worker/src/index.js`)

Single-file Worker handling sponsor invoicing, exporting a default `fetch` handler plus
a couple of pure functions (`buildPayPalPayload`, `validateSubmission`) that
`index.test.js` unit-tests directly.

- `GET /health` — checks PayPal config and fetches a live OAuth token.
- `POST /api/invoice-request` — validates the sponsor submission, builds and sends a
  PayPal invoice for the requested `sponsorPackage`, priced by `priceFor(eventSlug,
  sponsorPackage)` against `PACKAGE_PRICING` — keyed by Event Year first, because a
  package name alone never determines a price. `eventSlug` is therefore required. Then
  best-effort mirrors the submission into an organizer Google
  Sheet via `relayToGoogleForm` (controlled by the `GOOGLE_FORM_RESPONSE_URL` /
  `GOOGLE_FORM_ENTRY_MAP` env vars — silently skipped if unset, and failures there never
  block the invoice response).
- Responses are content-negotiated: `respondForRequest` returns JSON by default or a
  minimal HTML confirmation page if the request's `Accept` header prefers `text/html`
  (used by the plain-HTML form fallback at `content/events/<slug>/invoice-request.md` /
  `layouts/_default/invoice-request.html`).
- CORS is allow-listed via `ALLOWED_ORIGINS` (production domains + the GitHub Pages
  preview host + `localhost:1313`) — update this list if the preview or production host
  changes.
- Required secrets: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`
  (`sandbox`|`live`). Optional: `PAYPAL_INVOICER_EMAIL`.
- **Pricing is duplicated on purpose, and the duplication is tested.** The site renders
  from `content/events/<slug>/packages.yaml`; the Worker invoices from its own
  `PACKAGE_PRICING`. They are kept separate so a content PR can never change what PayPal
  charges, and so the browser never supplies an amount. A test in `index.test.js` reads
  every `packages.yaml` and fails if the two disagree in either direction;
  `.github/workflows/worker-tests.yml` runs it on changes to `worker/**` *or* any
  `packages.yaml`. **Changing a price means editing both files in the same PR.**

## Domain language

`CONTEXT.md` defines the project's controlled vocabulary (Event Year, Sponsor Package,
Sponsor Listing, Publication PR, Sponsor Intake, Sponsor Case, Package Inventory, etc.)
with terms to avoid for each. Prefer these terms in code, comments, docs, and PR
descriptions over the "avoid" synonyms listed there.
