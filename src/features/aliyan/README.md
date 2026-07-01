# Aliyan Product Matcher

The matcher is intentionally client-side for workbook handling; it needs a same-origin HTTP proxy for Aliyan HTML. During local Vite development, `/aliyan-api` is proxied by `vite.config.ts`.

For deployment, route `/aliyan-api/*` through the application's trusted server to `https://aliyanpharma.com/*`, preserving query strings. The public site may apply bot protection, so the proxy must be an approved integration that is permitted to access the site. Do not expose credentials in the browser or attempt to bypass access controls.

The matcher searches the full product name first, then individual words split on spaces, `/`, and `+`. It follows result-page "next" links (up to 50 pages), opens the most relevant result detail pages, and only writes the canonical product URL when the normalized detail text contains the exact normalized `Strength / Pack` value.
