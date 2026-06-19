# Site maintenance runbook

Practical, step-by-step guides for the two most common jobs:

1. [Add a new sponsor for the current event year](#1-add-a-new-sponsor-current-year)
2. [Start a new event year](#2-start-a-new-event-year)

Both publish through the **Publication PR flow**: make changes on a branch, open a
pull request, and the site deploys to GitHub Pages automatically after the PR is
merged to `main`. To preview locally first, install [Hugo](https://gohugo.io/installation/)
and run `hugo server`, then open <http://localhost:1313/>.

> **Current hosting note:** the site is temporarily published to
> <https://kennyneal.github.io/sqlsatbr-website/> for preview. `static/CNAME` has been
> removed and `baseURL` in `hugo.yaml` points at the github.io path. When you cut over
> to the live domain, restore `static/CNAME` (`www.dayofdatabr.org`) and set
> `baseURL: https://www.dayofdatabr.org/`.

---

## 1. Add a new sponsor (current year)

Sponsors are data-driven. You add an image and one block of YAML — no HTML required.

### Step 1 — Add the logo image

Drop the sponsor's logo into `static/sponsors/2026/`. For example:

```
static/sponsors/2026/acme.png
```

Guidance:
- **Format:** PNG or SVG with a transparent background looks best; JPG is fine for
  photos/solid logos.
- **Size:** the card frames and scales the image automatically, so an exact size is not
  required. A reasonably high-resolution, roughly horizontal logo works well.
- **File name:** lowercase, no spaces (use hyphens).

### Step 2 — Add the sponsor to the data file

Edit `data/sponsors/2026.yaml`. Find the group for the sponsor's tier and add an entry
under its `sponsors:` list:

```yaml
      - name: Acme Corporation
        url: https://www.acme.com/
        logo: sponsors/2026/acme.png
```

Field reference:

| Field     | Required | Notes |
| --------- | -------- | ----- |
| `name`    | yes      | Shown under the logo and used as the image `alt` text. |
| `url`     | no       | If present, the whole card links here. Omit for a non-clickable card. |
| `logo`    | no       | Path **relative to `static/`** (note: no leading slash). Omit to show a text-only card. |
| `logoFit` | no       | `standard` (default), `wide`, or `extra-wide` — use `wide`/`extra-wide` for very wide logos that otherwise look small. |

The available tier groups (with their `tier:` value) are:

| Group title         | `tier`     |
| ------------------- | ---------- |
| Global Sponsor      | `global`   |
| Platinum Sponsors   | `platinum` |
| Facility Sponsor    | `facility` |
| Gold Sponsors       | `gold`     |
| Silver Sponsors     | `silver`   |

> **Stick to the existing tiers.** Logo sizing and grid columns are styled per tier in
> `static/site.css` (`.sponsor-grid-<tier>`, `.sponsor-card-<tier>`, etc.). A brand-new
> tier name will render but fall back to a plain single-column layout until matching CSS
> is added. If you genuinely need a new tier, add a new group block in the YAML **and**
> the corresponding styles in `site.css`.

### Step 3 — Preview, then publish

1. Run `hugo server` and confirm the sponsor appears on the **Sponsors** page in the
   right tier with the logo sized correctly.
2. Commit on a branch, open a Publication PR, and merge. The site redeploys
   automatically.

That's it — adding a sponsor is just steps 1–2 plus a PR.

---

## 2. Start a new event year

When planning the next event (the steps below use **2027** as the example — substitute
the real year), several files still hard-code the current year. Work through this
checklist. Items are roughly ordered so the site keeps building at each step.

### A. Sponsors data and logos

1. Copy `data/sponsors/2026.yaml` to `data/sponsors/2027.yaml`. Trim it down to the
   sponsors confirmed so far (or leave a starter set and add more as they sign, using
   the process in section 1).
2. Create the logo folder `static/sponsors/2027/` and place new logos there. Update the
   `logo:` paths in the new YAML to point at `sponsors/2027/...`.
3. **Point the Sponsors page at the new year.** In `layouts/_default/sponsors.html`,
   update the hard-coded year on the first line of the template:

   ```go-html-template
   {{ $eventYearSponsors := index hugo.Data.sponsors "2027" }}
   ```

### B. Event details and the home page

4. Copy `content/event-years/2026.md` to `content/event-years/2027.md` and update
   `eventYear`, `dateRange`, the venue names/addresses, and `registrationUrl`.
5. In `content/_index.md`, set `currentEventYear: "2027"` and refresh any year text in
   the intro copy.

### C. Sessionize (Schedule + Speakers)

6. Create the new event in Sessionize — it issues a **new API id** (the current one is
   `ocxfgd65`). Update `sessionizeId:` in both `content/schedule.md` and
   `content/speakers.md`.
7. If the `callforspeakers.dayofdatabr.org` redirect is in use, update the Sessionize id
   in `layouts/_default/baseof.html` (the host-redirect script) and in `README.md`.

### D. Registration (Eventbrite)

8. The registration link (`https://dayofdatabr26.eventbrite.com/`) appears in several
   places. Update each to the new event's Eventbrite URL:
   - `content/event-years/2027.md` (`registrationUrl`)
   - `content/schedule.md` (`registrationUrl`)
   - the `register.dayofdatabr.org` redirect in `layouts/_default/baseof.html`
   - `README.md`

### E. PreCons

9. Update `content/precons.md` with the new year's workshops: titles, descriptions,
   detail lists, instructor bios, and Eventbrite ticket links. Add new instructor
   headshots to `static/precons/` (sourced from each speaker's Sessionize profile) and
   update the `photo:` paths. Remove the prior year's workshops/photos.

### F. Become a Sponsor / Volunteer / page copy

10. In `content/become-a-sponsor.md`, refresh the year text and confirm the sponsor
    interest **Google Form** link is current. The benefit matrix usually carries over —
    update prices/benefits only if the packages change.
11. In `content/become-a-volunteer.md`, update the **SignupGenius** `signupUrl` for the
    new year.
12. Sweep the remaining pages for year text: `content/sponsors.md`,
    `content/invoice-request.md`.

### G. Invoice worker

13. In `worker/src/index.js`, update the invoice memo/name strings that read
    `Day of Data Baton Rouge 2026` (around lines 223 and 238) to the new year. Redeploy
    the Cloudflare Worker if invoice intake is in use.

### H. Logo / favicon

14. The header logo and favicon reference `static/DodBR2026.png` from
    `layouts/_default/baseof.html`. If there is a new-year logo, either replace that file
    (keep the name) or add the new image and update the two references in `baseof.html`.
    *Tip: renaming it to a year-agnostic file (e.g. `logo.png`) once will remove this
    step in future years.*

### I. Archive the finished event

15. After the 2026 event is over, add an entry under `content/archive/` (copy the format
    of an existing file such as `content/archive/2024.md`) so it shows on the
    **Past Events** page. Leave `data/sponsors/2026.yaml` and `static/sponsors/2026/` in
    place for the historical record.

### J. Docs

16. Update year references in `docs/content-baseline.md` and `docs/sponsor-packages.md`,
    and this runbook's examples if anything changed.

### Finally

17. Run `hugo server`, click through every page, then publish via a Publication PR.

> **Reducing future toil (optional):** the year is currently hard-coded in a few spots —
> most notably `layouts/_default/sponsors.html`, the `DodBR2026.png` logo filename, and
> the Eventbrite/Sessionize ids scattered across content. A future improvement is to
> promote these to site `params` in `hugo.yaml` (e.g. `eventYear`, `registrationUrl`,
> `sessionizeId`) and have the layouts/content read them, so a rollover becomes a handful
> of one-line edits. Not required, but it would shrink section 2 considerably.
