# Day of Data Baton Rouge Website

This repository hosts the rebuilt public website for Day of Data Baton Rouge.

## Publication PR flow

Public website changes are proposed through a **Publication PR** and published only after that pull request is merged.

1. Create or update site content in a branch.
2. Open a Publication PR.
3. GitHub Actions builds the Hugo site for pull requests.
4. After the Publication PR is merged to `main`, GitHub Actions deploys the site to GitHub Pages.

## Local preview

Install [Hugo](https://gohugo.io/installation/) locally, then run:

```powershell
hugo server
```

With the custom domain configuration in place, open the local preview at:

```text
http://localhost:1313/
```

If you want to override the published base URL explicitly while previewing locally, run:

```powershell
hugo server --baseURL http://localhost:1313/
```

To create the production build locally, run:

```powershell
hugo
```

## Cloudflare Worker companion

This repository now also contains the **Cloudflare Worker companion** for sponsor intake.

1. `worker/src/index.js` exposes the Worker routes.
2. `wrangler.jsonc` points Cloudflare at the Worker entrypoint.
3. `content/invoice-request.md` and `layouts/_default/invoice-request.html` provide the public invoice request form.

### Invoice request route

- `POST /api/invoice-request`

The Worker validates the invoice request payload and forwards the private submission to the configured webhook destination outside the public repository.

### Required Worker configuration

Set this Worker secret in Cloudflare:

- `SPONSOR_INTAKE_WEBHOOK_URL` - private webhook destination that will receive validated sponsor intake submissions

Optional secret:

- `SPONSOR_INTAKE_SHARED_SECRET` - shared secret sent as the `X-Sponsor-Intake-Secret` header when forwarding submissions

## Custom domain cutover

The production **Canonical Domain** is `https://www.dayofdatabr.org/`.

This repository now carries the site-side domain configuration:

1. `hugo.yaml` publishes with the `www.dayofdatabr.org` base URL.
2. `static/CNAME` configures the GitHub Pages custom domain.
3. The base layout performs host-based redirects for:
   - `dayofdatabr.org` -> `https://www.dayofdatabr.org`
   - `register.dayofdatabr.org` -> `https://dayofdatabr26.eventbrite.com/`
   - `callforspeakers.dayofdatabr.org` -> `https://sessionize.com/api/v2/ocxfgd65/view/Speakers?under=True`

The current `callforspeakers` target uses the event-specific Sessionize speakers endpoint exposed by the live site's existing Sessionize embed.

Remaining human-owned cutover steps:

1. Point `www.dayofdatabr.org` at GitHub Pages for this repository's published site.
2. Point `dayofdatabr.org`, `register.dayofdatabr.org`, and `callforspeakers.dayofdatabr.org` at the same GitHub Pages host so the site can serve the redirect logic.
3. In the repository's GitHub Pages settings, confirm `www.dayofdatabr.org` as the custom domain and enable HTTPS after DNS settles.
