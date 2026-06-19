# Site maintenance runbook

Practical, step-by-step guides for the common jobs:

1. [Add a sponsor to an event](#1-add-a-sponsor-to-an-event)
2. [Add a new event](#2-add-a-new-event)
3. [Control theming (logo + colors)](#3-control-theming-logo--colors)
4. [How the event model works](#4-how-the-event-model-works)

Everything publishes through the **Publication PR flow**: make changes on a branch,
open a pull request, and the site deploys to GitHub Pages automatically after the PR is
merged to `main`. To preview locally first, install [Hugo](https://gohugo.io/installation/)
and run `hugo server`.

> **Current hosting note:** the site is temporarily published to
> <https://kennyneal.github.io/sqlsatbr-website/> for preview. `static/CNAME` has been
> removed and `baseURL` in `hugo.yaml` points at the github.io path. When you cut over to
> the live domain, restore `static/CNAME` (`www.dayofdatabr.org`) and set
> `baseURL: https://www.dayofdatabr.org/`. Because the dev server honors that base path,
> local preview URLs are under `http://localhost:1313/sqlsatbr-website/`.

---

## 1. Add a sponsor to an event

Each event has its **own** sponsor list, identified by the event's `sponsorsKey`
(e.g. `dodbr-2026`). Sponsors are data-driven — add an image and one block of YAML.

### Step 1 — Add the logo image

Drop the logo into `static/sponsors/<sponsorsKey>/`, e.g.:

```
static/sponsors/dodbr-2026/acme.png
```

Guidance: PNG or SVG with a transparent background looks best; size doesn't need to be
exact (the card scales it); use a lowercase, hyphenated file name.

### Step 2 — Add the sponsor to the data file

Edit `data/sponsors/<sponsorsKey>.yaml` (e.g. `data/sponsors/dodbr-2026.yaml`). Find the
group for the sponsor's tier and add an entry under its `sponsors:` list:

```yaml
      - name: Acme Corporation
        url: https://www.acme.com/
        logo: sponsors/dodbr-2026/acme.png
```

| Field     | Required | Notes |
| --------- | -------- | ----- |
| `name`    | yes      | Shown under the logo and used as the image `alt` text. |
| `url`     | no       | If present, the whole card links here. |
| `logo`    | no       | Path **relative to `static/`** (no leading slash). |
| `logoFit` | no       | `standard` (default), `wide`, or `extra-wide` for very wide logos. |

Tiers (the `tier:` value on each group): `global`, `platinum`, `facility`, `gold`,
`silver`. **Stick to these** — each has matching sizing in `static/site.css`. A new tier
renders but falls back to a plain layout until its styles are added.

### Step 3 — Preview and publish

Run `hugo server`, confirm the sponsor appears on that event's Sponsors page
(`/events/<slug>/sponsors/`), then open a Publication PR and merge.

---

## 2. Add a new event

The site is **multi-event**. Adding an event is a self-contained folder plus its own
sponsor data — there is no site-wide "annual rollover," and no layout edits are needed.
The home page automatically features the soonest upcoming event and lists the rest;
past events drop off once their date passes.

In the steps below, pick a **slug** for the event (e.g. `spring-2027`, `fall-2027`).

### Step 1 — Create the event folder

Create `content/events/<slug>/_index.md`. Copy `content/events/dodbr-2026/_index.md` as a
starting point and edit the front matter:

```yaml
---
title: Day of Data Baton Rouge — Spring 2027
description: ...
layout: event
startDate: 2027-04-17          # drives "upcoming" sorting and the featured slot
dateRange: April 17, 2027      # display text
registrationUrl: https://…     # this event's Eventbrite (omit ⇒ no Register button)
sessionizeId: abcd1234         # this event's Sessionize id (omit ⇒ no Schedule/Speakers)
sponsorsKey: spring-2027       # data/sponsors/spring-2027.yaml (omit ⇒ no Sponsors page)
volunteerUrl: https://…        # SignupGenius (omit ⇒ no Volunteer link)
preconsVenueName / preconsVenueAddress
eventVenueName / eventVenueAddress
preconsIntro: ...              # only if it has PreCons
precons: [...]                 # only if it has PreCons (see dodbr-2026 for the shape)
---

Body copy describing the event (shown in the "About the event" section).
```

> The body and "When & where" venue cards/facts render from this one file. Anything you
> omit simply doesn't appear — that's how a **lighter** event (e.g. spring with no
> PreCons) works.

### Step 2 — Add the feature sub-pages it actually has

Each per-event page is a thin file under the event folder whose layout reads the event's
data from its parent. **Only create the ones the event has** — that's what keeps a
lighter event lighter. Copy from `content/events/dodbr-2026/`:

| File | Page | Needs |
| ---- | ---- | ----- |
| `schedule.md` | Schedule (Sessionize grid) | `sessionizeId` on the event |
| `speakers.md` | Speakers (Sessionize wall) | `sessionizeId` on the event |
| `precons.md`  | PreCons workshops | `precons` on the event |
| `sponsors.md` | Sponsor listings | `sponsorsKey` + data file |

(You can also add `aliases:` in a sub-page if you want a short URL to redirect to it.)

### Step 3 — Add sponsor data and logos

If the event has sponsors, create `data/sponsors/<slug>.yaml` and
`static/sponsors/<slug>/` (see section 1 for the format).

### Step 4 — PreCons headshots

If the event has PreCons, add instructor headshots to `static/precons/` and point each
workshop's `photo:` at them. (For the current event they were sourced from each
speaker's Sessionize profile.)

### Step 5 — Preview and publish

`hugo server`, click through the home page (it should feature or list the new event) and
the event's pages, then open a Publication PR and merge.

### Things that are still per-occurrence (rare)

- **Invoice worker:** `worker/src/index.js` builds invoice memo/name strings that include
  the event year (around lines 223 and 238). Update if you use invoice intake for the new
  event, and redeploy the Cloudflare Worker.
- **Logo / favicon:** the header logo and favicon use `static/DodBR2026.png`
  (referenced in `layouts/_default/baseof.html`). Only touch this if the brand logo
  changes.
- **Archive:** after an event is over you can add an entry under `content/archive/` for
  the **Past Events** page. The event folder and its sponsor data can stay in place as
  history.

---

## 3. Control theming (logo + colors)

The logo and brand colors are **data**, not hard-coded. There's a site-wide default,
and any event can override it with its own logo and primary/secondary colors.

### Site-wide default

In `hugo.yaml` under `params`:

```yaml
params:
  logo: DodBR2026.png        # file in static/
  primaryColor: "#013169"    # dominant brand color (banner, buttons, headings, links)
  secondaryColor: "#e8a33d"  # accent (hero date, the Register pill on event pages)
```

This theme is used on site-level pages. **The home page automatically inherits the
featured (soonest upcoming) event's theme**, so once an event becomes the next one up,
the home recolors to its palette and logo without any manual change.

### Per-event override

Add any of these to an event's `content/events/<slug>/_index.md` front matter:

```yaml
logo: spring-2027-logo.png   # file in static/ (omit ⇒ use site logo)
primaryColor: "#2e7d32"
secondaryColor: "#f4b400"
```

When you view that event's pages, the banner, hero, footer, sub-nav, buttons, and the
Sessionize embeds all recolor to the event's palette, and the logo swaps. Omit any field
to fall back to the site default. The spring-2027 scaffold has a placeholder green palette
so you can see this in action.

### How it works (for editors)

- `layouts/_default/baseof.html` resolves the active theme (site defaults, overridden by
  the current event) and injects an inline `:root { --brand-primary; --brand-secondary }`
  block plus the active logo.
- `static/site.css` consumes `--brand-primary` and `--brand-secondary`. The darker shade
  used for gradients/footer (`--brand-primary-dark`) is derived automatically from the
  primary with `color-mix`, so you only ever set two colors.
- Pick a **primary** with enough contrast for white text (it backs the banner and
  buttons), and a **secondary** that reads on a dark background (it's used for the hero
  date and the Register pill).

---

## 4. How the event model works

- **An event is a content section** at `content/events/<slug>/` with `_index.md`
  (`layout: event`). Its front matter holds all event-specific values.
- **Feature-by-presence:** sub-pages and sections appear only when their data exists, so
  events can be full or lightweight without template changes.
- **Home & Events listing** (`layouts/index.html`, `layouts/events/list.html`) read the
  event sections, split them into upcoming/past by comparing `startDate` to today, and
  sort by date. The home features the soonest upcoming event (falling back to the most
  recent past one) via `layouts/partials/featured-event.html`, and inherits that event's
  theme. **No manual archiving is needed:** once an event's `startDate` passes, it leaves
  the home/upcoming automatically and appears on the **Past Events** page (which lists
  finished events from `content/events/` above the legacy `content/archive/` entries). *Note for editors of those templates:* `startDate` is read as an ISO
  string and compared against `now.Format "2006-01-02"`, and Hugo lowercases param keys —
  so the queries use `"Params.startdate"` (all lowercase).
- **Per-event pages** (`layouts/_default/schedule.html`, `speakers.html`, `precons.html`,
  `sponsors.html`) read the event via `.Parent.Params` and render the shared sub-nav
  (`layouts/partials/event-subnav.html`).
- **Top navigation** is site-level (Home, Events, Become a Sponsor, Past Events);
  event-specific links live in the per-event sub-nav.
