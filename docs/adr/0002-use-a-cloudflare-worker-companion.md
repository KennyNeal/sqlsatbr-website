# Use a Cloudflare Worker as the private companion service

The public website will remain a static Hugo site on GitHub Pages, but sponsor intake and PayPal event handling will run through a small Cloudflare Worker. This keeps private contact and billing data out of the public repository while providing a lightweight place to validate submissions and open Publication PRs.
